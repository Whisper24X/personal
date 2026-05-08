import { promises as fs } from 'fs';
import path from 'path';

export type ArtifactValidationType =
  | 'markdown'
  | 'markdown-core'
  | 'html'
  | 'result-lines';

export interface V2NodeConvention {
  nodeName: string;
  tier: 1 | 2 | 3;
  dependencies: string[];
  expectedArtifacts: string[];
  validationType: ArtifactValidationType;
  optionalDependencies?: string[];
}

export type ArtifactFileStatus = 'valid' | 'thin' | 'missing';

export interface ArtifactValidationDetail {
  path: string;
  resolvedPath: string;
  status: ArtifactFileStatus;
  reason: string | null;
}

export interface ArtifactValidationResult {
  mode: 'v2-contract' | 'legacy-git-diff';
  valid: boolean;
  artifacts: ArtifactValidationDetail[];
  missingArtifacts: string[];
  thinArtifacts: string[];
}

export interface DependencyFileStatus {
  template: string;
  resolvedPath: string;
  status: ArtifactFileStatus;
  reason: string | null;
}

export interface DependencyStatusReport {
  nodeName: string;
  dependencies: DependencyFileStatus[];
  hasMissing: boolean;
  hasThin: boolean;
  reportText: string;
}

const V2_NODE_CONVENTIONS = new Map<string, V2NodeConvention>([
  [
    'Brainstorm',
    {
      nodeName: 'Brainstorm',
      tier: 1,
      dependencies: [],
      expectedArtifacts: ['docs/{{gitBranch}}/brainstorm.md'],
      validationType: 'markdown',
    },
  ],
  [
    'WriteMRD',
    {
      nodeName: 'WriteMRD',
      tier: 1,
      dependencies: ['docs/{{gitBranch}}/brainstorm.md'],
      expectedArtifacts: ['docs/{{gitBranch}}/MRD.md'],
      validationType: 'markdown',
    },
  ],
  [
    'WritePRD',
    {
      nodeName: 'WritePRD',
      tier: 2,
      dependencies: [
        'docs/{{gitBranch}}/brainstorm.md',
        'docs/{{gitBranch}}/MRD.md',
      ],
      expectedArtifacts: ['docs/{{gitBranch}}/PRD.md'],
      validationType: 'markdown-core',
    },
  ],
  [
    'GeneratePrototype',
    {
      nodeName: 'GeneratePrototype',
      tier: 3,
      dependencies: ['docs/{{gitBranch}}/PRD.md'],
      expectedArtifacts: ['docs/{{gitBranch}}/prototype/index.html'],
      validationType: 'html',
    },
  ],
  [
    'WriteTest',
    {
      nodeName: 'WriteTest',
      tier: 3,
      dependencies: ['docs/{{gitBranch}}/PRD.md'],
      expectedArtifacts: ['docs/{{gitBranch}}/TEST.md'],
      validationType: 'markdown-core',
      optionalDependencies: ['docs/{{gitBranch}}/prototype/index.html'],
    },
  ],
  [
    'WriteDesign',
    {
      nodeName: 'WriteDesign',
      tier: 2,
      dependencies: [
        'docs/{{gitBranch}}/PRD.md',
        'docs/{{gitBranch}}/TEST.md',
      ],
      expectedArtifacts: ['docs/{{gitBranch}}/DESIGN.md'],
      validationType: 'markdown-core',
    },
  ],
  [
    'ProjectManager',
    {
      nodeName: 'ProjectManager',
      tier: 2,
      dependencies: [
        'docs/{{gitBranch}}/PRD.md',
        'docs/{{gitBranch}}/DESIGN.md',
      ],
      expectedArtifacts: [
        'docs/{{gitBranch}}/openspecValidatorReport.md',
      ],
      validationType: 'markdown',
    },
  ],
  [
    'WriteCode',
    {
      nodeName: 'WriteCode',
      tier: 3,
      dependencies: [
        'docs/{{gitBranch}}/PRD.md',
        'docs/{{gitBranch}}/TEST.md',
        'docs/{{gitBranch}}/DESIGN.md',
      ],
      expectedArtifacts: ['docs/{{gitBranch}}/taskResult.md'],
      validationType: 'result-lines',
      optionalDependencies: [
        'docs/{{gitBranch}}/brainstorm.md',
        'docs/{{gitBranch}}/MRD.md',
      ],
    },
  ],
  [
    'ImproveCode',
    {
      nodeName: 'ImproveCode',
      tier: 3,
      dependencies: [
        'docs/{{gitBranch}}/PRD.md',
        'docs/{{gitBranch}}/TEST.md',
        'docs/{{gitBranch}}/DESIGN.md',
      ],
      expectedArtifacts: ['docs/{{gitBranch}}/improveVerifyResult.md'],
      validationType: 'result-lines',
      optionalDependencies: [
        'docs/{{gitBranch}}/brainstorm.md',
        'docs/{{gitBranch}}/MRD.md',
      ],
    },
  ],
  [
    'DocumentChanges',
    {
      nodeName: 'DocumentChanges',
      tier: 3,
      dependencies: [],
      expectedArtifacts: [
        'docs/{{gitBranch}}/apiChanges.md',
        'docs/{{gitBranch}}/moduleChanges.md',
      ],
      validationType: 'markdown',
    },
  ],
  [
    'TESTPathGuide',
    {
      nodeName: 'TESTPathGuide',
      tier: 3,
      dependencies: [
        'docs/{{gitBranch}}/PRD.md',
        'docs/{{gitBranch}}/TEST.md',
      ],
      expectedArtifacts: ['docs/{{gitBranch}}/TEST.md'],
      validationType: 'markdown-core',
    },
  ],
  [
    'TESTPlaywright',
    {
      nodeName: 'TESTPlaywright',
      tier: 3,
      dependencies: ['docs/{{gitBranch}}/TEST.md'],
      expectedArtifacts: ['docs/{{gitBranch}}/AUTOMATED_TEST.md'],
      validationType: 'markdown',
    },
  ],
]);

