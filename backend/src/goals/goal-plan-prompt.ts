import { PlanGranularity } from './dto/plan-granularity.enum';

const granularityHint: Record<PlanGranularity, string> = {
  [PlanGranularity.conservative]:
    '拆解偏保守，计划项数量较少，每项覆盖面较大。',
  [PlanGranularity.standard]: '标准粒度，平衡数量与可交付边界。',
  [PlanGranularity.fine]: '拆解偏细，计划项数量较多，每项聚焦单一可交付结果。',
};

/**
 * 拆解计划生成：工作流风格短提示 + 上下文注入；方法论与 JSON 契约见 `.agents/skills/goal-plan/SKILL.md`。
 */
export function buildPlanGenerationPrompt(params: {
  goalTitle: string;
  goalSummary?: string | null;
  prdMarkdown: string;
  granularity?: PlanGranularity;
}): string {
  const g = params.granularity ?? PlanGranularity.standard;

  return [
    '使用 goal-plan 技能，根据下列已确认的 PRD 生成拆解计划。请严格按技能中的计划项要求与 JSON 输出契约执行。',
    '',
    `【Goal】${params.goalTitle}`,
    params.goalSummary ? `【摘要】${params.goalSummary}` : '',
    `【拆解粒度】${granularityHint[g]}`,
    '',
    '【PRD 全文】',
    params.prdMarkdown,
    '',
    '【输出】只输出一个 JSON 对象，键为 markdown、items（字段含义见技能）。不要输出 JSON 以外的文字。',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
