import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { Project } from '../projects/domain/project';
import {
  resolveAinativeDataRootDir,
  resolveWorkspaceRootDir,
} from './workspace-paths';

export type LocalSkillItem = {
  id: string;
  name: string;
  version: string;
  description?: string | null;
  scope?: string | null;
  homepageUrl?: string | null;
  metadataJson?: Record<string, unknown> | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type LocalMcpItem = {
  id: string;
  name: string;
  version: string;
  description?: string | null;
  provider?: string | null;
  toolsCount: number;
  configSchema?: Record<string, unknown> | null;
  metadataJson?: Record<string, unknown> | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectSkillProvider = 'codex' | 'cursor' | 'curso';
export type ProjectMcpProvider =
  | 'cursor'
  | 'gemini'
  | 'opencode'
  | 'claude-code'
  | 'codex';

const PROJECT_SKILL_ROOTS = ['.codex', '.cursor', '.curso'] as const;
export const PROJECT_MCP_CONFIG_SOURCES: ReadonlyArray<{
  provider: ProjectMcpProvider;
  relativePath: string;
}> = [
  { provider: 'cursor', relativePath: '.cursor/mcp.json' },
  { provider: 'gemini', relativePath: '.gemini/settings.json' },
  { provider: 'opencode', relativePath: 'opencode.json' },
  { provider: 'claude-code', relativePath: '.mcp.json' },
  { provider: 'codex', relativePath: '.codex/config.toml' },
];
const SKILL_DESCRIPTOR_FILENAMES = [
  'SKILL.md',
  'skill.md',
  'skill.json',
  'skill.yaml',
  'skill.yml',
  'skill.toml',
];
const TEXT_CONFIG_EXTENSIONS = new Set([
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.md',
]);
const MCP_FILE_BASENAME_REGEX = /(mcp|settings|config)/i;
const workspaceRootDir = resolveWorkspaceRootDir();
const ainativeDataRootDir = resolveAinativeDataRootDir();
const configService = new ConfigService();

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeBoolean = (value: unknown, defaultValue: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return defaultValue;
};

const normalizeNumber = (value: unknown, defaultValue: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return defaultValue;
};

const toDisplayPath = (absolutePath: string): string => {
  const relativePath = path
    .relative(workspaceRootDir, absolutePath)
    .replace(/\\/g, '/');

  if (!relativePath || relativePath.startsWith('..')) {
    return path.resolve(absolutePath);
  }

  return relativePath;
};

const buildDeterministicId = (seed: string): string => {
  return createHash('sha1').update(seed).digest('hex');
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const safeReadFile = async (filePath: string): Promise<string | null> => {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
};

const safeStat = async (
  targetPath: string,
): Promise<import('fs').Stats | null> => {
  try {
    return await fs.stat(targetPath);
  } catch {
    return null;
  }
};

const safeReadDir = async (
  targetPath: string,
): Promise<import('fs').Dirent[]> => {
  try {
    return await fs.readdir(targetPath, { withFileTypes: true });
  } catch {
    return [];
  }
};

const toAbsolutePath = (targetPath: string): string => {
  const normalizedPath = targetPath.trim();
  if (!normalizedPath) {
    return '';
  }

  if (path.isAbsolute(normalizedPath)) {
    return path.resolve(normalizedPath);
  }

  return path.resolve(workspaceRootDir, normalizedPath);
};

const isPathInsideDirectory = (
  targetPath: string,
  directoryPath: string,
): boolean => {
  const relativePath = path.relative(directoryPath, targetPath);

  if (!relativePath) {
    return true;
  }

  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const hasProjectRootMarkers = async (
  directoryPath: string,
): Promise<boolean> => {
  const gitDirStat = await safeStat(path.join(directoryPath, '.git'));
  if (gitDirStat?.isDirectory()) {
    return true;
  }

  for (const rootName of PROJECT_SKILL_ROOTS) {
    const rootStat = await safeStat(path.join(directoryPath, rootName));
    if (rootStat?.isDirectory()) {
      return true;
    }
  }

  for (const source of PROJECT_MCP_CONFIG_SOURCES) {
    const configFileStat = await safeStat(
      path.join(directoryPath, source.relativePath),
    );
    if (configFileStat?.isFile()) {
      return true;
    }
  }

  return false;
};

const parseJsonObject = (content: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(content);
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const stripInlineComment = (value: string): string => {
  const hashIndex = value.indexOf('#');
  if (hashIndex >= 0) {
    return value.slice(0, hashIndex).trim();
  }

  return value.trim();
};

const stripWrappedQuote = (value: string): string => {
  if (!value) {
    return value;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }

  return value;
};

const parseSimpleKeyValue = (content: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) {
      continue;
    }

    const separatorIndex = trimmed.includes(':')
      ? trimmed.indexOf(':')
      : trimmed.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripWrappedQuote(
      stripInlineComment(trimmed.slice(separatorIndex + 1).trim()),
    );

    if (!key || !value) {
      continue;
    }

    result[key] = value;
  }

  return result;
};

const parseFrontmatter = (content: string): Record<string, string> => {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!frontmatterMatch?.[1]) {
    return {};
  }

  return parseSimpleKeyValue(frontmatterMatch[1]);
};

const pickDescriptionFromMarkdown = (content: string): string | null => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('#')) {
      continue;
    }

    if (line.startsWith('---')) {
      continue;
    }

    if (line.startsWith('name:') || line.startsWith('description:')) {
      continue;
    }

    return line;
  }

  return null;
};

