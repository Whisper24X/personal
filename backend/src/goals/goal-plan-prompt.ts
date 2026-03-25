import { PlanGranularity } from './dto/plan-granularity.enum';

const granularityHint: Record<PlanGranularity, string> = {
  [PlanGranularity.conservative]:
    '拆解偏保守，计划项数量较少，每项覆盖面较大。',
  [PlanGranularity.standard]: '标准粒度，平衡数量与可交付边界。',
  [PlanGranularity.fine]: '拆解偏细，计划项数量较多，每项聚焦单一可交付结果。',
};

/**
 * 任务计划生成：工作流风格短提示 + 上下文注入；方法论与 JSON 契约见 `.agents/skills/goal-plan/SKILL.md`。
 */
export function buildPlanGenerationPrompt(params: {
  goalTitle: string;
  goalSummary?: string | null;
  prdMarkdown: string;
  granularity?: PlanGranularity;
}): string {
  const g = params.granularity ?? PlanGranularity.standard;

  return [
    '使用 goal-plan 技能，根据下列已确认的 PRD 生成任务计划。请严格按技能中的计划项要求与 JSON 输出契约执行。',
    '',
    `【需求】${params.goalTitle}`,
    params.goalSummary ? `【摘要】${params.goalSummary}` : '',
    `【拆解粒度】${granularityHint[g]}`,
    '',
    '【PRD 全文】',
    params.prdMarkdown,
    '',
    '【输出】只输出一个 JSON 对象，键为 markdown、items（字段含义见技能）。不要输出 JSON 以外的文字。',
    '【items 必填】每一项必须包含且非空：localId、title、summary、acceptanceCriteria、suggestedPrompt，以及 dependsOnLocalIds（数组，可无前置依赖时为空数组）。summary/acceptanceCriteria/suggestedPrompt 须根据 PRD 写实质内容，禁止省略或仅写「见 PRD」。',
    '【字段名】请使用契约中的英文键名；不要使用 id、name 代替 localId、title（平台会对常见别名做兼容，但建议与契约一致）。',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
