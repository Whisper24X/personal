<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/hooks'

const router = useRouter()
const route = useRoute()
const { login, loading: isLoading, error } = useAuth()

const email = ref('demo@example.com')
const password = ref('password')

const onSubmit = async () => {
  try {
    await login({
      email: email.value,
      password: password.value,
    })

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.push(redirect)
  } catch (exception) {
    void exception
  }
}
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-sidebar text-foreground">
    <div aria-hidden="true" class="pointer-events-none absolute inset-0">
      <div class="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary/16 blur-3xl" />
      <div class="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-secondary/16 blur-3xl" />
    </div>

    <div class="relative mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10">
      <div class="w-full space-y-6">
        <div class="space-y-2">
          <div
            class="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
          >
            AI
          </div>
          <h1 class="text-3xl font-semibold tracking-tight">登录</h1>
          <p class="text-sm text-muted-foreground">AI Native 平台：项目、任务、工作流与 Agent 执行控制台。</p>
        </div>

        <div v-if="error" class="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <p class="text-sm font-semibold text-destructive">无法登录</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ error }}</p>
        </div>

        <form
          class="space-y-4 rounded-2xl border border-border bg-card/95 p-6 shadow-lg backdrop-blur"
          @submit.prevent="onSubmit"
        >
          <label class="block space-y-2">
            <span class="text-xs font-semibold text-muted-foreground">邮箱</span>
            <input
              v-model="email"
              autocomplete="email"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
              placeholder="you@company.com"
              type="email"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-xs font-semibold text-muted-foreground">密码</span>
            <input
              v-model="password"
              autocomplete="current-password"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
              type="password"
            />
          </label>

          <button
            class="flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isLoading"
            type="submit"
          >
            {{ isLoading ? '登录中...' : '登录' }}
          </button>

          <p class="text-xs text-muted-foreground">提示：这是演示登录页，后续可接入后端认证 API。</p>
        </form>
      </div>
    </div>
  </div>
</template>
