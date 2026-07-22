import type {
  EvidenceCandidate,
  PortEvidenceCandidate,
  RepoFacts,
  RunnerProtocol,
} from './repo-facts-collector';

export interface ServiceCandidate {
  id: string;
  repoPrefix: string;
  name: string;
  workdir?: EvidenceCandidate<string>;
  command?: EvidenceCandidate<string>;
  port?: PortEvidenceCandidate;
  protocol: RunnerProtocol;
  confidence: number;
  previewCapable: boolean;
  evidence: string[];
  warnings: string[];
  rejectReasons: string[];
}

export interface RunnerCandidateManifest {
  candidates: ServiceCandidate[];
  warnings: string[];
}

export interface AiCandidateSelection {
  selectedServiceCandidateIds: string[];
  previewServiceCandidateId?: string;
  routePreference?: 'single-root' | 'per-service';
  confidence: number;
  reasoningSummary?: string;
}

export interface RetryConstraints {
  rejectCandidateIds?: string[];
  rejectProtocols?: RunnerProtocol[];
  rejectPorts?: number[];
  requiredPreviewProtocol?: 'http' | 'ws';
  previousErrors?: string[];
}

const HTTP_LIKE_PROTOCOLS = new Set<RunnerProtocol>(['http', 'ws']);
const NON_PREVIEW_PROTOCOLS = new Set<RunnerProtocol>([
  'grpc',
  'tcp',
  'metrics',
]);
const MAX_CANDIDATES_PER_REPO = 12;
const DEFAULT_WORKDIR_CONFIDENCE = 0.7;

export function buildServiceCandidates(facts: RepoFacts[]): ServiceCandidate[] {
  return buildRunnerCandidateManifest(facts).candidates.filter(
    (candidate) => !candidate.rejectReasons.includes('missing-command'),
  );
}

export function buildRunnerCandidateManifest(
  facts: RepoFacts[],
  constraints: RetryConstraints = {},
): RunnerCandidateManifest {
  const warnings: string[] = [];
  const candidates = facts.flatMap((repo) => {
    const repoCandidates = buildServiceCandidatesForRepo(repo, constraints);
    if (repoCandidates.length === 0) {
      warnings.push(`${repo.prefix}: no service candidates generated`);
    }
    return repoCandidates;
  });

  return { candidates, warnings };
}

export function isPreviewCapableCandidate(
  candidate: ServiceCandidate,
): boolean {
  if (!candidate.port) return false;
  if (HTTP_LIKE_PROTOCOLS.has(candidate.port.protocol)) return true;
  return (
    candidate.port.protocol === 'unknown' && candidate.port.confidence >= 0.75
  );
}

export function isNonPreviewProtocol(protocol: RunnerProtocol): boolean {
  return NON_PREVIEW_PROTOCOLS.has(protocol);
}

export function buildDeterministicSelection(
  manifest: RunnerCandidateManifest,
): AiCandidateSelection | null {
  const selected: ServiceCandidate[] = [];
  const byRepo = new Map<string, ServiceCandidate[]>();

  for (const candidate of manifest.candidates) {
    if (candidate.rejectReasons.includes('missing-command')) continue;
    const repoCandidates = byRepo.get(candidate.repoPrefix) ?? [];
    repoCandidates.push(candidate);
    byRepo.set(candidate.repoPrefix, repoCandidates);
  }

  for (const repoCandidates of byRepo.values()) {
    const best =
      pickBestServiceCandidate(
        repoCandidates.filter((c) => c.previewCapable),
      ) ?? pickBestServiceCandidate(repoCandidates);
    if (best) selected.push(best);
  }

  if (selected.length === 0) return null;

  const previewCandidate = pickBestServiceCandidate(
    selected.filter((candidate) => candidate.previewCapable),
  );

  return {
    selectedServiceCandidateIds: selected.map((candidate) => candidate.id),
    previewServiceCandidateId: previewCandidate?.id,
    routePreference: previewCandidate ? 'single-root' : 'per-service',
    confidence: average(selected.map((candidate) => candidate.confidence)),
    reasoningSummary: 'Deterministic best evidence candidate selection',
  };
}