const sanitizePathSegment = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const extractRepositoryNameFromGitUrl = (gitUrl: string): string | null => {
  const trimmedUrl = gitUrl.trim();
  if (!trimmedUrl) {
    return null;
  }

  const withoutQuery = trimmedUrl.replace(/[?#].*$/, '').replace(/\/+$/, '');
  const lastSeparatorIndex = Math.max(
    withoutQuery.lastIndexOf('/'),
    withoutQuery.lastIndexOf(':'),
  );
  const rawName =
    lastSeparatorIndex >= 0
      ? withoutQuery.slice(lastSeparatorIndex + 1)
      : withoutQuery;
  const withoutGitSuffix = rawName.replace(/\.git$/i, '');
  const normalized = sanitizePathSegment(withoutGitSuffix);

  return normalized || null;
};

const buildProjectStorageBaseDir = (project: Project): string | null => {
  const businessLineId = normalizeText(project.businessLineId);
  const projectId = normalizeText(project.id);

  if (!businessLineId || !projectId) {
    return null;
  }

  return path.resolve(
    ainativeDataRootDir,
    businessLineId,
    'projects',
    projectId,
  );
};

const buildProjectBaseDirCandidates = (project: Project): string[] => {
  const configJson = isObjectRecord(project.configJson)
    ? project.configJson
    : {};

  const candidateSet = new Set<string>();
  const pushCandidate = (value: unknown) => {
    const normalized = normalizeText(value);
    if (!normalized) {
      return;
    }

    candidateSet.add(path.resolve(normalized));
  };

  pushCandidate(configJson.repoLocalPath);
  pushCandidate(configJson.contextBaseDir);
  pushCandidate(configJson.workspacePath);

  const repositoryNameFromGit = extractRepositoryNameFromGitUrl(project.gitUrl);
  const repositoryNameFromProject = sanitizePathSegment(project.name || '');
  const storageBaseDir = buildProjectStorageBaseDir(project);

  if (storageBaseDir) {
    candidateSet.add(storageBaseDir);

    if (repositoryNameFromGit) {
      candidateSet.add(path.join(storageBaseDir, repositoryNameFromGit));
    }

    if (repositoryNameFromProject) {
      candidateSet.add(path.join(storageBaseDir, repositoryNameFromProject));
    }
  }

  const repoCacheBaseDir =
    normalizeText(configJson.repoCacheBaseDir) ??
    normalizeText(
      configService.get<string>('AINATIVE_REPO_CACHE_BASE_DIR', {
        infer: true,
      }),
    );

  if (repoCacheBaseDir && repositoryNameFromGit) {
    const projectId = normalizeText(project.id);
    if (projectId) {
      candidateSet.add(
        path.resolve(repoCacheBaseDir, `${repositoryNameFromGit}-${projectId}`),
      );
    }
  }

  return Array.from(candidateSet);
};

const buildSiblingRepoDirCandidates = (project: Project): string[] => {
  const repositoryNameFromGit = extractRepositoryNameFromGitUrl(project.gitUrl);
  const repositoryNameFromProject = sanitizePathSegment(project.name || '');
  const parentDir = path.dirname(workspaceRootDir);
  const candidateSet = new Set<string>();

  if (repositoryNameFromGit) {
    candidateSet.add(path.resolve(parentDir, repositoryNameFromGit));
    if (path.basename(workspaceRootDir) === repositoryNameFromGit) {
      candidateSet.add(workspaceRootDir);
    }
  }

  if (repositoryNameFromProject) {
    candidateSet.add(path.resolve(parentDir, repositoryNameFromProject));
    if (path.basename(workspaceRootDir) === repositoryNameFromProject) {
      candidateSet.add(workspaceRootDir);
    }
  }

  return Array.from(candidateSet);
};

const resolveProjectBaseDirForLocalMcp = async (
  project: Project,
): Promise<string | null> => {
  const candidateSet = new Set<string>([
    ...buildProjectBaseDirCandidates(project),
    ...buildSiblingRepoDirCandidates(project),
  ]);
  const resolvedBaseDir = await resolveProjectBaseDir(project);
  if (resolvedBaseDir) {
    candidateSet.add(resolvedBaseDir);
  }

  let selectedBaseDir = '';
  let selectedScore = -1;

  for (const candidatePath of candidateSet) {
    const candidateStat = await safeStat(candidatePath);
    if (!candidateStat?.isDirectory()) {
      continue;
    }

    let score = 0;
    for (const source of PROJECT_MCP_CONFIG_SOURCES) {
      const sourcePath = path.join(candidatePath, source.relativePath);
      const sourceStat = await safeStat(sourcePath);
      if (sourceStat?.isFile()) {
        score += 1;
      }
    }

    if (score > selectedScore) {
      selectedBaseDir = candidatePath;
      selectedScore = score;
    }
  }

  return selectedBaseDir || resolvedBaseDir;
};

export const resolveProjectLocalMcpConfigPath = async (
  project: Project,
  provider: ProjectMcpProvider,
): Promise<string | null> => {
  const projectBaseDir = await resolveProjectBaseDirForLocalMcp(project);
  if (!projectBaseDir) {
    return null;
  }

  const source = PROJECT_MCP_CONFIG_SOURCES.find(
    (item) => item.provider === provider,
  );
  if (!source) {
    return null;
  }

  return path.join(projectBaseDir, source.relativePath);
};

export const resolveProjectLocalMcpConfigPathMap = async (
  project: Project,
): Promise<Record<ProjectMcpProvider, string> | null> => {
  const projectBaseDir = await resolveProjectBaseDirForLocalMcp(project);
  if (!projectBaseDir) {
    return null;
  }

  const result = {} as Record<ProjectMcpProvider, string>;
  for (const source of PROJECT_MCP_CONFIG_SOURCES) {
    result[source.provider] = path.join(projectBaseDir, source.relativePath);
  }

  return result;
};

const resolveProjectBaseDir = async (
  project: Project,
): Promise<string | null> => {
  const candidates = buildProjectBaseDirCandidates(project);

  for (const candidate of candidates) {
    const stat = await safeStat(candidate);
    if (!stat?.isDirectory()) {
      continue;
    }

    if (await hasProjectRootMarkers(candidate)) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    const stat = await safeStat(candidate);
    if (stat?.isDirectory()) {
      return candidate;
    }
  }

  const storageBaseDir = buildProjectStorageBaseDir(project);
  if (!storageBaseDir) {
    return null;
  }

  const storageEntries = await safeReadDir(storageBaseDir);
  const directoryEntries = storageEntries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of directoryEntries) {
    const candidate = path.join(storageBaseDir, entry.name);
    if (await hasProjectRootMarkers(candidate)) {
      return candidate;
    }
  }

  return null;
};

const isSupportedProjectSkillProvider = (
  provider: string,
): provider is ProjectSkillProvider => {
  return provider === 'codex' || provider === 'cursor' || provider === 'curso';
};

export const resolveProjectSkillRootForWrite = async (
  project: Project,
  preferredProvider?: string | null,
): Promise<{
  provider: ProjectSkillProvider;
  rootPath: string;
  skillsPath: string;
} | null> => {
  const projectBaseDir = await resolveProjectBaseDir(project);

  if (!projectBaseDir) {
    return null;
  }

  const normalizedPreferredProvider =
    normalizeText(preferredProvider)?.toLowerCase() ?? '';
  const existingProviders: ProjectSkillProvider[] = [];
  const providerOrder: ProjectSkillProvider[] = ['cursor', 'codex', 'curso'];

  for (const provider of providerOrder) {
    const rootName = `.${provider}`;
    const rootPath = path.join(projectBaseDir, rootName);
    const rootStat = await safeStat(rootPath);
    if (rootStat?.isDirectory()) {
      existingProviders.push(provider);
    }
  }

  const resolvedProvider =
    (isSupportedProjectSkillProvider(normalizedPreferredProvider)
      ? normalizedPreferredProvider
      : undefined) ??
    existingProviders[0] ??
    'cursor';
  const rootPath = path.join(projectBaseDir, `.${resolvedProvider}`);

  return {
    provider: resolvedProvider,
    rootPath,
    skillsPath: path.join(rootPath, 'skills'),
  };
};

const resolveSkillSourcePath = (skill: LocalSkillItem): string | null => {
  const metadata = isObjectRecord(skill.metadataJson)
    ? skill.metadataJson
    : null;
  if (!metadata) {
    return null;
  }

  return normalizeText(metadata.sourcePath);
};

const resolveSkillMarkdownPathCandidates = async (
  sourcePath: string,
): Promise<string[]> => {
  const absoluteSourcePath = toAbsolutePath(sourcePath);
  if (!absoluteSourcePath) {
    return [];
  }

  const sourceStat = await safeStat(absoluteSourcePath);
  const candidateSet = new Set<string>();

  if (sourceStat?.isDirectory()) {
    candidateSet.add(path.join(absoluteSourcePath, 'SKILL.md'));
    candidateSet.add(path.join(absoluteSourcePath, 'skill.md'));
  } else if (sourceStat?.isFile()) {
    candidateSet.add(absoluteSourcePath);
    const parentDir = path.dirname(absoluteSourcePath);
    candidateSet.add(path.join(parentDir, 'SKILL.md'));
    candidateSet.add(path.join(parentDir, 'skill.md'));
  } else {
    candidateSet.add(absoluteSourcePath);
    const parentDir = path.dirname(absoluteSourcePath);
    candidateSet.add(path.join(parentDir, 'SKILL.md'));
    candidateSet.add(path.join(parentDir, 'skill.md'));
  }

  return Array.from(candidateSet).filter((candidatePath) => {
    const normalizedExtension = path.extname(candidatePath).toLowerCase();
    return normalizedExtension === '.md';
  });
};

const dedupeSkills = (items: LocalSkillItem[]): LocalSkillItem[] => {
  const merged = new Map<string, LocalSkillItem>();

  for (const item of items) {
    const key = `${item.name.toLowerCase()}@${item.version.toLowerCase()}`;
    if (!merged.has(key)) {
      merged.set(key, item);
    }
  }

  return Array.from(merged.values()).sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }

    return left.version.localeCompare(right.version);
  });
};

