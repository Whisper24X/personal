<script setup lang="ts">
import type { Mcp } from '@/types/api/mcps'

defineOptions({
  name: 'BlmMcpJsonPreviewModal',
})

defineProps<{
  name: string
  item: Mcp | null
  loading: boolean
  saving: boolean
  removingLocalMcpId: string
  error: string
}>()

const draft = defineModel<string>({ required: true })

const emit = defineEmits<{
  close: []
  save: []
  remove: [item: Mcp]
}>()
</script>

<template>
  <div class="fixed inset-0 z-[125] flex items-center justify-center p-3 sm:p-6">
    <button
      type="button"
      class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      aria-label="关闭 MCP JSON 预览弹窗"
      @click="emit('close')"
    />
    <section
      aria-modal="true"
      role="dialog"
      class="relative z-10 w-full max-w-3xl rounded-2xl border border-border bg-background shadow-2xl"
    >
      <header class="flex items-center justify-between border-b border-border px-4 py-3">
        <div class="space-y-1">
          <h2 class="text-base font-semibold">MCP JSON</h2>
          <p class="text-xs text-muted-foreground">{{ name }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="item"
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="删除 MCP"
            :disabled="loading || saving || removingLocalMcpId === item.id"
            @click="emit('remove', item)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
            删除
          </button>
          <button
            type="button"
            data-testid="mcp-json-preview-save"
            class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loading || saving || !draft"
            @click="emit('save')"
          >
            {{ saving ? '保存中...' : '保存' }}
          </button>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="emit('close')"
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
        </div>
      </header>
      <div class="space-y-3 px-4 py-4">
        <p v-if="loading" class="text-sm text-muted-foreground">加载 JSON 中...</p>
        <div v-else class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-muted-foreground">JSON 配置</label>
            <textarea
              v-model="draft"
              data-testid="mcp-json-preview-textarea"
              class="min-h-[48vh] w-full rounded-xl border border-border bg-muted/20 p-3 font-mono text-xs text-foreground"
            />
          </div>
        </div>
        <p v-if="!loading && error" class="text-sm text-destructive">{{ error }}</p>
      </div>
    </section>
  </div>
</template>
