import { readFile, readdir, stat } from 'fs/promises';
import path from 'path';

export type RunnerProtocol =
  | 'http'
  | 'grpc'
  | 'tcp'
  | 'ws'
  | 'metrics'
  | 'unknown';

export interface EvidenceCandidate<T> {
  value: T;
  source: string;
  evidence: string;
  confidence: number;
}

export interface PortEvidenceCandidate extends EvidenceCandidate<number> {
  protocol: RunnerProtocol;
}

export interface RepoFacts {
  prefix: string;
  fileTree: string[];
  languageHints: string[];
  packageJson?: {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  lockfileType?: 'npm' | 'pnpm' | 'yarn';
  dockerfile?: {
    exposes: number[];
    cmd?: string;
    entrypoint?: string;
  };
  goMod?: { module: string };
  pythonManifest?: 'requirements.txt' | 'pyproject.toml';
  frameworkHints: string[];
  entryFileHints: string[];
  workdirEvidence: EvidenceCandidate<string>[];
  commandEvidence: EvidenceCandidate<string>[];
  portEvidence: PortEvidenceCandidate[];
}

export type RepoFactsScanMode = 'default' | 'targeted' | 'bounded-full';

export interface RepoFactsCollectionOptions {
  scanMode?: RepoFactsScanMode;
}

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '__pycache__',
  '.venv',
  'venv',
  'target',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.zip',
  '.tar',
  '.gz',
  '.bin',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
]);

const FRAMEWORK_CONFIG_FILES: Record<string, string> = {
  'vite.config.ts': 'vite',
  'vite.config.js': 'vite',
  'vite.config.mts': 'vite',
  'next.config.js': 'next',
  'next.config.mjs': 'next',
  'next.config.ts': 'next',
  'nest-cli.json': 'nest',
  'nuxt.config.ts': 'nuxt',
  'nuxt.config.js': 'nuxt',
  'rsbuild.config.ts': 'rsbuild',
  'rsbuild.config.js': 'rsbuild',
  'Cargo.toml': 'cargo',
  'pom.xml': 'spring-boot',
  'build.gradle': 'spring-boot',
  'build.gradle.kts': 'spring-boot',
};

const ENTRY_FILE_CANDIDATES = [
  'main.go',
  'main.py',
  'app.py',
  'src/main.ts',
  'src/main.js',
  'src/index.ts',
  'src/index.js',
  'cmd/main.go',
];

const MAX_FILE_TREE_ENTRIES = 200;
const MAX_SMALL_FILE_BYTES = 32 * 1024;
export async function collectRepoFacts(
  repoDir: string,
  prefix: string,
  options: RepoFactsCollectionOptions = {},
): Promise<RepoFacts> {
  const facts: RepoFacts = {
    prefix,
    fileTree: [],
    languageHints: [],
    frameworkHints: [],
    entryFileHints: [],
    workdirEvidence: [
      {
        value: prefix,
        source: 'subRepo.prefix',
        evidence: `sub-repo is mounted at ${prefix}`,
        confidence: 0.7,
      },
    ],
    commandEvidence: [],
    portEvidence: [],
  };

  const scanLimits = getScanLimits(options.scanMode ?? 'default');
  await collectFileTree(
    repoDir,
    '',
    0,
    facts.fileTree,
    scanLimits.maxDepth,
    scanLimits.maxEntries,
  );
  facts.fileTree.sort();

  for (const file of facts.fileTree) {
    const hint = FRAMEWORK_CONFIG_FILES[file];
    if (hint && !facts.frameworkHints.includes(hint)) {
      facts.frameworkHints.push(hint);
    }
  }

  await collectLockfileType(repoDir, facts);
  await collectPackageJson(repoDir, facts);
  await collectDockerfile(repoDir, facts);
  await collectGoMod(repoDir, facts);
  await collectPythonManifest(repoDir, facts);
  await collectEntryFileHints(repoDir, facts);
  await collectGoCommandEvidence(repoDir, facts);
  await collectMakefile(repoDir, facts);
  await collectEnvFiles(repoDir, facts);
  await collectConfigPortEvidence(repoDir, facts);
  await collectCargoManifest(repoDir, facts);
  await collectCMakeManifest(repoDir, facts);
  await detectFrameworkFromSource(repoDir, facts);

  return facts;
}