const dedupeMcps = (items: LocalMcpItem[]): LocalMcpItem[] => {
  const merged = new Map<string, LocalMcpItem>();

  for (const item of items) {
    const key = item.id;
    if (!merged.has(key)) {
      merged.set(key, item);
    }
  }

  return Array.from(merged.values()).sort((left, right) => {
    const leftMetadata = isObjectRecord(left.metadataJson)
      ? left.metadataJson
      : null;
    const rightMetadata = isObjectRecord(right.metadataJson)
      ? right.metadataJson
      : null;
    const leftProvider = normalizeText(leftMetadata?.sourceProvider) ?? '';
    const rightProvider = normalizeText(rightMetadata?.sourceProvider) ?? '';
    const byProvider = leftProvider.localeCompare(rightProvider);
    if (byProvider !== 0) {
      return byProvider;
    }

    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }

    return left.version.localeCompare(right.version);
  });
};

const buildLocalSkillItem = ({
  sourceProvider,
  sourcePath,
  name,
  version,
  description,
  scope,
  homepageUrl,
  enabled,
  metadataJson,
  updatedAt,
}: {
  sourceProvider: string;
  sourcePath: string;
  name: string;
  version: string;
  description?: string | null;
  scope?: string | null;
  homepageUrl?: string | null;
  enabled: boolean;
  metadataJson?: Record<string, unknown> | null;
  updatedAt: Date;
}): LocalSkillItem => {
  const normalizedSourcePath = toDisplayPath(sourcePath);
  const idSeed = `${sourceProvider}:${normalizedSourcePath}:${name}:${version}`;

  return {
    id: buildDeterministicId(idSeed),
    name,
    version,
    description: description ?? null,
    scope: scope ?? null,
    homepageUrl: homepageUrl ?? null,
    metadataJson: {
      ...(metadataJson ?? {}),
      sourceProvider,
      sourcePath: normalizedSourcePath,
    },
    enabled,
    createdAt: updatedAt,
    updatedAt,
  };
};

