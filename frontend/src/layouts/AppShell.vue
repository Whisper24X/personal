<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="flex min-h-screen">
      <aside
        class="flex w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground"
      >
        <div class="flex items-center gap-3 px-5 py-6">
          <div
            class="grid h-10 w-10 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
          >
            AI
          </div>
          <div>
            <div class="text-sm font-semibold">AI Native</div>
            <div class="text-xs text-muted-foreground">Workspace</div>
          </div>
        </div>

        <nav class="flex flex-1 flex-col gap-1 px-4">
          <RouterLink
            to="/"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            exact-active-class="bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          >
            Dashboard
          </RouterLink>
          <RouterLink
            to="/about"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            active-class="bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          >
            Settings
          </RouterLink>
        </nav>

        <div class="px-4 pb-6">
          <div
            class="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4 text-xs text-muted-foreground"
          >
            Syncing your design system with motion, tokens, and UI primitives.
          </div>
        </div>
      </aside>

      <div class="flex min-h-screen flex-1 flex-col">
        <header
          class="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur"
        >
          <div class="flex h-16 items-center justify-between px-6">
            <div class="flex items-center gap-3">
              <div
                class="grid h-9 w-9 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground"
              >
                WS
              </div>
              <div>
                <div class="text-sm font-semibold">AI Native Studio</div>
                <div class="text-xs text-muted-foreground">
                  System design in progress
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                type="button"
              >
                New Space
              </button>
              <button
                class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                type="button"
              >
                Share
              </button>
            </div>
          </div>
        </header>

        <main class="flex-1">
          <div class="container py-8">
            <slot />
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