export interface CollectedFacts {
  facts: RepoFacts[];
  truncated: boolean;
  truncatedPrefixes: string[];
}

export async function collectAllRepoFacts(
  tmpDir: string,
  prefixes: string[],
  options: RepoFactsCollectionOptions = {},
): Promise<CollectedFacts> {
  const allFacts: RepoFacts[] = [];

  for (const prefix of prefixes) {
    const repoDir = path.join(tmpDir, prefix);
    const facts = await collectRepoFacts(repoDir, prefix, options);
    allFacts.push(facts);
  }

  return {
    facts: allFacts,
    truncated: false,
    truncatedPrefixes: [],
  };
}

async function collectFileTree(
  baseDir: string,
  relativePath: string,
  depth: number,
  result: string[],
  maxDepth = 2,
  maxEntries = MAX_FILE_TREE_ENTRIES,
): Promise<void> {
  if (depth > maxDepth || result.length >= maxEntries) return;

  let entries: string[];
  try {
    entries = await readdir(path.join(baseDir, relativePath));
  } catch {
    return;
  }

  entries.sort();

  for (const entry of entries) {
    if (result.length >= maxEntries) break;
    if (IGNORED_DIRS.has(entry)) continue;

    const ext = path.extname(entry).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) continue;

    const fullRelative = relativePath ? `${relativePath}/${entry}` : entry;

    try {
      const s = await stat(path.join(baseDir, fullRelative));
      if (s.isDirectory()) {
        result.push(fullRelative + '/');
        await collectFileTree(
          baseDir,
          fullRelative,
          depth + 1,
          result,
          maxDepth,
          maxEntries,
        );
      } else if (s.isFile()) {
        result.push(fullRelative);
      }
    } catch {
      continue;
    }
  }
}

function getScanLimits(scanMode: RepoFactsScanMode): {
  maxDepth: number;
  maxEntries: number;
} {
  switch (scanMode) {
    case 'targeted':
      return { maxDepth: 5, maxEntries: 500 };
    case 'bounded-full':
      return { maxDepth: 6, maxEntries: 1000 };
    default:
      return { maxDepth: 2, maxEntries: MAX_FILE_TREE_ENTRIES };
  }
}

