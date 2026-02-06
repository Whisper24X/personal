<script setup lang="ts">
const automationRows = [
  { name: '晨间巡检', schedule: '每周一至周五 09:00', status: '启用' },
  { name: '晚间回归检查', schedule: '每天 20:30', status: '启用' },
  { name: '周报汇总', schedule: '每周五 18:00', status: '暂停' },
]
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">自动化</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">自动化</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        通过周期任务自动完成巡检、统计和提醒，降低重复操作成本。
      </p>
    </section>

    <section class="panel-card overflow-hidden">
      <div class="border-b border-border px-5 py-4">
        <p class="text-sm font-semibold">自动化任务列表</p>
      </div>

      <div class="divide-y divide-border">
        <article
          v-for="row in automationRows"
          :key="row.name"
          class="flex flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p class="text-sm font-semibold">{{ row.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">执行频率：{{ row.schedule }}</p>
          </div>
          <span
            class="inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-semibold"
            :class="row.status === '启用' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
          >
            {{ row.status }}
          </span>
        </article>
      </div>
    </section>
  </div>
</template>