const parseSkillDescriptor = async ({
  filePath,
  fallbackName,
  sourceProvider,
}: {
  filePath: string;
  fallbackName: string;
  sourceProvider: string;
}): Promise<LocalSkillItem | null> => {
  const fileContent = await safeReadFile(filePath);
  if (!fileContent) {
    return null;
  }

  const fileStat = await safeStat(filePath);
  const updatedAt = fileStat?.mtime ?? new Date();
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.json') {
    const parsedObject = parseJsonObject(fileContent);
    if (parsedObject) {
      const name = normalizeText(parsedObject.name) ?? fallbackName;
      const version = normalizeText(parsedObject.version) ?? 'local';

      return buildLocalSkillItem({
        sourceProvider,
        sourcePath: filePath,
        name,
        version,
        description: normalizeText(parsedObject.description),
        scope: normalizeText(parsedObject.scope),
        homepageUrl:
          normalizeText(parsedObject.homepageUrl) ??
          normalizeText(parsedObject.homepage_url),
        enabled: normalizeBoolean(parsedObject.enabled, true),
        metadataJson: isObjectRecord(parsedObject.metadataJson)
          ? parsedObject.metadataJson
          : isObjectRecord(parsedObject.metadata)
            ? parsedObject.metadata
            : null,
        updatedAt,
      });
    }
  }

  const frontmatter = parseFrontmatter(fileContent);
  const simpleMap = parseSimpleKeyValue(fileContent);

  const name =
    normalizeText(frontmatter.name) ??
    normalizeText(simpleMap.name) ??
    fallbackName;
  const version =
    normalizeText(frontmatter.version) ??
    normalizeText(simpleMap.version) ??
    'local';

  return buildLocalSkillItem({
    sourceProvider,
    sourcePath: filePath,
    name,
    version,
    description:
      normalizeText(frontmatter.description) ??
      normalizeText(simpleMap.description) ??
      pickDescriptionFromMarkdown(fileContent),
    scope: normalizeText(frontmatter.scope) ?? normalizeText(simpleMap.scope),
    homepageUrl:
      normalizeText(frontmatter.homepageUrl) ??
      normalizeText(frontmatter.homepage_url) ??
      normalizeText(simpleMap.homepageUrl) ??
      normalizeText(simpleMap.homepage_url),
    enabled: normalizeBoolean(frontmatter.enabled ?? simpleMap.enabled, true),
    metadataJson: null,
    updatedAt,
  });
};

