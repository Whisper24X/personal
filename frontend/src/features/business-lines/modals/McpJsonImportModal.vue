<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  submitting: boolean
  errorMessage?: string
  size?: 'default' | 'large'
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'submit', payload: Record<string, unknown>): void
}>()

const jsonText = ref('')
const validationMessage = ref('')

const resetForm = () => {
  jsonText.value = ''
  validationMessage.value = ''
}

const close = () => {
  emit('update:open', false)
}

const sectionClass = computed(() => {
  return props.size === 'large'
    ? 'relative z-10 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl'
    : 'relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl'
})

const bodyClass = computed(() => {
  return props.size === 'large'
    ? 'max-h-[calc(95vh-56px)] space-y-4 overflow-y-auto px-4 py-4'
    : 'space-y-4 px-4 py-4'
})

const submit = () => {
  if (!jsonText.value.trim()) {
    validationMessage.value = '请先粘贴 JSON 内容'
    return
  }

  try {
    const parsed = JSON.parse(jsonText.value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      validationMessage.value = 'JSON 顶层必须是对象'
      return
    }

    validationMessage.value = ''
    emit('submit', parsed as Record<string, unknown>)
  } catch {
    validationMessage.value = 'JSON 格式不合法'
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    resetForm()
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭 MCP JSON 导入弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        aria-modal="true"
        role="dialog"
        :class="sectionClass"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="text-base font-semibold">添加 MCP</h2>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        <div :class="bodyClass">
          <div>
            <label class="mb-1 block text-xs font-medium text-muted-foreground">JSON 配置</label>
            <p class="mb-1 text-xs text-muted-foreground">
              支持两种格式：`{ "mcpServers": { ... } }` 或直接 `{ "serverName": { ... } }`
            </p>
            <textarea
              v-model="jsonText"
              class="min-h-[260px] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
              placeholder="{&quot;mcpServers&quot;:{&quot;filesystem&quot;:{&quot;command&quot;:&quot;npx&quot;,&quot;args&quot;:[&quot;-y&quot;,&quot;@modelcontextprotocol/server-filesystem&quot;,&quot;/tmp&quot;]}}}"
            />
          </div>

          <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
          <p v-else-if="props.errorMessage" class="text-sm text-destructive">
            {{ props.errorMessage }}
          </p>

          <div class="flex justify-end gap-2 pt-1">
            <button
              type="button"
              class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              @click="close"
            >
              取消
            </button>
            <button
              type="button"
              class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.submitting"
              @click="submit"
            >
              {{ props.submitting ? '添加中...' : '添加' }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
