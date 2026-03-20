<script setup lang="ts">
import { computed, provide, type Component } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import CursorAgentRenderer from './cursor-agent/Renderer.vue'
import ClaudeCodeRenderer from './claude-code/Renderer.vue'
import CodexRenderer from './codex/Renderer.vue'
import OpencodeRenderer from './opencode/Renderer.vue'
import GeminiRenderer from './gemini/Renderer.vue'
import FallbackRenderer from './fallback/Renderer.vue'
import { assistantStepSummariesKey } from './stepSummaryKeys'
import { useAssistantStepSummaries } from './useAssistantStepSummaries'

const props = defineProps<{
  agentCliId: string
  messages: TaskMessage[]
  taskId?: string
  taskNodeId?: string | null
}>()

const { summaryById } = useAssistantStepSummaries(
  () => props.taskId,
  () => props.taskNodeId,
  () => props.agentCliId,
  () => props.messages,
)
provide(assistantStepSummariesKey, summaryById)

const rendererMap: Record<string, Component> = {
  'cursor-agent': CursorAgentRenderer,
  'cursor': CursorAgentRenderer,
  'claude-code': ClaudeCodeRenderer,
  'codex': CodexRenderer,
  'opencode': OpencodeRenderer,
  'gemini': GeminiRenderer,
  'gemini-cli': GeminiRenderer,
}

const rendererComponent = computed(() => rendererMap[props.agentCliId] || FallbackRenderer)
</script>

<template>
  <component :is="rendererComponent" :messages="messages" />
</template>
