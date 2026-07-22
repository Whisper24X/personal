<script setup lang="ts">

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailConfigTab' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
  <section
    v-if="!ctx.workflowOnlyMode && ctx.tab === 'config'"
    class="space-y-4"
  >
    <div class="panel-card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">项目配置</p>
          <p class="mt-1 text-xs text-muted-foreground">
            配置编辑已迁移为弹窗表单，避免在页面中直接展示创建和编辑区域。
          </p>
        </div>
        <button
          v-if="ctx.canUpdateProject"
          class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          type="button"
          @click="ctx.openConfigFormModal"
        >
          编辑配置
        </button>
      </div>

      <dl
        class="mt-4 grid gap-3 rounded-xl border border-border bg-background/70 p-4 text-xs md:grid-cols-2"
      >
        <div>
          <dt class="text-muted-foreground">项目名称</dt>
          <dd class="mt-1 font-semibold text-foreground">{{ ctx.configForm.name || '-' }}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">默认分支</dt>
          <dd class="mt-1 text-foreground">{{ ctx.configForm.defaultBranch || '-' }}</dd>
        </div>
        <div class="md:col-span-2">
          <dt class="text-muted-foreground">仓库地址</dt>
          <dd class="mt-1 break-all text-foreground">{{ ctx.configForm.gitUrl || '-' }}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Agent 执行器</dt>
          <dd class="mt-1 text-foreground">{{ ctx.configForm.agentAdapter || '-' }}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">并发上限</dt>
          <dd class="mt-1 text-foreground">{{ ctx.configForm.maxConcurrency || '-' }}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">容器环境变量</dt>
          <dd class="mt-1 text-foreground">{{ ctx.containerEnvSummary }}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">服务编排</dt>
          <dd class="mt-1 text-foreground">自动生成</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
