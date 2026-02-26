<script setup lang="ts">
defineOptions({
  name: 'AboutView',
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">关于</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">产品说明</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        AI Native 是面向工程团队的任务执行控制台，聚合项目管理、任务编排、日志追踪与自动化能力。
      </p>
    </section>

    <section class="panel-card p-5">
      <p class="text-sm font-semibold">核心能力</p>
      <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
        <li>项目维度的上下文隔离与权限控制</li>
        <li>任务执行全链路可视化（状态、日志、产物）</li>
        <li>可扩展的技能与 MCP 工具接入</li>
      </ul>
    </section>
  </div>
</template>
