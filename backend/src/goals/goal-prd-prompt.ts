/**
 * PRD 生成：工作流风格短提示；方法论与章节约束见 `.agents/skills/prototype-to-prd/SKILL.md`（含 AINative Goal 集成节）。
 */
export function buildPrdGenerationPrompt(params: {
  goalTitle: string;
  goalSummary?: string | null;
  goalId: string;
  hasSourceDocs: boolean;
  extraNotes?: string | null;
}): string {
  const inputRoot = `docs/goals/${params.goalId}/input`;
  const inputHint = params.hasSourceDocs
    ? `请在该目录下用 Glob 扫描全部文件（含子目录），按技能 Step 1–4 读取原型与上下文文档并生成 PRD。`
    : `当前 Goal 未关联任何输入资料文件；该目录可能为空。请仅基于 Goal 标题与摘要推导，并在第 7 节与 uncertainPoints 中明确标注假设。`;

  const notes = params.extraNotes?.trim()
    ? `\n\n【用户补充备注】\n${params.extraNotes.trim()}`
    : '';

  return [
    '使用 prototype-to-prd 技能中的「AINative Goal PRD 生成」约定：不要写入仓库内 PRD 文件，只向 stdout 输出 JSON。',
    '',
    `【Goal 标题】${params.goalTitle}`,
    params.goalSummary ? `【Goal 摘要】${params.goalSummary}` : '',
    `【Goal ID】${params.goalId}`,
    '',
    `【原型与资料根目录】（相对仓库根目录）${inputRoot}`,
    inputHint,
    notes,
    '',
    '【输出】只输出一个 JSON 对象，键为 markdown、uncertainPoints（含义与类型见技能）。不要输出 JSON 以外的文字。',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
