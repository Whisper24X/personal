import { PlanGranularity } from './dto/plan-granularity.enum';

const granularityHint: Record<PlanGranularity, string> = {
  [PlanGranularity.coarse]:
    '粗粒度：顶层功能组数量与子任务总数尽量接近，倾向每组约一条子任务，整体划分更粗。',
  [PlanGranularity.conservative]:
    '拆解偏保守：顶层功能组较少，每组内子任务可略多以覆盖较大范围。',
  [PlanGranularity.standard]: '标准粒度：功能组数量与子任务密度平衡。',
  [PlanGranularity.fine]:
    '拆解偏细：顶层功能组偏多或每组内子任务更细（实现步骤更碎）。',
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
    '使用 goal-plan 技能，根据下列已确认的 PRD 生成双层任务计划（顶层为功能组，仅子任务可物化为 Task）。请严格按技能中的要求与 JSON 输出契约执行。',
    '',
    `【需求】${params.goalTitle}`,
    params.goalSummary ? `【摘要】${params.goalSummary}` : '',
    `【拆解粒度】${granularityHint[g]}`,
    '',
    '【PRD 全文】',
    params.prdMarkdown,
    '',
    '【输出】只输出一个 JSON 对象，键为 markdown、items。不要输出 JSON 以外的文字。',
    '【items】每项须含 localId、title、summary、acceptanceCriteria、suggestedPrompt、dependsOnLocalIds，以及非空数组 subTasks。',
    '【subTasks】每项须含 subLocalId（全局唯一）、title、summary、acceptanceCriteria、suggestedPrompt、dependsOnSubLocalIds；子任务才是后续新建 Task 的单元。',
    '【实质内容】summary/acceptanceCriteria/suggestedPrompt 须根据 PRD 撰写，禁止省略或仅写「见 PRD」。',
    '【字段名】请使用契约中的英文键名；不要使用 id、name 代替 localId、title（平台会对常见别名做兼容，但建议一致）。',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
