<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  MarkdownPreview,
  useProjectDocsQueryStream,
  type ProjectDocsQueryStreamMessage,
} from '@features/knowledge-base'
import { Button } from '@shared/ui/button'
import { unwrapMarkdownFence } from '@shared/utils/unwrap-markdown-fence'

defineOptions({
  name: 'GoalPrdAiChatPanel',
})

const props = defineProps<{
  projectId: string
  prdDocPath: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  apply: [content: string]
}>()

const input = ref('')
const messages = ref<ProjectDocsQueryStreamMessage[]>([])
const lastAutoAppliedAssistantId = ref<string | null>(null)

const { queryLoading, queryError, runDocsQueryStream } = useProjectDocsQueryStream()

const canSend = computed(() => {
  return (
    !props.disabled &&
    !queryLoading.value &&
    Boolean(input.value.trim()) &&
    Boolean(props.projectId?.trim()) &&
    Boolean(props.prdDocPath?.trim())
  )
})

const applyFromAssistant = (msg: ProjectDocsQueryStreamMessage) => {
  const raw = unwrapMarkdownFence(msg.content)
  emit('apply', raw)
}

watch(
  () => [props.projectId, props.prdDocPath] as const,
  () => {
    messages.value = []
    input.value = ''
    lastAutoAppliedAssistantId.value = null
  },
)

watch(
  () => queryLoading.value,
  (loading, prevLoading) => {
    if (loading) {
      return
    }
    if (prevLoading !== true) {
      return
    }
    if (queryError.value) {
      return
    }
    const lastAssistant = [...messages.value]
      .reverse()
      .find((m) => m.role === 'assistant')
    if (!lastAssistant?.content.trim() || lastAssistant.isStreaming) {
      return
    }
    if (lastAutoAppliedAssistantId.value === lastAssistant.id) {
      return
    }
    lastAutoAppliedAssistantId.value = lastAssistant.id
    applyFromAssistant(lastAssistant)
  },
)

const submit = async () => {
  const text = input.value.trim()
  if (!canSend.value || !text) {
    return
  }
  input.value = ''

  const userMessage: ProjectDocsQueryStreamMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: text,
  }
  const assistantMessage: ProjectDocsQueryStreamMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: '',
    citations: [],
    isStreaming: true,
  }
  messages.value.push(userMessage, assistantMessage)

  await runDocsQueryStream({
    projectId: props.projectId,
    payload: {
      question: text,
      mode: 'revise_current_doc',
      scope: 'current_doc',
      currentPath: props.prdDocPath,
      maxContextDocs: 6,
    },
    method: 'post',
    assistantMessage,
    errorLabel: 'AI 修订失败',
  })
}
</script>

<template>
  <div class="flex min-h-[220px] flex-col gap-2 pt-3">
    <p class="text-muted-foreground text-xs font-medium">AI 辅助修订</p>
    <p class="text-muted-foreground text-[11px] leading-snug">
      描述要如何修改 PRD；生成完成后会自动写入上方编辑器，确认后再保存。
    </p>

    <div
      class="bg-muted/15 max-h-[min(32vh,280px)] min-h-[100px] flex-1 overflow-auto rounded-md border border-border/80 p-2"
    >
      <p v-if="messages.length === 0 && !queryError" class="text-muted-foreground text-xs">
        输入修改说明后发送，AI 将基于当前 PRD 全文生成修订稿。
      </p>
      <p v-if="queryError" class="text-destructive mb-2 text-xs">{{ queryError }}</p>

      <div v-if="messages.length > 0" class="space-y-3">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[96%] rounded-lg px-2.5 py-1.5"
            :class="
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-foreground'
            "
          >
            <p class="mb-0.5 text-[10px] font-semibold opacity-80">
              {{ msg.role === 'user' ? '你' : 'AI' }}
            </p>
            <p v-if="msg.role === 'user'" class="whitespace-pre-wrap text-xs leading-relaxed">
              {{ msg.content }}
            </p>
            <div v-else class="text-xs leading-relaxed">
              <MarkdownPreview
                :content="msg.content || (msg.isStreaming ? '正在生成…' : '')"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
      <textarea
        v-model="input"
        :disabled="disabled || queryLoading"
        class="border-input bg-background focus-visible:ring-ring min-h-[72px] flex-1 resize-y rounded-md border px-2 py-1.5 text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
        placeholder="例如：补充「验收标准」小节；将用户故事按优先级重排…"
        spellcheck="false"
        @keydown.enter.exact.prevent="canSend ? submit() : undefined"
      />
      <Button
        type="button"
        class="shrink-0 sm:w-24"
        size="sm"
        :disabled="!canSend"
        @click="submit"
      >
        {{ queryLoading ? '生成中…' : '发送' }}
      </Button>
    </div>
  </div>
</template>
