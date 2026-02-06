<script setup lang="ts">
const servers = [
  { name: 'filesystem', status: '在线', tools: 12 },
  { name: 'github', status: '在线', tools: 8 },
  { name: 'shadcn-ui', status: '离线', tools: 5 },
]
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MCP</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">MCP 服务</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        管理模型上下文协议服务连接状态，统一工具能力的发现与调用入口。
      </p>
    </section>

    <section class="panel-card p-5">
      <div class="space-y-3">
        <article
          v-for="server in servers"
          :key="server.name"
          class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3"
        >
          <div>
            <p class="text-sm font-semibold">{{ server.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">工具数量：{{ server.tools }}</p>
          </div>
          <span
            class="rounded-full px-2 py-1 text-[10px] font-semibold"
            :class="server.status === '在线' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
          >
            {{ server.status }}
          </span>
        </article>
      </div>
    </section>
  </div>
</template>