const loadSkillsFromDirectory = async ({
  directoryPath,
  sourceProvider,
}: {
  directoryPath: string;
  sourceProvider: string;
}): Promise<LocalSkillItem[]> => {
  const directoryStat = await safeStat(directoryPath);
  if (!directoryStat?.isDirectory()) {
    return [];
  }

  const entries = await safeReadDir(directoryPath);
  const result: LocalSkillItem[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isFile()) {
      const extension = path.extname(entry.name).toLowerCase();
      if (!TEXT_CONFIG_EXTENSIONS.has(extension)) {
        continue;
      }

      const parsed = await parseSkillDescriptor({
        filePath: entryPath,
        fallbackName: path.parse(entry.name).name,
        sourceProvider,
      });

      if (parsed) {
        result.push(parsed);
      }

      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    let parsedFromDescriptor: LocalSkillItem | null = null;

    for (const descriptorFilename of SKILL_DESCRIPTOR_FILENAMES) {
      const descriptorPath = path.join(entryPath, descriptorFilename);
      const descriptorStat = await safeStat(descriptorPath);

      if (!descriptorStat?.isFile()) {
        continue;
      }

      parsedFromDescriptor = await parseSkillDescriptor({
        filePath: descriptorPath,
        fallbackName: entry.name,
        sourceProvider,
      });

      if (parsedFromDescriptor) {
        break;
      }
    }

    if (parsedFromDescriptor) {
      result.push(parsedFromDescriptor);
      continue;
    }

    const directoryEntryStat = await safeStat(entryPath);
    const fallbackUpdatedAt = directoryEntryStat?.mtime ?? new Date();

    result.push(
      buildLocalSkillItem({
        sourceProvider,
        sourcePath: entryPath,
        name: entry.name,
        version: 'local',
        enabled: true,
        metadataJson: null,
        updatedAt: fallbackUpdatedAt,
      }),
    );
  }

  return dedupeSkills(result);
};

const buildLocalMcpItem = ({
  sourceProvider,
  sourcePath,
  name,
  version,
  description,
  provider,
  toolsCount,
  configSchema,
  metadataJson,
  enabled,
  updatedAt,
}: {
  sourceProvider: string;
  sourcePath: string;
  name: string;
  version: string;
  description?: string | null;
  provider?: string | null;
  toolsCount: number;
  configSchema?: Record<string, unknown> | null;
  metadataJson?: Record<string, unknown> | null;
  enabled: boolean;
  updatedAt: Date;
}): LocalMcpItem => {
  const normalizedSourcePath = toDisplayPath(sourcePath);
  const idSeed = `${sourceProvider}:${normalizedSourcePath}:${name}:${version}`;

  return {
    id: buildDeterministicId(idSeed),
    name,
    version,
    description: description ?? null,
    provider: provider ?? sourceProvider,
    toolsCount,
    configSchema: configSchema ?? null,
    metadataJson: {
      ...(metadataJson ?? {}),
      sourceProvider,
      sourcePath: normalizedSourcePath,
    },
    enabled,
    createdAt: updatedAt,
    updatedAt,
  };
};

