import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

export type WorkflowNodeDefinition = {
  name: string;
  promptTemplate: string;
  loopEnabled: boolean;
  maxLoops: number;
};

export type WorkflowDefinition = {
  path: string;
  rawContent: string;
  nodes: WorkflowNodeDefinition[];
};

export const DEFAULT_SUPERPOWERS_WORKFLOW_PATH = "<default-superpowers-workflow>";

const DEFAULT_SUPERPOWERS_WORKFLOW = `## Agents 默认执行流程

- \`SuperpowersPlanAndImplement\`

## 节点 Prompt 模板

### SuperpowersPlanAndImplement

\`\`\`text
Use the available Superpowers skills to complete this task from the prepared workspace.

Required approach:
1. Use brainstorming only when requirements need clarification; otherwise proceed with the smallest reasonable assumptions.
2. Use writing-plans or executing-plans to organize the work.
3. Use test-driven-development for behavior changes and bug fixes.
4. Use verification-before-completion before reporting completion.

Task:
{{taskPrompt}}

Project context:
- Task: {{taskTitle}}
- Branch: {{gitBranch}}
- Primary repo: {{gitWorktreePath}}
- Workspace: {{workspacePath}}
- Repositories:
{{reposList}}

Execution requirements:
1. Work directly in the listed repository paths.
2. Do not ask the user questions unless the task is blocked.
3. If information is missing, make the smallest safe assumption and record it in the final summary.
4. Run focused verification before finishing.
\`\`\`

- \`loopEnabled: false\`
- \`maxLoops: 1\`
`;

const DEFAULT_WORKFLOW_HEADINGS = [
  "## Agents 默认执行流程",
  "## 推荐节点串联顺序"
];

export async function loadWorkflowDefinition(
  workspacePath: string,
  workflowPromptsPath?: string
): Promise<WorkflowDefinition> {
  const candidates = workflowPromptCandidates(workspacePath, workflowPromptsPath);
  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) {
      continue;
    }
    const rawContent = await readFile(candidate, "utf8");
    if (!rawContent.trim()) {
      continue;
    }
    const nodes = parseWorkflowDefinition(rawContent);
    return {
      path: candidate,
      rawContent,
      nodes
    };
  }
  return {
    path: DEFAULT_SUPERPOWERS_WORKFLOW_PATH,
    rawContent: DEFAULT_SUPERPOWERS_WORKFLOW,
    nodes: parseWorkflowDefinition(DEFAULT_SUPERPOWERS_WORKFLOW)
  };
}

export async function validateWorkflowContent(workflowPromptsPath: string): Promise<void> {
  const rawContent = await readFile(workflowPromptsPath, "utf8");
  if (!rawContent.trim()) {
    throw new Error("WORKFLOW_PROMPTS.md is empty");
  }
  const nodes = parseWorkflowDefinition(rawContent);
  if (nodes.length === 0) {
    throw new Error("No workflow nodes found in WORKFLOW_PROMPTS.md");
  }
}

export function renderWorkflowTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/{{(\w+)}}/g, (_match, key: string) => variables[key] ?? "");
}

function workflowPromptCandidates(workspacePath: string, workflowPromptsPath?: string): string[] {
  const candidates: string[] = [];
  if (workflowPromptsPath) {
    candidates.push(workflowPromptsPath);
  }
  candidates.push(
    join(workspacePath, "WORKFLOW_PROMPTS.md"),
    join(workspacePath, "knowledge", "WORKFLOW_PROMPTS.md")
  );
  return candidates;
}

function parseWorkflowDefinition(content: string): WorkflowNodeDefinition[] {
  const orderedNodeNames = resolveOrderedWorkflowNodeNames(content);
  if (orderedNodeNames.length === 0) {
    throw new Error("No workflow nodes found in WORKFLOW_PROMPTS.md default workflow section");
  }
  return orderedNodeNames.map((nodeName) => ({
    name: nodeName,
    promptTemplate: extractNodePromptTemplate(content, nodeName),
    ...extractNodeLoopConfig(content, nodeName)
  }));
}

function resolveOrderedWorkflowNodeNames(content: string): string[] {
  for (const heading of DEFAULT_WORKFLOW_HEADINGS) {
    try {
      const section = extractMarkdownSection(content, heading, 2, "WORKFLOW_PROMPTS.md");
      const nodeNames = extractOrderedWorkflowNodeNames(section);
      if (nodeNames.length > 0) {
        return nodeNames;
      }
    } catch {
      continue;
    }
  }
  return [];
}

function extractMarkdownSection(content: string, heading: string, level: 2 | 3, fileName: string): string {
  const startIndex = content.indexOf(heading);
  if (startIndex === -1) {
    throw new Error(`Missing ${heading} section in ${fileName}`);
  }
  const afterStart = content.slice(startIndex);
  const boundaryPattern = level === 2 ? /\n##\s+/ : /\n###\s+/;
  const nextHeadingMatch = afterStart.slice(heading.length).match(boundaryPattern);
  const endIndex =
    nextHeadingMatch && typeof nextHeadingMatch.index === "number"
      ? heading.length + nextHeadingMatch.index + 1
      : afterStart.length;
  return afterStart.slice(0, endIndex).trim();
}

function extractOrderedWorkflowNodeNames(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.match(/^\s*(?:[-*]\s+|(?:\d+)\.\s+)`([^`]+)`\s*$/)?.[1]?.trim() ?? null)
    .filter((value): value is string => Boolean(value));
}

function extractNodePromptTemplate(content: string, nodeName: string): string {
  const section = extractNodeSection(content, nodeName);
  const codeBlockMatch = section.match(/```text\s*\n([\s\S]*?)\n```/);
  if (!codeBlockMatch?.[1]) {
    throw new Error(`Missing prompt template for ${nodeName} in WORKFLOW_PROMPTS.md`);
  }
  return codeBlockMatch[1].trim();
}

function extractNodeLoopConfig(content: string, nodeName: string): Pick<WorkflowNodeDefinition, "loopEnabled" | "maxLoops"> {
  const section = extractNodeSection(content, nodeName);
  const loopEnabledMatch = section.match(/[-*]\s+`?loopEnabled:\s*(true|false)`?/i)?.[1];
  const maxLoopsMatch = section.match(/[-*]\s+`?maxLoops:\s*(\d+)`?/i)?.[1];
  const loopEnabled = loopEnabledMatch?.toLowerCase() === "true";
  const parsedMaxLoops = Number(maxLoopsMatch ?? "1");
  return {
    loopEnabled,
    maxLoops: Number.isFinite(parsedMaxLoops) && parsedMaxLoops > 0 ? parsedMaxLoops : 1
  };
}

function extractNodeSection(content: string, nodeName: string): string {
  const heading = `### ${nodeName}`;
  return extractMarkdownSection(content, heading, 3, "WORKFLOW_PROMPTS.md");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