async function collectPackageJson(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  try {
    const content = await readFile(path.join(repoDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(content);
    facts.packageJson = {
      scripts: pkg.scripts ?? undefined,
      dependencies: pkg.dependencies ?? undefined,
      devDependencies: pkg.devDependencies ?? undefined,
    };
    addUnique(facts.languageHints, 'node');
    addEvidence(facts.workdirEvidence, {
      value: facts.prefix,
      source: 'package.json',
      evidence: 'package.json found at repository root',
      confidence: 0.85,
    });

    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    if (allDeps.vite && !facts.frameworkHints.includes('vite'))
      facts.frameworkHints.push('vite');
    if (allDeps.next && !facts.frameworkHints.includes('next'))
      facts.frameworkHints.push('next');
    if (allDeps['@nestjs/core'] && !facts.frameworkHints.includes('nest'))
      facts.frameworkHints.push('nest');
    if (allDeps.nuxt && !facts.frameworkHints.includes('nuxt'))
      facts.frameworkHints.push('nuxt');
    if (allDeps['react-scripts'] && !facts.frameworkHints.includes('cra'))
      facts.frameworkHints.push('cra');
    if (allDeps.rsbuild && !facts.frameworkHints.includes('rsbuild'))
      facts.frameworkHints.push('rsbuild');
    if (
      (allDeps['@tarojs/cli'] ||
        allDeps['@tarojs/plugin-platform-h5'] ||
        allDeps['@tarojs/vite-runner']) &&
      !facts.frameworkHints.includes('taro')
    ) {
      facts.frameworkHints.push('taro');
    }

    const scripts = pkg.scripts ?? {};
    const scriptName = pickNodeScript(scripts);
    if (scriptName) {
      const pm = facts.lockfileType ?? 'npm';
      const runner = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'npm';
      const scriptValue = String(scripts[scriptName]);
      addEvidence(facts.commandEvidence, {
        value: `${runner} run ${scriptName}`,
        source: `package.json:scripts.${scriptName}`,
        evidence: scriptValue,
        confidence: scriptName === 'dev' ? 0.9 : 0.82,
      });

      const port = extractPortFromCommand(scriptValue);
      if (port) {
        addPortEvidence(facts.portEvidence, {
          value: port,
          protocol: 'http',
          source: `package.json:scripts.${scriptName}`,
          evidence: scriptValue,
          confidence: 0.85,
        });
      } else if (
        facts.frameworkHints.includes('taro') &&
        ['dev:h5:local', 'dev:h5', 'build:h5'].includes(scriptName)
      ) {
        addPortEvidence(facts.portEvidence, {
          value: 10086,
          protocol: 'http',
          source: `package.json:scripts.${scriptName}`,
          evidence: `${scriptValue} (default Taro H5 dev port)`,
          confidence: 0.62,
        });
      }
    }
  } catch {
    // no package.json
  }
}

async function collectLockfileType(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  try {
    await stat(path.join(repoDir, 'pnpm-lock.yaml'));
    facts.lockfileType = 'pnpm';
    return;
  } catch {}

  try {
    await stat(path.join(repoDir, 'package-lock.json'));
    facts.lockfileType = 'npm';
    return;
  } catch {}

  try {
    await stat(path.join(repoDir, 'yarn.lock'));
    facts.lockfileType = 'yarn';
  } catch {}
}

async function collectDockerfile(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  try {
    const content = await readFile(path.join(repoDir, 'Dockerfile'), 'utf-8');
    const exposes: number[] = [];
    let cmd: string | undefined;
    let entrypoint: string | undefined;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      const exposeMatch = trimmed.match(/^EXPOSE\s+(\d+)/i);
      if (exposeMatch) {
        exposes.push(parseInt(exposeMatch[1], 10));
      }
      const cmdMatch = trimmed.match(/^CMD\s+(.+)/i);
      if (cmdMatch) {
        cmd = parseCmdEntrypoint(cmdMatch[1]);
      }
      const entryMatch = trimmed.match(/^ENTRYPOINT\s+(.+)/i);
      if (entryMatch) {
        entrypoint = parseCmdEntrypoint(entryMatch[1]);
      }
    }

    if (exposes.length > 0 || cmd || entrypoint) {
      facts.dockerfile = { exposes, cmd, entrypoint };
    }

    for (const port of exposes) {
      addPortEvidence(facts.portEvidence, {
        value: port,
        protocol: 'unknown',
        source: 'Dockerfile:EXPOSE',
        evidence: `EXPOSE ${port}`,
        confidence: 0.45,
      });
    }
    if (cmd || entrypoint) {
      addEvidence(facts.commandEvidence, {
        value: cmd ?? entrypoint ?? '',
        source: cmd ? 'Dockerfile:CMD' : 'Dockerfile:ENTRYPOINT',
        evidence: cmd ?? entrypoint ?? '',
        confidence: 0.58,
      });
    }
  } catch {
    // no Dockerfile
  }
}

function parseCmdEntrypoint(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.join(' ');
    } catch {}
  }
  return trimmed;
}

async function collectGoMod(repoDir: string, facts: RepoFacts): Promise<void> {
  try {
    const content = await readFile(path.join(repoDir, 'go.mod'), 'utf-8');
    const moduleMatch = content.match(/^module\s+(.+)$/m);
    if (moduleMatch) {
      facts.goMod = { module: moduleMatch[1].trim() };
      addUnique(facts.frameworkHints, 'go');
      addUnique(facts.languageHints, 'go');
      if (content.includes('go-kratos/kratos'))
        addUnique(facts.frameworkHints, 'kratos');
      if (content.includes('gin-gonic/gin'))
        addUnique(facts.frameworkHints, 'gin');
      addEvidence(facts.workdirEvidence, {
        value: facts.prefix,
        source: 'go.mod',
        evidence: `module ${moduleMatch[1].trim()}`,
        confidence: 0.86,
      });
    }
  } catch {
    // no go.mod
  }
}