export function validateAiCandidateSelection(
  value: unknown,
  manifest: RunnerCandidateManifest,
): { selection?: AiCandidateSelection; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') {
    return { errors: ['AI selection must be an object'] };
  }

  const raw = value as Record<string, unknown>;
  const selectedIds = Array.isArray(raw.selectedServiceCandidateIds)
    ? raw.selectedServiceCandidateIds.filter(
        (id): id is string => typeof id === 'string',
      )
    : [];
  const manifestIds = new Set(
    manifest.candidates.map((candidate) => candidate.id),
  );

  if (selectedIds.length === 0) {
    errors.push('selectedServiceCandidateIds must contain at least one id');
  }
  for (const id of selectedIds) {
    if (!manifestIds.has(id))
      errors.push(`unknown service candidate id '${id}'`);
  }

  const previewServiceCandidateId =
    typeof raw.previewServiceCandidateId === 'string'
      ? raw.previewServiceCandidateId
      : typeof raw.previewService === 'string'
        ? raw.previewService
        : undefined;
  if (
    previewServiceCandidateId &&
    !manifestIds.has(previewServiceCandidateId)
  ) {
    errors.push(`unknown preview candidate id '${previewServiceCandidateId}'`);
  }
  if (
    previewServiceCandidateId &&
    !selectedIds.includes(previewServiceCandidateId)
  ) {
    errors.push(
      'previewServiceCandidateId must be included in selectedServiceCandidateIds',
    );
  }

  const confidence =
    typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0;

  if (errors.length > 0) return { errors };

  return {
    selection: {
      selectedServiceCandidateIds: [...new Set(selectedIds)],
      previewServiceCandidateId,
      routePreference:
        raw.routePreference === 'per-service' ? 'per-service' : 'single-root',
      confidence,
      reasoningSummary:
        typeof raw.reasoningSummary === 'string'
          ? raw.reasoningSummary.slice(0, 500)
          : undefined,
    },
    errors: [],
  };
}

function buildServiceCandidatesForRepo(
  repo: RepoFacts,
  constraints: RetryConstraints,
): ServiceCandidate[] {
  const workdirs = topEvidence(
    repo.workdirEvidence.length > 0
      ? repo.workdirEvidence
      : [
          {
            value: repo.prefix,
            source: 'subRepo.prefix',
            evidence: `sub-repo is mounted at ${repo.prefix}`,
            confidence: DEFAULT_WORKDIR_CONFIDENCE,
          },
        ],
    3,
  );
  const commands = topEvidence(collectCommandOptions(repo), 5);
  const ports = topEvidence(collectPortOptions(repo), 6);
  const warnings: string[] = [];
  const candidates: ServiceCandidate[] = [];

  if (workdirs.length === 0)
    warnings.push(`${repo.prefix}: no workdir evidence`);
  if (commands.length === 0)
    warnings.push(`${repo.prefix}: no start command evidence`);
  if (ports.length === 0) warnings.push(`${repo.prefix}: no port evidence`);

  for (const workdir of workdirs) {
    const commandOptions = commands.length > 0 ? commands : [undefined];
    const portOptions = ports.length > 0 ? ports : [undefined];

    for (const command of commandOptions) {
      for (const port of portOptions) {
        const candidate = createCandidate(
          repo,
          workdir,
          command,
          port,
          warnings,
        );
        if (violatesConstraints(candidate, constraints)) continue;
        candidates.push(candidate);
      }
    }
  }

  return candidates
    .sort(compareServiceCandidates)
    .slice(0, MAX_CANDIDATES_PER_REPO);
}

function createCandidate(
  repo: RepoFacts,
  workdir: EvidenceCandidate<string> | undefined,
  command: EvidenceCandidate<string> | undefined,
  port: PortEvidenceCandidate | undefined,
  warnings: string[],
): ServiceCandidate {
  const rejectReasons: string[] = [];
  if (!workdir) rejectReasons.push('missing-workdir');
  if (!command) rejectReasons.push('missing-command');
  if (!port) rejectReasons.push('missing-port');
  if (port && isNonPreviewProtocol(port.protocol)) {
    rejectReasons.push(`non-preview-protocol:${port.protocol}`);
  }

  const previewCapable = Boolean(
    port &&
      command &&
      (HTTP_LIKE_PROTOCOLS.has(port.protocol) ||
        (port.protocol === 'unknown' && port.confidence >= 0.75)),
  );
  const confidence = average(
    [workdir?.confidence, command?.confidence, port?.confidence].filter(
      (value): value is number => typeof value === 'number',
    ),
  );
  const name = slugifyPrefix(repo.prefix);
  const evidence = [
    ...(workdir ? [`workdir: ${workdir.source} (${workdir.evidence})`] : []),
    ...(command ? [`command: ${command.source} (${command.evidence})`] : []),
    ...(port
      ? [`port: ${port.source} (${port.evidence}, protocol=${port.protocol})`]
      : []),
  ];

  return {
    id: buildCandidateId(repo.prefix, workdir, command, port),
    repoPrefix: repo.prefix,
    name,
    workdir,
    command,
    port,
    protocol: port?.protocol ?? 'unknown',
    confidence,
    previewCapable,
    evidence,
    warnings,
    rejectReasons,
  };
}

function collectCommandOptions(repo: RepoFacts): EvidenceCandidate<string>[] {
  const explicit = [...repo.commandEvidence];

  if (
    repo.frameworkHints.includes('vite') ||
    repo.frameworkHints.includes('rsbuild')
  ) {
    explicit.push({
      value: repo.lockfileType === 'pnpm' ? 'pnpm run dev' : 'npm run dev',
      source: 'framework-default',
      evidence: 'vite/rsbuild framework hint',
      confidence: 0.55,
    });
  }

  if (repo.frameworkHints.includes('fastapi')) {
    const entry = repo.entryFileHints.includes('app.py') ? 'app' : 'main';
    explicit.push({
      value: `uvicorn ${entry}:app --host 0.0.0.0 --port 8000`,
      source: 'framework-default',
      evidence: 'fastapi framework hint',
      confidence: 0.62,
    });
  }

  return dedupeEvidence(explicit);
}

