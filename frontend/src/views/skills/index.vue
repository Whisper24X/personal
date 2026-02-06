<script setup lang="ts">
const skills = [
  { name: 'openspec-apply-change', scope: '实施', status: '已启用' },
  { name: 'openspec-verify-change', scope: '验证', status: '已启用' },
  { name: 'ui-ux-pro-max', scope: '设计', status: '已启用' },
]
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">技能（Skill）</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">Skill 管理</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        查看和管理当前工作区可用技能，确保执行任务时能力集可控且可追溯。
      </p>
    </section>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="item in skills" :key="item.name" class="panel-card p-4">
        <p class="text-sm font-semibold">{{ item.name }}</p>
        <p class="mt-2 text-xs text-muted-foreground">分类：{{ item.scope }}</p>
        <span class="mt-4 inline-flex rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
          {{ item.status }}
        </span>
      </article>
    </section>
  </div>
</template>
