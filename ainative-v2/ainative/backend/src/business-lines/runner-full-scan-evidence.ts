import { readFile, readdir, stat } from 'fs/promises';
import path from 'path';
import type { RepoFacts } from './repo-facts-collector';
import type { RunnerCandidateManifest } from './service-candidate-builder';

export interface RunnerFullScanFileEvidence {
  repoPrefix: string;
  path: string;
  content: string;
  truncated: boolean;
}

export interface RunnerFullScanEvidencePack {
  facts: RepoFacts[];
  manifest: RunnerCandidateManifest;
  files: RunnerFullScanFileEvidence[];
  previousErrors: string[];
  totalBytes: number;
  truncated: boolean;
  skippedFiles: string[];
}

export interface RunnerFullScanCollectionOptions {
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
}

const DEFAULT_MAX_FILES = 48;
const DEFAULT_MAX_FILE_BYTES = 12 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 140 * 1024;

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'target',
  '__pycache__',
  '.venv',
  'venv',
  'coverage',
]);

const SENSITIVE_BASENAMES = new Set([
  '.env',
  '.npmrc',
  '.netrc',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
]);

const SENSITIVE_EXTENSIONS = new Set([
  '.pem',
  '.key',
  '.crt',
  '.p12',
  '.pfx',
  '.jks',
]);

const TEXT_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.cs',
  '.go',
  '.h',
  '.hpp',
  '.java',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mjs',
  '.py',
  '.rs',
  '.sh',
  '.toml',
  '.ts',
  '.tsx',
  '.vue',
  '.yaml',
  '.yml',
]);

const PRIORITY_FILENAMES = new Set([
  'package.json',
  'Dockerfile',
  'Makefile',
  'README.md',
  'Cargo.toml',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'nuxt.config.ts',
  'nest-cli.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'CMakeLists.txt',
]);

export async function collectRunnerFullScanEvidence(
  workspaceRoot: string,
  repoPrefixes: string[],
  facts: RepoFacts[],
  manifest: RunnerCandidateManifest,
  previousErrors: string[],
  options: RunnerFullScanCollectionOptions = {},
): Promise<RunnerFullScanEvidencePack> {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const files: RunnerFullScanFileEvidence[] = [];
  const skippedFiles: string[] = [];
  let totalBytes = 0;
  let truncated = false;

  for (const repoPrefix of repoPrefixes) {
    const repoRoot = path.join(workspaceRoot, repoPrefix);
    const candidates = await listEvidenceFiles(repoRoot);
    for (const relativePath of candidates) {
      if (files.length >= maxFiles || totalBytes >= maxTotalBytes) {
        truncated = true;
        break;
      }

      const fullPath = path.join(repoRoot, relativePath);
      try {
        const s = await stat(fullPath);
        if (!s.isFile()) continue;
        if (s.size > maxFileBytes * 4) {
          skippedFiles.push(`${repoPrefix}/${relativePath}: too large`);
          continue;
        }
        const raw = await readFile(fullPath, 'utf-8');
        const normalized = stripControlChars(raw);
        const content = normalized.slice(0, maxFileBytes);
        const nextBytes = Buffer.byteLength(content, 'utf-8');
        if (totalBytes + nextBytes > maxTotalBytes) {
          truncated = true;
          break;
        }
        files.push({
          repoPrefix,
          path: relativePath,
          content,
          truncated: normalized.length > content.length,
        });
        totalBytes += nextBytes;
      } catch {
        skippedFiles.push(`${repoPrefix}/${relativePath}: unreadable`);
      }
    }
  }

  return {
    facts,
    manifest: {
      warnings: manifest.warnings,
      candidates: manifest.candidates.map((candidate) => ({
        ...candidate,
        evidence: candidate.evidence.slice(0, 8),
        warnings: candidate.warnings.slice(0, 5),
      })),
    },
    files,
    previousErrors: previousErrors.slice(-12),
    totalBytes,
    truncated,
    skippedFiles: skippedFiles.slice(0, 50),
  };
}

async function listEvidenceFiles(repoRoot: string): Promise<string[]> {
  const result: string[] = [];
  await walk(repoRoot, '', 0, result);
  return result.sort(compareEvidencePath);
}

async function walk(
  repoRoot: string,
  relativeDir: string,
  depth: number,
  result: string[],
): Promise<void> {
  if (depth > 4 || result.length > 160) return;

  let entries: string[];
  try {
    entries = await readdir(path.join(repoRoot, relativeDir));
  } catch {
    return;
  }

  entries.sort();
  for (const entry of entries) {
    if (result.length > 160) return;
    if (IGNORED_DIRS.has(entry)) continue;
    const relativePath = relativeDir ? `${relativeDir}/${entry}` : entry;
    const fullPath = path.join(repoRoot, relativePath);
    try {
      const s = await stat(fullPath);
      if (s.isDirectory()) {
        await walk(repoRoot, relativePath, depth + 1, result);
      } else if (s.isFile() && isAllowedEvidencePath(relativePath)) {
        result.push(relativePath);
      }
    } catch {
      continue;
    }
  }
}

function isAllowedEvidencePath(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  const lowerBase = basename.toLowerCase();
  const ext = path.extname(lowerBase);
  if (SENSITIVE_BASENAMES.has(lowerBase)) return false;
  if (lowerBase.startsWith('.env')) return false;
  if (lowerBase.includes('secret') || lowerBase.includes('credential')) {
    return false;
  }
  if (SENSITIVE_EXTENSIONS.has(ext)) return false;
  if (PRIORITY_FILENAMES.has(basename)) return true;
  return TEXT_EXTENSIONS.has(ext) && isLikelyUsefulSourcePath(relativePath);
}

function isLikelyUsefulSourcePath(relativePath: string): boolean {
  return (
    relativePath.startsWith('src/') ||
    relativePath.startsWith('cmd/') ||
    relativePath.startsWith('app/') ||
    relativePath.startsWith('server/') ||
    relativePath.startsWith('backend/') ||
    relativePath.startsWith('frontend/') ||
    relativePath.includes('config') ||
    relativePath.includes('main') ||
    relativePath.includes('server') ||
    relativePath.includes('app')
  );
}

function compareEvidencePath(a: string, b: string): number {
  const aPriority = PRIORITY_FILENAMES.has(path.basename(a)) ? 0 : 1;
  const bPriority = PRIORITY_FILENAMES.has(path.basename(b)) ? 0 : 1;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return a.localeCompare(b);
}

function stripControlChars(value: string): string {
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}
