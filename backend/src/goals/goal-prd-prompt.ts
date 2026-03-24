/**
 * PRD 生成：工作流风格短提示 + 上下文注入；方法论与章节约束见 `.agents/skills/goal-prd/SKILL.md`。
 */
export function buildPrdGenerationPrompt(params: {
  goalTitle: string;
  goalSummary?: string | null;
  sourceBlocks: string[];
  extraNotes?: string | null;
}): string {
  const sources =
    params.sourceBlocks.length > 0
      ? params.sourceBlocks.join('\n\n---\n\n')
      : '（当前未提供输入资料正文，请仅基于标题与摘要推导，并在「风险与待确认项」中明确标注假设。）';

  const notes = params.extraNotes?.trim()
    ? `\n\n【用户补充备注】\n${params.extraNotes.trim()}`
    : '';

  return [
    '使用 goal-prd 技能，根据下列输入生成 PRD。请严格按技能中的章节标题、写作原则与 JSON 输出契约执行。',
    '',
    `【Goal 标题】${params.goalTitle}`,
    params.goalSummary ? `【Goal 摘要】${params.goalSummary}` : '',
    '',
    '【输入资料】',
    sources,
    notes,
    '',
    '【输出】只输出一个 JSON 对象，键为 markdown、uncertainPoints（含义与类型见技能）。不要输出 JSON 以外的文字。',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
