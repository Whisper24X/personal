<script setup lang="ts">

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailWorkflowCopyModal' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
<Teleport to="body">
  <div
    v-if="ctx.workflowCopyModalOpen"
    class="fixed inset-0 z-[121] flex items-center justify-center p-3 sm:p-6"
    @keydown.esc.prevent.stop="ctx.closeWorkflowCopyModal"
  >
    <button
      type="button"
      aria-label="关闭复制工作流弹窗"
      class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      @click="ctx.closeWorkflowCopyModal"
    />

    <section
      aria-modal="true"
      role="dialog"
      class="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-background shadow-2xl"
    >
      <header class="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 class="text-base font-semibold">从业务线复制工作流</h2>
        <button
          type="button"
          aria-label="关闭"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
          @click="ctx.closeWorkflowCopyModal"
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

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <input
          v-model="ctx.workflowCopyKeyword"
          type="search"
          class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          placeholder="搜索业务线工作流模板"
        />

        <p
          v-if="ctx.loadingBusinessLineWorkflowTemplates"
          class="mt-3 text-sm text-muted-foreground"
        >
          加载中...
        </p>
        <p v-else-if="ctx.copyWorkflowErrorMessage" class="mt-3 text-sm text-destructive">
          {{ ctx.copyWorkflowErrorMessage }}
        </p>

        <div v-else class="mt-3 space-y-2">
          <article
            v-for="template in ctx.filteredBusinessLineWorkflowTemplates"
            :key="template.id"
            class="rounded-xl border border-border bg-background/70 px-4 py-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold">{{ template.name }}</p>
                <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {{ template.description ?? '暂无描述' }}
                </p>
                <p class="mt-2 text-[11px] text-muted-foreground">
                  节点数：{{ template.nodesJson.length }}
                </p>
              </div>
              <button
                type="button"
                class="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="ctx.copyingBusinessLineWorkflowTemplateId === template.id"
                @click="ctx.submitCopyBusinessLineWorkflowTemplate(template)"
              >
                {{
                  ctx.copyingBusinessLineWorkflowTemplateId === template.id ? '复制中...' : '复制'
                }}
              </button>
            </div>
          </article>

          <article
            v-if="ctx.filteredBusinessLineWorkflowTemplates.length === 0"
            class="rounded-xl border border-dashed border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground"
          >
            当前业务线暂无可复制的工作流模板。
          </article>
        </div>
      </div>
    </section>
  </div>
</Teleport>
</template>