export function resolveV2Convention(
  nodeName: string,
): V2NodeConvention | undefined {
  return V2_NODE_CONVENTIONS.get(nodeName);
}

export function resolveArtifactPath(
  template: string,
  gitBranch: string,
): string {
  return template.replace(/\{\{gitBranch\}\}/g, gitBranch);
}

function stripWhitespace(content: string): string {
  return content.replace(/\s+/g, '').trim();
}

function countHeadings(content: string, level: number): number {
  const prefix = '#'.repeat(level) + ' ';
  return content.split('\n').filter((line) => line.trimStart().startsWith(prefix))
    .length;
}

/**
 * markdown: default (>=120 chars stripped, >=1 h2)
 * markdown-core: core docs like PRD/TEST/DESIGN (>=120 chars stripped, >=2 h2)
 */
export function validateMarkdown(
  content: string,
  type: 'markdown' | 'markdown-core',
): { valid: boolean; thin: boolean; reason: string | null } {
  const stripped = stripWhitespace(content);
  const minChars = 120;
  const minHeadings = type === 'markdown-core' ? 2 : 1;

  if (stripped.length === 0) {
    return { valid: false, thin: false, reason: 'empty file' };
  }

  const headingCount = countHeadings(content, 2);
  if (stripped.length < minChars || headingCount < minHeadings) {
    return {
      valid: false,
      thin: true,
      reason: `content too thin (${stripped.length} chars, ${headingCount} h2 headings; need >=${minChars} chars and >=${minHeadings} h2)`,
    };
  }

  return { valid: true, thin: false, reason: null };
}

export function validateHtml(
  content: string,
): { valid: boolean; thin: boolean; reason: string | null } {
  const trimmed = content.trim();
  if (!trimmed) {
    return { valid: false, thin: false, reason: 'empty file' };
  }

  const hasHtmlTag = /<html[\s>]/i.test(trimmed);
  const hasBodyTag = /<body[\s>]/i.test(trimmed);
  if (!hasHtmlTag && !hasBodyTag) {
    return {
      valid: false,
      thin: true,
      reason: 'missing <html> or <body> tag',
    };
  }

  return { valid: true, thin: false, reason: null };
}

export function validateResultLines(
  content: string,
): { valid: boolean; thin: boolean; reason: string | null } {
  const lines = content.split('\n').map((l) => l.trim());
  const statusLine = lines[0] ?? '';
  const reasonLine = lines[1] ?? '';

  if (!statusLine) {
    return { valid: false, thin: false, reason: 'missing status line' };
  }
  if (!reasonLine) {
    return {
      valid: false,
      thin: true,
      reason: 'missing reason line (line 2)',
    };
  }

  return { valid: true, thin: false, reason: null };
}