const parseMcpFromEntryObject = ({
  name,
  sourcePath,
  sourceProvider,
  value,
  updatedAt,
}: {
  name: string;
  sourcePath: string;
  sourceProvider: string;
  value: unknown;
  updatedAt: Date;
}): LocalMcpItem | null => {
  if (!isObjectRecord(value)) {
    return null;
  }

  const record = value;

  const toolsCount = Array.isArray(record.tools)
    ? record.tools.length
    : normalizeNumber(record.toolsCount ?? record.tools_count, 0);

  return buildLocalMcpItem({
    sourceProvider,
    sourcePath,
    name,
    version: normalizeText(record.version) ?? 'local',
    description: normalizeText(record.description),
    provider:
      normalizeText(record.provider) ??
      normalizeText(record.owner) ??
      sourceProvider,
    toolsCount: Math.max(0, toolsCount),
    configSchema: isObjectRecord(record.configSchema)
      ? record.configSchema
      : isObjectRecord(record.config_schema)
        ? record.config_schema
        : null,
    metadataJson: isObjectRecord(record.metadataJson)
      ? record.metadataJson
      : isObjectRecord(record.metadata)
        ? record.metadata
        : isObjectRecord(record.meta)
          ? record.meta
          : null,
    enabled: normalizeBoolean(record.enabled, true),
    updatedAt,
  });
};

const MCP_LIKE_ENTRY_KEYS = new Set([
  'command',
  'args',
  'url',
  'transport',
  'transporttype',
  'mcptransport',
  'mcp_transport',
  'env',
  'headers',
  'tools',
  'toolscount',
  'tools_count',
  'configschema',
  'config_schema',
]);

const isMcpLikeConfigRecord = (record: Record<string, unknown>): boolean => {
  const normalizedKeys = Object.keys(record).map((key) =>
    key.trim().toLowerCase(),
  );

  if (normalizedKeys.some((key) => MCP_LIKE_ENTRY_KEYS.has(key))) {
    return true;
  }

  const transportLikeValue =
    normalizeText(record.type) ??
    normalizeText(record.transportType) ??
    normalizeText(record.transport_type);
  if (!transportLikeValue) {
    return false;
  }

  const normalizedTransport = transportLikeValue.toLowerCase();
  return (
    normalizedTransport === 'stdio' ||
    normalizedTransport === 'http' ||
    normalizedTransport === 'sse' ||
    normalizedTransport === 'streamable_http'
  );
};

const MCP_GROUPED_FIELD_NAMES = new Set([
  'mcpservers',
  'mcp_servers',
  'mcps',
  'mcp',
]);

const collectMcpGroupedCandidates = (input: unknown): unknown[] => {
  const result: unknown[] = [];
  const visited = new Set<unknown>();

  const visit = (node: unknown, depth: number): void => {
    if (depth > 6) {
      return;
    }

    if (!node || typeof node !== 'object') {
      return;
    }

    if (visited.has(node)) {
      return;
    }
    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item, depth + 1);
      }
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      const normalizedKey = key.trim().toLowerCase();
      if (MCP_GROUPED_FIELD_NAMES.has(normalizedKey)) {
        result.push(value);
      }

      if (isObjectRecord(value) || Array.isArray(value)) {
        visit(value, depth + 1);
      }
    }
  };

  visit(input, 0);

  return result;
};

const parseMcpObject = ({
  contentObject,
  sourcePath,
  sourceProvider,
  fallbackName,
  updatedAt,
}: {
  contentObject: Record<string, unknown>;
  sourcePath: string;
  sourceProvider: string;
  fallbackName: string;
  updatedAt: Date;
}): LocalMcpItem[] => {
  const result: LocalMcpItem[] = [];

  const groupedCandidates = collectMcpGroupedCandidates(contentObject);

  for (const candidate of groupedCandidates) {
    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        if (!isObjectRecord(entry) || !isMcpLikeConfigRecord(entry)) {
          continue;
        }

        const name = normalizeText(entry.name) ?? fallbackName;
        const parsed = parseMcpFromEntryObject({
          name,
          sourcePath,
          sourceProvider,
          value: entry,
          updatedAt,
        });
        if (parsed) {
          result.push(parsed);
        }
      }
      continue;
    }

    if (!isObjectRecord(candidate)) {
      continue;
    }

    for (const [name, value] of Object.entries(candidate)) {
      if (!isObjectRecord(value) || !isMcpLikeConfigRecord(value)) {
        continue;
      }

      const parsed = parseMcpFromEntryObject({
        name,
        sourcePath,
        sourceProvider,
        value,
        updatedAt,
      });
      if (parsed) {
        result.push(parsed);
      }
    }
  }

  if (result.length > 0) {
    return result;
  }

  const directMapResult: LocalMcpItem[] = [];
  for (const [name, value] of Object.entries(contentObject)) {
    if (!isObjectRecord(value) || !isMcpLikeConfigRecord(value)) {
      continue;
    }

    const parsed = parseMcpFromEntryObject({
      name,
      sourcePath,
      sourceProvider,
      value,
      updatedAt,
    });
    if (parsed) {
      directMapResult.push(parsed);
    }
  }

  if (directMapResult.length > 0) {
    return directMapResult;
  }

  if (!isMcpLikeConfigRecord(contentObject)) {
    return [];
  }

  const objectLevelName = normalizeText(contentObject.name) ?? fallbackName;
  const parsed = parseMcpFromEntryObject({
    name: objectLevelName,
    sourcePath,
    sourceProvider,
    value: contentObject,
    updatedAt,
  });
  if (!parsed) {
    return [];
  }

  return [parsed];
};

