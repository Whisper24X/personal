<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineOptions({
  name: 'NotFoundView',
})
</script>

<template>
  <div class="h-[var(--app-viewport-height)] overflow-hidden bg-background text-foreground">
    <div class="h-full min-h-0 overflow-y-auto px-5 py-10">
      <div class="mx-auto flex min-h-full max-w-xl items-center">
        <div class="w-full space-y-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">404</p>
          <h1 class="text-3xl font-semibold tracking-tight">页面不存在</h1>
          <p class="text-sm text-muted-foreground">你访问的页面不存在，或已被移动到其他位置。</p>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <RouterLink
              to="/dashboard"
              class="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
            >
              返回仪表盘
            </RouterLink>
            <RouterLink
              to="/login"
              class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:shadow-md"
            >
              去登录
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