async function collectGoCommandEvidence(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  if (!facts.goMod) return;

  const cmdEntries = facts.fileTree
    .filter((file) => /^cmd\/[^/]+\/main\.go$/.test(file))
    .sort();

  for (const entry of cmdEntries) {
    const commandDir = path.posix.dirname(entry);
    let command = `go run ./${commandDir}`;
    let confidence = 0.86;

    const content = await readSmallTextFile(repoDir, entry);
    if (
      facts.fileTree.includes('configs/') &&
      (content?.includes('-conf') ||
        content?.includes('flagconf') ||
        facts.frameworkHints.includes('kratos'))
    ) {
      command = `${command} -conf ./configs`;
      confidence = 0.9;
    }

    addEvidence(facts.commandEvidence, {
      value: command,
      source: entry,
      evidence: `${entry} exists`,
      confidence,
    });
  }
}

async function collectPythonManifest(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  try {
    await stat(path.join(repoDir, 'requirements.txt'));
    facts.pythonManifest = 'requirements.txt';
    addUnique(facts.frameworkHints, 'python');
    addUnique(facts.languageHints, 'python');
    return;
  } catch {}

  try {
    await stat(path.join(repoDir, 'pyproject.toml'));
    facts.pythonManifest = 'pyproject.toml';
    addUnique(facts.frameworkHints, 'python');
    addUnique(facts.languageHints, 'python');
  } catch {}
}

async function collectEntryFileHints(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  for (const candidate of ENTRY_FILE_CANDIDATES) {
    try {
      const s = await stat(path.join(repoDir, candidate));
      if (s.isFile()) {
        facts.entryFileHints.push(candidate);
        if (candidate.endsWith('.go')) {
          const command =
            candidate === 'main.go'
              ? 'go run .'
              : `go run ./${path.posix.dirname(candidate)}`;
          addEvidence(facts.commandEvidence, {
            value: command,
            source: candidate,
            evidence: `${candidate} exists`,
            confidence: candidate === 'main.go' ? 0.75 : 0.82,
          });
        }
      }
    } catch {
      continue;
    }
  }
}

async function collectMakefile(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  try {
    const content = await readFile(path.join(repoDir, 'Makefile'), 'utf-8');
    for (const target of ['dev', 'run', 'start', 'serve']) {
      if (new RegExp(`^${target}:`, 'm').test(content)) {
        addEvidence(facts.commandEvidence, {
          value: `make ${target}`,
          source: `Makefile:${target}`,
          evidence: `${target}: target found`,
          confidence: target === 'dev' || target === 'run' ? 0.78 : 0.72,
        });
      }
    }
  } catch {
    // no Makefile
  }
}

async function collectEnvFiles(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  for (const file of facts.fileTree.filter((item) =>
    /^\.env(?:\.[^/]+)?\.(?:example|sample)$/.test(item),
  )) {
    try {
      const content = await readSmallTextFile(repoDir, file);
      if (!content) continue;
      for (const line of content.split('\n')) {
        const match = line.match(
          /^\s*(?:PORT|HTTP_PORT|APP_PORT)\s*=\s*(\d+)/i,
        );
        if (match) {
          addPortEvidence(facts.portEvidence, {
            value: Number(match[1]),
            protocol: 'http',
            source: file,
            evidence: line.trim(),
            confidence: 0.68,
          });
        }
      }
    } catch {
      continue;
    }
  }
}