const parseTomlMcpNames = (content: string): string[] => {
  const names: string[] = [];
  const regexes = [
    /^\s*\[(?:mcpServers|mcp_servers)\.([^\]]+)\]\s*$/gm,
    /^\s*\[(?:mcpServers|mcp_servers)\.("[^"]+"|'[^']+')\]\s*$/gm,
  ];

  for (const regex of regexes) {
    let match: RegExpExecArray | null = regex.exec(content);
    while (match) {
      const raw = match[1]?.trim() ?? '';
      if (raw) {
        names.push(stripWrappedQuote(raw));
      }
      match = regex.exec(content);
    }
  }

  return Array.from(new Set(names));
};

const parseMcpFile = async ({
  filePath,
  sourceProvider,
}: {
  filePath: string;
  sourceProvider: string;
}): Promise<LocalMcpItem[]> => {
  const content = await safeReadFile(filePath);
  if (!content) {
    return [];
  }

  const fileStat = await safeStat(filePath);
  const updatedAt = fileStat?.mtime ?? new Date();
  const fallbackName = path.parse(filePath).name;
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.json') {
    const parsedObject = parseJsonObject(content);
    if (!parsedObject) {
      return [];
    }

    return parseMcpObject({
      contentObject: parsedObject,
      sourcePath: filePath,
      sourceProvider,
      fallbackName,
      updatedAt,
    });
  }

  const tomlNames = extension === '.toml' ? parseTomlMcpNames(content) : [];
  if (tomlNames.length > 0) {
    return tomlNames.map((name) =>
      buildLocalMcpItem({
        sourceProvider,
        sourcePath: filePath,
        name,
        version: 'local',
        provider: sourceProvider,
        toolsCount: 0,
        enabled: true,
        updatedAt,
      }),
    );
  }

  const simpleMap = parseSimpleKeyValue(content);
  if (simpleMap.name) {
    return [
      buildLocalMcpItem({
        sourceProvider,
        sourcePath: filePath,
        name: simpleMap.name,
        version: simpleMap.version ?? 'local',
        description: simpleMap.description ?? null,
        provider: simpleMap.provider ?? sourceProvider,
        toolsCount: Math.max(0, normalizeNumber(simpleMap.toolsCount, 0)),
        enabled: normalizeBoolean(simpleMap.enabled, true),
        updatedAt,
      }),
    ];
  }

  return [];
};

const walkFiles = async ({
  rootPath,
  maxDepth,
  shouldInclude,
}: {
  rootPath: string;
  maxDepth: number;
  shouldInclude: (filePath: string, depth: number) => boolean;
}): Promise<string[]> => {
  const rootStat = await safeStat(rootPath);
  if (!rootStat?.isDirectory()) {
    return [];
  }

  const files: string[] = [];

  const visit = async (currentPath: string, depth: number): Promise<void> => {
    if (depth > maxDepth) {
      return;
    }

    const entries = await safeReadDir(currentPath);

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await visit(entryPath, depth + 1);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (shouldInclude(entryPath, depth)) {
        files.push(entryPath);
      }
    }
  };

  await visit(rootPath, 0);

  return files;
};

const loadMcpsFromDirectory = async ({
  directoryPath,
  sourceProvider,
}: {
  directoryPath: string;
  sourceProvider: string;
}): Promise<LocalMcpItem[]> => {
  const candidateFiles = await walkFiles({
    rootPath: directoryPath,
    maxDepth: 3,
    shouldInclude: (filePath) => {
      const extension = path.extname(filePath).toLowerCase();
      if (!TEXT_CONFIG_EXTENSIONS.has(extension)) {
        return false;
      }

      const basename = path.basename(filePath);
      return MCP_FILE_BASENAME_REGEX.test(basename) || extension === '.json';
    },
  });

  const items: LocalMcpItem[] = [];

  for (const candidateFile of candidateFiles) {
    const parsed = await parseMcpFile({
      filePath: candidateFile,
      sourceProvider,
    });
    items.push(...parsed);
  }

  return dedupeMcps(items);
};

const loadProjectAgentRootDirs = async (
  project: Project,
): Promise<Array<{ provider: string; rootPath: string }>> => {
  const projectBaseDir = await resolveProjectBaseDir(project);

  if (!projectBaseDir) {
    return [];
  }

  const result: Array<{ provider: string; rootPath: string }> = [];

  for (const rootName of PROJECT_SKILL_ROOTS) {
    const rootPath = path.join(projectBaseDir, rootName);
    const rootStat = await safeStat(rootPath);

    if (!rootStat?.isDirectory()) {
      continue;
    }

    result.push({
      provider: rootName.slice(1),
      rootPath,
    });
  }

  return result;
};