function collectPortOptions(repo: RepoFacts): PortEvidenceCandidate[] {
  const ports = [...repo.portEvidence];

  if (
    repo.frameworkHints.includes('vite') ||
    repo.frameworkHints.includes('rsbuild')
  ) {
    ports.push({
      value: 5173,
      protocol: 'http',
      source: 'framework-default',
      evidence: 'vite/rsbuild default dev server port',
      confidence: 0.58,
    });
  }
  if (
    repo.frameworkHints.includes('next') ||
    repo.frameworkHints.includes('nest') ||
    repo.frameworkHints.includes('nuxt') ||
    repo.frameworkHints.includes('cra')
  ) {
    ports.push({
      value: 3000,
      protocol: 'http',
      source: 'framework-default',
      evidence: 'common Node web framework default port',
      confidence: 0.55,
    });
  }
  if (repo.frameworkHints.includes('fastapi')) {
    ports.push({
      value: 8000,
      protocol: 'http',
      source: 'framework-default',
      evidence: 'uvicorn default port',
      confidence: 0.58,
    });
  }

  return dedupePortEvidence(ports).sort(comparePortEvidence);
}

function violatesConstraints(
  candidate: ServiceCandidate,
  constraints: RetryConstraints,
): boolean {
  if (constraints.rejectCandidateIds?.includes(candidate.id)) return true;
  if (
    candidate.port &&
    constraints.rejectProtocols?.includes(candidate.port.protocol)
  ) {
    return true;
  }
  if (
    candidate.port &&
    constraints.rejectPorts?.includes(candidate.port.value)
  ) {
    return true;
  }
  if (
    constraints.requiredPreviewProtocol &&
    candidate.previewCapable &&
    candidate.port?.protocol !== constraints.requiredPreviewProtocol
  ) {
    return true;
  }
  return false;
}

function compareServiceCandidates(
  left: ServiceCandidate,
  right: ServiceCandidate,
): number {
  const leftPreview = left.previewCapable ? 1 : 0;
  const rightPreview = right.previewCapable ? 1 : 0;
  if (leftPreview !== rightPreview) return rightPreview - leftPreview;
  const protocolRankDelta =
    protocolPreviewRank(right.port?.protocol) -
    protocolPreviewRank(left.port?.protocol);
  if (protocolRankDelta !== 0) return protocolRankDelta;
  return right.confidence - left.confidence;
}

function pickBestServiceCandidate(
  candidates: ServiceCandidate[],
): ServiceCandidate | undefined {
  return [...candidates].sort(compareServiceCandidates)[0];
}

function topEvidence<TCandidate extends EvidenceCandidate<unknown>>(
  candidates: TCandidate[] | undefined,
  limit: number,
): TCandidate[] {
  return [...(candidates ?? [])]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

function comparePortEvidence(
  left: PortEvidenceCandidate,
  right: PortEvidenceCandidate,
): number {
  const protocolRankDelta =
    protocolPreviewRank(right.protocol) - protocolPreviewRank(left.protocol);
  if (protocolRankDelta !== 0) return protocolRankDelta;
  return right.confidence - left.confidence;
}

function protocolPreviewRank(protocol: RunnerProtocol | undefined): number {
  switch (protocol) {
    case 'http':
      return 5;
    case 'ws':
      return 4;
    case 'unknown':
      return 3;
    case 'metrics':
      return 2;
    case 'tcp':
      return 1;
    case 'grpc':
      return 0;
    default:
      return 0;
  }
}

function dedupeEvidence<T>(
  candidates: Array<EvidenceCandidate<T>>,
): Array<EvidenceCandidate<T>> {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${String(candidate.value)}|${candidate.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupePortEvidence(
  candidates: PortEvidenceCandidate[],
): PortEvidenceCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.value}|${candidate.protocol}|${candidate.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildCandidateId(
  prefix: string,
  workdir: EvidenceCandidate<string> | undefined,
  command: EvidenceCandidate<string> | undefined,
  port: PortEvidenceCandidate | undefined,
): string {
  const raw = [
    prefix,
    workdir?.value ?? 'no-workdir',
    command?.value ?? 'no-command',
    port ? `${port.value}/${port.protocol}` : 'no-port',
  ].join('|');
  return `${slugifyPrefix(prefix)}:${hashString(raw)}`;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function slugifyPrefix(prefix: string): string {
  return (
    prefix
      .replace(/[/\\]+/g, '-')
      .replace(/[^a-zA-Z0-9_.-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'service'
  );
}
