<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '@/hooks'

const density = ref<'comfortable' | 'compact'>('comfortable')
const { logout } = useAuth()

const onLogout = () => {
  logout()
}
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">工作区</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">设置</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        调整默认密度、通知策略和工作区偏好设置。
      </p>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <div class="panel-card p-5">
        <p class="text-sm font-semibold">界面密度</p>
        <p class="mt-2 text-xs text-muted-foreground">紧凑模式更适合表格密集和日志密集场景。</p>
        <div class="mt-4 flex gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="density = 'comfortable'"
          >
            舒适
          </button>
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="density = 'compact'"
          >
            紧凑
          </button>
        </div>
        <p class="mt-3 text-xs text-muted-foreground">当前模式：{{ density === 'comfortable' ? '舒适' : '紧凑' }}</p>
      </div>

      <div class="panel-card p-5">
        <p class="text-sm font-semibold">通知设置</p>
        <p class="mt-2 text-xs text-muted-foreground">任务成功或失败时发送提醒（后续可接后端配置）。</p>
        <div class="mt-4 flex items-center justify-between">
          <span class="text-xs text-muted-foreground">邮件通知</span>
          <span class="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">已开启</span>
        </div>
      </div>
    </section>

    <section class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm font-semibold">账号与会话</p>
          <p class="mt-1 text-xs text-muted-foreground">如需切换账号，可在此退出当前登录状态。</p>
        </div>
        <RouterLink
          to="/login"
          class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
          @click="onLogout"
        >
          退出登录
        </RouterLink>
      </div>
    </section>
  </div>
</template>
