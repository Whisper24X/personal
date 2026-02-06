<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="mx-auto flex min-h-screen max-w-xl items-center px-5 py-10">
      <div class="w-full space-y-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 class="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p class="text-sm text-muted-foreground">
          The page you’re looking for doesn’t exist or was moved.
        </p>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <RouterLink
            to="/projects"
            class="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
          >
            Go to Projects
          </RouterLink>
          <RouterLink
            to="/login"
            class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:shadow-md"
          >
            Sign in
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

