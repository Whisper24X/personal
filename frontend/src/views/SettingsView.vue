<script setup lang="ts">
import { ref } from 'vue'

const density = ref<'comfortable' | 'compact'>('comfortable')
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Workspace
      </p>
      <h1 class="text-3xl font-semibold tracking-tight">Settings</h1>
      <p class="max-w-2xl text-sm text-muted-foreground">
        Control default density, notifications, and other workspace preferences.
      </p>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <div class="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p class="text-sm font-semibold">Density</p>
        <p class="mt-2 text-xs text-muted-foreground">
          Compact mode is useful for data tables and log-heavy pages.
        </p>
        <div class="mt-4 flex gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="density = 'comfortable'"
          >
            Comfortable
          </button>
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="density = 'compact'"
          >
            Compact
          </button>
        </div>
        <p class="mt-3 text-xs text-muted-foreground">Current: {{ density }}</p>
      </div>

      <div class="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p class="text-sm font-semibold">Notifications</p>
        <p class="mt-2 text-xs text-muted-foreground">
          Receive alerts when tasks complete or fail. (Wire to backend later.)
        </p>
        <div class="mt-4 flex items-center justify-between">
          <span class="text-xs text-muted-foreground">Email</span>
          <span class="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
            Enabled
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