async function collectConfigPortEvidence(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  const configFiles = new Set(
    facts.fileTree.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return (
        Boolean(FRAMEWORK_CONFIG_FILES[file]) ||
        /\.(?:config|conf)\.(?:ts|js|mjs|cjs)$/.test(file) ||
        ((file.startsWith('config') ||
          file.startsWith('env') ||
          file.includes('/config') ||
          file.includes('/configs/') ||
          /^cmd\/[^/]+\/configs?\//.test(file)) &&
          [
            '.yaml',
            '.yml',
            '.toml',
            '.json',
            '.ts',
            '.js',
            '.mjs',
            '.cjs',
          ].includes(ext))
      );
    }),
  );

  for (const dir of facts.fileTree.filter((file) =>
    /(?:^|\/)configs?\/$/.test(file),
  )) {
    await collectNestedConfigFiles(repoDir, dir, configFiles);
  }

  for (const file of configFiles) {
    const content = await readSmallTextFile(repoDir, file);
    if (!content) continue;
    const portEvidenceCountBefore = facts.portEvidence.length;
    collectStructuredPorts(file, content, facts);
    collectTextualPorts(file, content, facts);
    downgradeEnvGatedTaroPortEvidence(
      file,
      content,
      facts,
      portEvidenceCountBefore,
    );
  }
}

async function collectNestedConfigFiles(
  repoDir: string,
  relativeDir: string,
  target: Set<string>,
): Promise<void> {
  try {
    const entries = await readdir(path.join(repoDir, relativeDir));
    for (const entry of entries) {
      const relativeFile = `${relativeDir}${entry}`;
      const ext = path.extname(relativeFile).toLowerCase();
      if (
        ![
          '.yaml',
          '.yml',
          '.toml',
          '.json',
          '.ts',
          '.js',
          '.mjs',
          '.cjs',
        ].includes(ext)
      ) {
        continue;
      }
      const s = await stat(path.join(repoDir, relativeFile));
      if (s.isFile() && s.size <= MAX_SMALL_FILE_BYTES) {
        target.add(relativeFile);
      }
    }
  } catch {
    // best-effort nested config scan
  }
}

async function collectCargoManifest(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  try {
    const content = await readFile(path.join(repoDir, 'Cargo.toml'), 'utf-8');
    addUnique(facts.languageHints, 'rust');
    addUnique(facts.frameworkHints, 'cargo');
    addEvidence(facts.commandEvidence, {
      value: 'cargo run',
      source: 'Cargo.toml',
      evidence: 'Cargo.toml found at repository root',
      confidence: 0.65,
    });
    if (/axum|actix-web|rocket|warp/i.test(content)) {
      addUnique(facts.frameworkHints, 'rust-web');
    }
  } catch {
    // no Cargo.toml
  }
}

async function collectCMakeManifest(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  try {
    await stat(path.join(repoDir, 'CMakeLists.txt'));
    addUnique(facts.languageHints, 'cpp');
    addUnique(facts.frameworkHints, 'cmake');
  } catch {
    // no CMakeLists.txt
  }
}

async function detectFrameworkFromSource(
  repoDir: string,
  facts: RepoFacts,
): Promise<void> {
  const filesToCheck = ['main.py', 'app.py', 'main.go'];

  for (const file of filesToCheck) {
    if (!facts.entryFileHints.includes(file)) continue;

    try {
      const filePath = path.join(repoDir, file);
      const s = await stat(filePath);
      if (s.size > MAX_SMALL_FILE_BYTES) continue;

      const content = await readFile(filePath, 'utf-8');

      if (
        file.endsWith('.py') &&
        (content.includes('from fastapi') ||
          content.includes('FastAPI()') ||
          content.includes('import fastapi'))
      ) {
        if (!facts.frameworkHints.includes('fastapi'))
          facts.frameworkHints.push('fastapi');
      }

      if (
        file === 'main.go' &&
        (content.includes('gin.Default') || content.includes('gin.New'))
      ) {
        if (!facts.frameworkHints.includes('gin'))
          facts.frameworkHints.push('gin');
      }
    } catch {
      continue;
    }
  }
}

