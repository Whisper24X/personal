<script setup lang="ts">

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailContextTab' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
  <section v-if="!ctx.workflowOnlyMode && ctx.tab === 'context'" class="space-y-4">
    <div class="panel-card p-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">项目上下文</p>
          <p class="mt-1 text-xs text-muted-foreground">
            自动读取 README / docs / spec 目录内容，供任务执行时参考。
          </p>
        </div>
        <button
          class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="ctx.contextLoading"
          type="button"
          @click="ctx.loadProjectContext"
        >
          {{ ctx.contextLoading ? '刷新中...' : '刷新上下文' }}
        </button>
      </div>

      <div v-if="ctx.contextLoading" class="mt-4 text-sm text-muted-foreground">
        上下文加载中...
      </div>

      <template v-else-if="ctx.projectContext">
        <div class="mt-4 grid gap-3 md:grid-cols-3">
          <div class="rounded-lg border border-border bg-background/70 px-4 py-3">
            <p class="text-xs text-muted-foreground">来源</p>
            <p class="mt-1 text-sm font-semibold">
              {{ ctx.contextSourceLabelMap[ctx.projectContext.source] }}
            </p>
          </div>
          <div class="rounded-lg border border-border bg-background/70 px-4 py-3">
            <p class="text-xs text-muted-foreground">文档数量</p>
            <p class="mt-1 text-sm font-semibold">{{ ctx.projectContext.documents.length }}</p>
          </div>
          <div class="rounded-lg border border-border bg-background/70 px-4 py-3">
            <p class="text-xs text-muted-foreground">快照时间</p>
            <p class="mt-1 text-sm font-semibold">
              {{ ctx.formatDate(ctx.projectContext.generatedAt) }}
            </p>
          </div>
        </div>

        <div
          v-if="ctx.projectContext.warnings.length > 0"
          class="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-300"
        >
          <p class="text-xs font-semibold uppercase tracking-wide">读取提示</p>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-xs">
            <li v-for="warning in ctx.projectContext.warnings" :key="warning">{{ warning }}</li>
          </ul>
        </div>

        <div class="mt-4 space-y-3">
          <article
            v-for="document in ctx.projectContext.documents"
            :key="document.path"
            class="rounded-xl border border-border bg-background/70 px-4 py-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold">{{ document.title }}</p>
                <p class="mt-1 font-mono text-xs text-muted-foreground">{{ document.path }}</p>
              </div>
              <span class="text-xs text-muted-foreground">{{
                ctx.formatContextLength(document.length)
              }}</span>
            </div>

            <pre
              class="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground"
              >{{ document.preview }}</pre
            >
          </article>

          <div
            v-if="ctx.projectContext.documents.length === 0"
            class="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground"
          >
            当前没有可展示的上下文文档。
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
