<script setup lang="ts">
import { computed, type Component } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import CursorAgentRenderer from './cursor-agent/Renderer.vue'
import ClaudeCodeRenderer from './claude-code/Renderer.vue'
import CodexRenderer from './codex/Renderer.vue'
import OpencodeRenderer from './opencode/Renderer.vue'
import GeminiRenderer from './gemini/Renderer.vue'
import FallbackRenderer from './fallback/Renderer.vue'

const props = defineProps<{
  agentCliId: string
  messages: TaskMessage[]
  /** 与任务详情页一致，用于用户/助手消息展示完整发送时间 */
  formatDate?: (value?: string) => string
}>()

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
  <component :is="rendererComponent" :messages="messages" :format-date="formatDate" />
</template>