const loadProjectMcpsFromConfiguredPaths = async (
  project: Project,
): Promise<LocalMcpItem[]> => {
  const projectBaseDir = await resolveProjectBaseDirForLocalMcp(project);
  if (!projectBaseDir) {
    return [];
  }

  const allMcps: LocalMcpItem[] = [];

  for (const source of PROJECT_MCP_CONFIG_SOURCES) {
    const sourcePath = path.join(projectBaseDir, source.relativePath);
    const sourceStat = await safeStat(sourcePath);
    if (!sourceStat?.isFile()) {
      continue;
    }

    const loaded = await parseMcpFile({
      filePath: sourcePath,
      sourceProvider: source.provider,
    });
    allMcps.push(...loaded);
  }

  return dedupeMcps(allMcps);
};

export const loadBusinessLineLocalSkills = async (
  businessLineId: string,
): Promise<LocalSkillItem[]> => {
  const skillsPath = path.resolve(
    ainativeDataRootDir,
    businessLineId,
    'skills',
  );

  return loadSkillsFromDirectory({
    directoryPath: skillsPath,
    sourceProvider: 'business-line',
  });
};

export const loadBusinessLineLocalSkillMarkdownContent = async (
  businessLineId: string,
  skillId: string,
): Promise<{ id: string; name: string; content: string } | null> => {
  const skills = await loadBusinessLineLocalSkills(businessLineId);
  const targetSkill = skills.find((item) => item.id === skillId);
  if (!targetSkill) {
    return null;
  }

  const sourcePath = resolveSkillSourcePath(targetSkill);
  if (!sourcePath) {
    return null;
  }

  const candidatePaths = await resolveSkillMarkdownPathCandidates(sourcePath);
  const businessLineSkillsRoot = path.resolve(
    ainativeDataRootDir,
    businessLineId,
    'skills',
  );

  for (const candidatePath of candidatePaths) {
    const resolvedCandidatePath = path.resolve(candidatePath);

    if (!isPathInsideDirectory(resolvedCandidatePath, businessLineSkillsRoot)) {
      continue;
    }

    const content = await safeReadFile(resolvedCandidatePath);
    if (typeof content === 'string') {
      return {
        id: targetSkill.id,
        name: targetSkill.name,
        content,
      };
    }
  }

  return null;
};

export const loadBusinessLineLocalMcps = async (
  businessLineId: string,
): Promise<LocalMcpItem[]> => {
  const mcpPath = path.resolve(ainativeDataRootDir, businessLineId, 'mcp');

  return loadMcpsFromDirectory({
    directoryPath: mcpPath,
    sourceProvider: 'business-line',
  });
};

export const loadProjectLocalSkills = async (
  project: Project,
): Promise<LocalSkillItem[]> => {
  const agentRoots = await loadProjectAgentRootDirs(project);
  const allSkills: LocalSkillItem[] = [];

  for (const root of agentRoots) {
    const skillsPath = path.join(root.rootPath, 'skills');
    const loaded = await loadSkillsFromDirectory({
      directoryPath: skillsPath,
      sourceProvider: root.provider,
    });
    allSkills.push(...loaded);
  }

  return dedupeSkills(allSkills);
};

export const loadProjectLocalMcps = async (
  project: Project,
): Promise<LocalMcpItem[]> => {
  return loadProjectMcpsFromConfiguredPaths(project);
};

export const loadProjectLocalSkillMarkdownContent = async (
  project: Project,
  skillId: string,
): Promise<{ id: string; name: string; content: string } | null> => {
  const [skills, agentRoots] = await Promise.all([
    loadProjectLocalSkills(project),
    loadProjectAgentRootDirs(project),
  ]);

  const targetSkill = skills.find((item) => item.id === skillId);
  if (!targetSkill) {
    return null;
  }

  const sourcePath = resolveSkillSourcePath(targetSkill);
  if (!sourcePath) {
    return null;
  }

  const candidatePaths = await resolveSkillMarkdownPathCandidates(sourcePath);
  const allowedRootPaths = agentRoots.map((root) =>
    path.resolve(root.rootPath),
  );

  for (const candidatePath of candidatePaths) {
    const resolvedCandidatePath = path.resolve(candidatePath);
    const inAllowedRoot = allowedRootPaths.some((rootPath) =>
      isPathInsideDirectory(resolvedCandidatePath, rootPath),
    );

    if (!inAllowedRoot) {
      continue;
    }

    const content = await safeReadFile(resolvedCandidatePath);
    if (typeof content === 'string') {
      return {
        id: targetSkill.id,
        name: targetSkill.name,
        content,
      };
    }
  }

  return null;
};
