<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailOverviewTab' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
  <section v-if="!ctx.workflowOnlyMode && ctx.tab === 'overview'" class="space-y-6">
    <div class="grid gap-4 md:grid-cols-3">
      <div class="panel-card p-4">
        <p class="text-xs text-muted-foreground">任务总数</p>
        <p class="mt-2 text-2xl font-semibold">{{ ctx.recentTasks.length }}</p>
      </div>
      <div class="panel-card p-4">
        <p class="text-xs text-muted-foreground">处理中</p>
        <p class="mt-2 text-2xl font-semibold">{{ ctx.runningTaskCount }}</p>
      </div>
      <div class="panel-card p-4">
        <p class="text-xs text-muted-foreground">已完成</p>
        <p class="mt-2 text-2xl font-semibold">{{ ctx.doneTaskCount }}</p>
      </div>
    </div>

    <div class="panel-card p-5">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold">最近任务</p>
          <p class="text-xs text-muted-foreground">按任务状态快速查看执行进度</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <RouterLink
            :to="`/projects/${ctx.project?.id ?? ''}/goals`"
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
          >
            需求
          </RouterLink>
          <RouterLink
            :to="`/tasks?projectId=${ctx.project?.id ?? ''}`"
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
          >
            查看全部任务
          </RouterLink>
        </div>
      </div>

      <div class="mt-4 space-y-2">
        <RouterLink
          v-for="task in ctx.recentTasks"
          :key="task.id"
          :to="{
            name: 'task-detail',
            params: { id: task.id },
            query: { projectId: task.projectId || ctx.project?.id || '' },
          }"
          class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 hover:bg-background"
        >
          <div>
            <p class="font-semibold">{{ task.title }}</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ task.id }} · {{ ctx.formatDate(task.updatedAt) }}
            </p>
          </div>
          <span
            class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
            :class="ctx.statusClassMap[task.status]"
          >
            {{ ctx.statusLabelMap[task.status] }}
          </span>
        </RouterLink>

        <div
          v-if="ctx.recentTasks.length === 0"
          class="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground"
        >
          暂无任务，点击右上角“新建任务”开始。
        </div>
      </div>
    </div>
  </section>
</template>
