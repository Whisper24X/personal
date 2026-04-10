<script setup lang="ts">

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailHeader' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
<section v-if="!ctx.workflowOnlyMode" class="space-y-2">
  <div class="flex items-center gap-2 text-xs text-muted-foreground">
    <span>项目</span>
    <span>/</span>
    <span class="font-mono">{{ ctx.projectId }}</span>
  </div>

  <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div class="space-y-1">
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">
        {{ ctx.project?.name ?? '项目详情' }}
      </h1>
      <p class="text-sm text-muted-foreground">
        <span class="font-mono text-xs">{{ ctx.project?.gitUrl ?? '-' }}</span>
        <span class="mx-2">•</span>
        <span
          class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground"
        >
          {{ ctx.project?.defaultBranch ?? '-' }}
        </span>
        <span class="mx-2">•</span>
        <span>更新于 {{ ctx.formatDate(ctx.project?.updatedAt) }}</span>
      </p>
    </div>
  </div>
</section>
</template>
