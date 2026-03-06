<script setup lang="ts">
defineOptions({
  name: 'HomeView',
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">首页</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">欢迎来到 AI Native</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        这里是工作区首页。当你还没有可用项目时，会优先进入这里；选择左侧项目后，项目菜单才会显示。
      </p>
    </section>

    <section class="panel-card p-5">
      <p class="text-sm font-semibold">建议先完成以下准备</p>
      <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
        <li>1. 创建或加入业务线，明确协作范围。</li>
        <li>2. 新建项目并绑定代码仓库。</li>
        <li>3. 选择项目后，从左侧项目菜单进入任务、看板和自动化功能。</li>
      </ul>
    </section>
  </div>
</template>
