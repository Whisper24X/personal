<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const email = ref('demo@example.com')
const password = ref('password')
const isLoading = ref(false)
const error = ref<string | null>(null)

const onSubmit = async () => {
  error.value = null
  isLoading.value = true
  try {
    // MVP: demo-only. Wire to `/api/v1/auth/email/login` later.
    await new Promise((r) => setTimeout(r, 400))
    await router.push('/projects')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Sign in failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10">
      <div class="w-full space-y-6">
        <div class="space-y-2">
          <div
            class="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
          >
            AI
          </div>
          <h1 class="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p class="text-sm text-muted-foreground">
            AI Native platform for projects, tasks, workflows, and agent execution.
          </p>
        </div>

        <div v-if="error" class="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <p class="text-sm font-semibold text-destructive">Unable to sign in</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ error }}</p>
        </div>

        <form class="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm" @submit.prevent="onSubmit">
          <label class="block space-y-2">
            <span class="text-xs font-semibold text-muted-foreground">Email</span>
            <input
              v-model="email"
              autocomplete="email"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
              placeholder="you@company.com"
              type="email"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-xs font-semibold text-muted-foreground">Password</span>
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
            {{ isLoading ? 'Signing in…' : 'Sign in' }}
          </button>

          <p class="text-xs text-muted-foreground">
            Tip: this is a demo screen — connect it to the backend auth API when ready.
          </p>
        </form>
      </div>
    </div>
  </div>
</template>
