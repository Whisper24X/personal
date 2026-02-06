<script setup lang="ts">
const columns = [
  {
    key: 'todo',
    name: '待处理',
    items: ['梳理任务执行权限', '设计工作流模板参数', '补充产物预览类型'],
  },
  {
    key: 'doing',
    name: '开发中',
    items: ['重构左侧导航结构', '接入任务详情实时日志'],
  },
  {
    key: 'review',
    name: '待审核',
    items: ['任务对话页交互走查', '看板状态流转逻辑验收'],
  },
  {
    key: 'done',
    name: '已完成',
    items: ['统一主题色变量', '项目详情页指标卡改版'],
  },
]
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">看板</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">项目看板</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        通过看板追踪需求推进状态，保持从规划到执行的可视化节奏。
      </p>
    </section>

    <section class="grid gap-4 xl:grid-cols-4">
      <article v-for="column in columns" :key="column.key" class="panel-card p-4">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <h2 class="text-sm font-semibold">{{ column.name }}</h2>
          <span class="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
            {{ column.items.length }}
          </span>
        </div>

        <div class="mt-3 space-y-2">
          <div
            v-for="item in column.items"
            :key="item"
            class="rounded-xl border border-border bg-background/75 px-3 py-2 text-sm"
          >
            {{ item }}
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