function collectStructuredPorts(
  source: string,
  content: string,
  facts: RepoFacts,
): void {
  const contextStack: Array<{ indent: number; key: string }> = [];
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*/, '');
    if (!line.trim()) continue;

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const keyMatch = line.match(/^\s*([A-Za-z0-9_.-]+)\s*:/);
    if (keyMatch) {
      while (
        contextStack.length > 0 &&
        contextStack[contextStack.length - 1]!.indent >= indent
      ) {
        contextStack.pop();
      }
      contextStack.push({ indent, key: keyMatch[1].toLowerCase() });
    }

    const context = contextStack.map((item) => item.key).join('.');
    const addrMatch = line.match(
      /\baddr(?:ess)?\s*[:=]\s*["']?[^"'\s#]*:(\d+)/i,
    );
    const portMatch = line.match(/\b(port|listen)\s*[:=]\s*["']?(\d+)/i);
    const rawPort = addrMatch?.[1] ?? portMatch?.[2];
    if (!rawPort) continue;

    const port = Number(rawPort);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) continue;

    const protocol = normalizeConfigPortProtocol(
      source,
      inferProtocolFromContext(context, line),
      facts,
    );
    addPortEvidence(facts.portEvidence, {
      value: port,
      protocol,
      source,
      evidence: rawLine.trim(),
      confidence: protocol === 'unknown' ? 0.55 : 0.88,
    });
  }
}

function downgradeEnvGatedTaroPortEvidence(
  source: string,
  content: string,
  facts: RepoFacts,
  portEvidenceStartIndex: number,
): void {
  if (!facts.frameworkHints.includes('taro')) {
    return;
  }

  if (!content.includes('process.env.TARO_APP_API')) {
    return;
  }

  const commandEnablesTaroAppApi = facts.commandEvidence.some((candidate) =>
    `${candidate.value} ${candidate.evidence}`.includes('TARO_APP_API'),
  );
  if (commandEnablesTaroAppApi) {
    return;
  }

  for (const candidate of facts.portEvidence.slice(portEvidenceStartIndex)) {
    if (candidate.source !== source || candidate.protocol !== 'http') {
      continue;
    }

    candidate.confidence = Math.min(candidate.confidence, 0.45);
    if (!candidate.evidence.includes('env-gated by TARO_APP_API')) {
      candidate.evidence = `${candidate.evidence} (env-gated by TARO_APP_API)`;
    }
  }
}

function collectTextualPorts(
  source: string,
  content: string,
  facts: RepoFacts,
): void {
  const seen = new Set<string>();
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const matches = [
      ...line.matchAll(
        /\b(?:port|devServerPort|serverPort|h5Port)\b["'\s:=,]*([1-9]\d{1,4})/gi,
      ),
      ...line.matchAll(/\blocalhost:(\d{2,5})\b/gi),
      ...line.matchAll(/\b0\.0\.0\.0:(\d{2,5})\b/gi),
    ];

    for (const match of matches) {
      const rawPort = match[1];
      const port = rawPort ? Number(rawPort) : Number.NaN;
      if (!Number.isInteger(port) || port <= 0 || port > 65535) continue;
      if (shouldIgnoreFrontendApiUrlPort(source, line, facts, port)) continue;

      const protocol = normalizeConfigPortProtocol(
        source,
        inferProtocolFromContext(source, line),
        facts,
      );
      const key = `${source}:${port}:${protocol}:${line}`;
      if (seen.has(key)) continue;
      seen.add(key);

      addPortEvidence(facts.portEvidence, {
        value: port,
        protocol,
        source,
        evidence: rawLine.trim(),
        confidence: protocol === 'unknown' ? 0.58 : 0.78,
      });
    }
  }
}