export function validateArtifactContent(
  content: string,
  validationType: ArtifactValidationType,
): { valid: boolean; thin: boolean; reason: string | null } {
  switch (validationType) {
    case 'markdown':
      return validateMarkdown(content, 'markdown');
    case 'markdown-core':
      return validateMarkdown(content, 'markdown-core');
    case 'html':
      return validateHtml(content);
    case 'result-lines':
      return validateResultLines(content);
    default:
      return { valid: true, thin: false, reason: null };
  }
}

async function readFileContent(
  filePath: string,
): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export async function validateNodeArtifacts(
  convention: V2NodeConvention,
  worktreePath: string,
  gitBranch: string,
): Promise<ArtifactValidationResult> {
  const details: ArtifactValidationDetail[] = [];
  const missingArtifacts: string[] = [];
  const thinArtifacts: string[] = [];

  for (const template of convention.expectedArtifacts) {
    const relativePath = resolveArtifactPath(template, gitBranch);
    const fullPath = path.resolve(worktreePath, relativePath);
    const content = await readFileContent(fullPath);

    if (content === null) {
      details.push({
        path: template,
        resolvedPath: relativePath,
        status: 'missing',
        reason: 'file not found',
      });
      missingArtifacts.push(relativePath);
      continue;
    }

    const result = validateArtifactContent(content, convention.validationType);
    if (!result.valid) {
      const status: ArtifactFileStatus = result.thin ? 'thin' : 'missing';
      details.push({
        path: template,
        resolvedPath: relativePath,
        status,
        reason: result.reason,
      });
      if (status === 'thin') {
        thinArtifacts.push(relativePath);
      } else {
        missingArtifacts.push(relativePath);
      }
      continue;
    }

    details.push({
      path: template,
      resolvedPath: relativePath,
      status: 'valid',
      reason: null,
    });
  }

  const valid = missingArtifacts.length === 0 && thinArtifacts.length === 0;

  return {
    mode: 'v2-contract',
    valid,
    artifacts: details,
    missingArtifacts,
    thinArtifacts,
  };
}

export async function buildDependencyStatusReport(
  convention: V2NodeConvention,
  worktreePath: string,
  gitBranch: string,
): Promise<DependencyStatusReport> {
  const allDeps = [
    ...convention.dependencies,
    ...(convention.optionalDependencies ?? []),
  ];

  if (allDeps.length === 0) {
    return {
      nodeName: convention.nodeName,
      dependencies: [],
      hasMissing: false,
      hasThin: false,
      reportText: '',
    };
  }

  const statuses: DependencyFileStatus[] = [];
  let hasMissing = false;
  let hasThin = false;

  for (const template of allDeps) {
    const relativePath = resolveArtifactPath(template, gitBranch);
    const fullPath = path.resolve(worktreePath, relativePath);
    const content = await readFileContent(fullPath);

    if (content === null) {
      statuses.push({
        template,
        resolvedPath: relativePath,
        status: 'missing',
        reason: 'file not found',
      });
      hasMissing = true;
      continue;
    }

    const ext = path.extname(relativePath).toLowerCase();
    let validationResult: { valid: boolean; thin: boolean; reason: string | null };

    if (ext === '.html' || ext === '.htm') {
      validationResult = validateHtml(content);
    } else {
      const isCoreDoc = ['PRD.md', 'TEST.md', 'DESIGN.md'].some((name) =>
        relativePath.endsWith(name),
      );
      validationResult = validateMarkdown(
        content,
        isCoreDoc ? 'markdown-core' : 'markdown',
      );
    }

    if (!validationResult.valid) {
      const fileStatus: ArtifactFileStatus = validationResult.thin
        ? 'thin'
        : 'missing';
      statuses.push({
        template,
        resolvedPath: relativePath,
        status: fileStatus,
        reason: validationResult.reason,
      });
      if (fileStatus === 'thin') {
        hasThin = true;
      } else {
        hasMissing = true;
      }
      continue;
    }

    statuses.push({
      template,
      resolvedPath: relativePath,
      status: 'valid',
      reason: null,
    });
  }

  const lines = [
    `--- 依赖状态报告 [${convention.nodeName}] ---`,
    ...statuses.map(
      (s) =>
        `- ${s.resolvedPath}: ${s.status}${s.reason ? ` (${s.reason})` : ''}`,
    ),
    '---',
  ];

  return {
    nodeName: convention.nodeName,
    dependencies: statuses,
    hasMissing,
    hasThin,
    reportText: lines.join('\n'),
  };
}
