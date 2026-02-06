<script setup lang="ts">
const workflowRows = [
  { name: '默认代码修复流', steps: 5, updatedAt: '2026-02-06' },
  { name: '需求澄清与实现流', steps: 6, updatedAt: '2026-02-05' },
  { name: '回归检查流', steps: 4, updatedAt: '2026-02-04' },
]
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">工作流</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">工作流</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        管理任务执行流程模板，统一不同工具链下的步骤规范与审批节点。
      </p>
    </section>

    <section class="panel-card overflow-hidden">
      <div class="border-b border-border px-5 py-4">
        <p class="text-sm font-semibold">工作流模板</p>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[680px] text-left text-sm">
          <thead class="border-b border-border bg-background/60">
            <tr class="text-xs font-semibold text-muted-foreground">
              <th class="px-5 py-3">模板名称</th>
              <th class="px-5 py-3">步骤数</th>
              <th class="px-5 py-3">最近更新</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="row in workflowRows" :key="row.name" class="transition hover:bg-background/70">
              <td class="px-5 py-4 font-medium">{{ row.name }}</td>
              <td class="px-5 py-4 text-muted-foreground">{{ row.steps }}</td>
              <td class="px-5 py-4 text-muted-foreground">{{ row.updatedAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