function shouldIgnoreFrontendApiUrlPort(
  source: string,
  line: string,
  facts: RepoFacts,
  port: number,
): boolean {
  if (
    !facts.frameworkHints.some((hint) =>
      ['taro', 'vite', 'rsbuild', 'next', 'nuxt', 'cra'].includes(hint),
    )
  ) {
    return false;
  }

  const sourceLower = source.toLowerCase();
  if (!sourceLower.startsWith('src/') && !sourceLower.includes('/src/')) {
    return false;
  }

  const normalizedLine = line.toLowerCase();
  const urlMatch = normalizedLine.match(
    /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)(\/[^\s"'`,}]*)?/i,
  );
  if (!urlMatch || Number(urlMatch[1]) !== port) {
    return false;
  }

  const suffix = urlMatch[2] ?? '';
  if (!suffix || suffix === '/' || suffix.startsWith('/?')) {
    return false;
  }

  return true;
}

function normalizeConfigPortProtocol(
  source: string,
  inferred: RunnerProtocol,
  facts: RepoFacts,
): RunnerProtocol {
  if (inferred !== 'unknown') {
    return inferred;
  }

  const sourceLower = source.toLowerCase();
  if (
    sourceLower.includes('vite') ||
    sourceLower.includes('rsbuild') ||
    sourceLower.includes('taro') ||
    sourceLower.includes('next') ||
    sourceLower.includes('nuxt') ||
    facts.frameworkHints.some((hint) =>
      ['vite', 'rsbuild', 'taro', 'next', 'nuxt', 'cra'].includes(hint),
    )
  ) {
    return 'http';
  }

  return inferred;
}

function inferProtocolFromContext(
  context: string,
  line: string,
): RunnerProtocol {
  const haystack = `${context} ${line}`.toLowerCase();
  if (
    /\bgrpc\b/.test(haystack) ||
    haystack.includes('grpc.addr') ||
    haystack.includes('grpc_addr')
  ) {
    return 'grpc';
  }
  if (haystack.includes('metrics') || haystack.includes('prometheus'))
    return 'metrics';
  if (haystack.includes('websocket') || haystack.includes(' ws')) return 'ws';
  if (
    /\bhttp\b/.test(haystack) ||
    haystack.includes('http.addr') ||
    haystack.includes('http_addr') ||
    haystack.includes('web') ||
    haystack.includes('app')
  ) {
    return 'http';
  }
  if (
    haystack.includes('redis') ||
    haystack.includes('mysql') ||
    haystack.includes('postgres') ||
    haystack.includes('database')
  ) {
    return 'tcp';
  }
  return 'unknown';
}

async function readSmallTextFile(
  repoDir: string,
  relativePath: string,
): Promise<string | null> {
  try {
    const fullPath = path.join(repoDir, relativePath);
    const s = await stat(fullPath);
    if (!s.isFile() || s.size > MAX_SMALL_FILE_BYTES) return null;
    return await readFile(fullPath, 'utf-8');
  } catch {
    return null;
  }
}

function pickNodeScript(scripts: Record<string, string>): string | null {
  const priorities = [
    'dev:h5:local',
    'dev:h5',
    'dev:web',
    'dev',
    ...Object.keys(scripts)
      .filter((key) => key.startsWith('start:'))
      .sort(),
    'start',
    ...Object.keys(scripts)
      .filter((key) => key.startsWith('serve:'))
      .sort(),
    'serve',
    ...Object.keys(scripts)
      .filter((key) => key.startsWith('dev:'))
      .sort(),
    ...Object.keys(scripts)
      .filter((key) => key.startsWith('preview:'))
      .sort(),
  ];

  for (const key of priorities) {
    if (scripts[key]) {
      return key;
    }
  }

  return null;
}

function extractPortFromCommand(command: string): number | null {
  const patterns = [
    /--port(?:=|\s+)(\d+)/i,
    /-p\s+(\d+)/i,
    /\bPORT=(\d+)/i,
    /\b--listen(?:=|\s+)[^:\s]+:(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function addEvidence<T>(
  target: EvidenceCandidate<T>[],
  candidate: EvidenceCandidate<T>,
): void {
  if (!candidate.value) return;
  const duplicate = target.find(
    (item) =>
      item.value === candidate.value && item.source === candidate.source,
  );
  if (!duplicate) target.push(candidate);
}

function addPortEvidence(
  target: PortEvidenceCandidate[],
  candidate: PortEvidenceCandidate,
): void {
  if (!candidate.value) return;
  const duplicate = target.find(
    (item) =>
      item.value === candidate.value &&
      item.protocol === candidate.protocol &&
      item.source === candidate.source,
  );
  if (!duplicate) target.push(candidate);
}
