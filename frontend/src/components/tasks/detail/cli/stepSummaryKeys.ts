import type { InjectionKey, Ref } from 'vue'

/** 步骤 AI 短标题：id -> 摘要文案（已由服务端截断，前端再 clip 一次） */
export const assistantStepSummariesKey: InjectionKey<Ref<Record<string, string>>> = Symbol(
  'assistantStepSummaries',
)
