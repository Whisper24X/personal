<script setup lang="ts">
import type { WorkflowTemplate } from '@/types/api/workflow'

defineOptions({ name: 'BlmCopyPlatformWorkflowModal' })

defineProps<{
  loading: boolean
  templates: WorkflowTemplate[]
  copyingTemplateId: string
}>()

const emit = defineEmits<{
  close: []
  copy: [templateId: string]
}>()
</script>

<template>
  <div class="fixed inset-0 z-[125] flex items-center justify-center p-3 sm:p-6">
    <button
      type="button"
      class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      aria-label="关闭复制平台工作流弹窗"
      @click="emit('close')"
    />
    <section
      aria-modal="true"
      role="dialog"
      class="relative z-10 flex max-h-[min(32rem,90vh)] w-full max-w-2xl flex-col rounded-2xl border border-border bg-background shadow-2xl"
    >
      <header class="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 class="text-base font-semibold">复制平台工作流</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">选择一条平台工作流，复制为当前业务线的工作流</p>
        </div>
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
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <p v-if="loading" class="text-sm text-muted-foreground">加载中...</p>
        <p
          v-else-if="!templates.length"
          class="text-sm text-muted-foreground"
        >
          暂无可用的平台工作流。请管理员在系统「平台工作流」中配置。
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="template in templates"
            :key="template.id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/60 px-3 py-2.5"
          >
            <div class="min-w-0 flex-1 text-left">
              <p class="truncate text-sm font-semibold">{{ template.name }}</p>
              <p class="mt-0.5 truncate text-xs text-muted-foreground">
                {{ template.description || '暂无描述' }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span>节点数 {{ template.nodesJson.length }}</span>
              <button
                :data-testid="`copy-platform-wf-${template.id}`"
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="copyingTemplateId === template.id"
                @click="emit('copy', template.id)"
              >
                {{ copyingTemplateId === template.id ? '复制中...' : '复制' }}
              </button>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
