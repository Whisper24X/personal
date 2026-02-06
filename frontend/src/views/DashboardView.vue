<script setup lang="ts">
const stats = [
  { label: '运行中任务', value: '3', hint: '较昨日 +1' },
  { label: '今日完成', value: '12', hint: '成功率 92%' },
  { label: '产物数量', value: '46', hint: '含代码与报告' },
]
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">仪表盘</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">项目仪表盘</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        统一查看项目执行状态、关键指标与近期活动，帮助你快速进入当前工作上下文。
      </p>
    </section>

    <section class="grid gap-4 md:grid-cols-3">
      <article v-for="item in stats" :key="item.label" class="panel-card p-4">
        <p class="text-xs text-muted-foreground">{{ item.label }}</p>
        <p class="mt-2 text-2xl font-semibold">{{ item.value }}</p>
        <p class="mt-3 text-xs text-muted-foreground">{{ item.hint }}</p>
      </article>
    </section>

    <section class="panel-card p-5">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">最近活动</p>
        <button
          class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-sm"
          type="button"
        >
          查看全部
        </button>
      </div>

      <div class="mt-4 space-y-2 text-sm">
        <div class="rounded-xl border border-border bg-background/70 px-4 py-3">
          10:21 · 任务 t-008 执行成功，已上传 `report.md`
        </div>
        <div class="rounded-xl border border-border bg-background/70 px-4 py-3">
          09:54 · 看板卡片「重构日志面板」移动到“开发中”
        </div>
        <div class="rounded-xl border border-border bg-background/70 px-4 py-3">
          09:10 · 自动化「晨间状态检查」已触发
        </div>
      </div>
    </section>
  </div>
</template>
