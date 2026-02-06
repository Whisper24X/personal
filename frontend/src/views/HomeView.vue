<template>
  <div class="space-y-8">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Overview
      </p>
      <h1 class="text-3xl font-semibold tracking-tight">AI Native Dashboard</h1>
      <p class="max-w-2xl text-sm text-muted-foreground">
        Track your product decisions, motion system, and component coverage in one
        workspace.
      </p>
    </section>

    <section class="grid gap-4 md:grid-cols-3">
      <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p class="text-xs text-muted-foreground">Active Spaces</p>
        <p class="mt-2 text-2xl font-semibold">6</p>
        <p class="mt-3 text-xs text-muted-foreground">+2 synced this week</p>
      </div>
      <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p class="text-xs text-muted-foreground">Components</p>
        <p class="mt-2 text-2xl font-semibold">48</p>
        <p class="mt-3 text-xs text-muted-foreground">12 need review</p>
      </div>
      <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p class="text-xs text-muted-foreground">Motion Tokens</p>
        <p class="mt-2 text-2xl font-semibold">18</p>
        <p class="mt-3 text-xs text-muted-foreground">3 pending experiments</p>
      </div>
    </section>

    <section class="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div class="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold">Design System Tasks</p>
            <p class="text-xs text-muted-foreground">Today</p>
          </div>
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
          >
            Add Task
          </button>
        </div>
        <div class="mt-4 space-y-3 text-sm">
          <div
            class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3"
          >
            <span>Audit sidebar spacing &amp; tokens</span>
            <span class="text-xs text-muted-foreground">10:30</span>
          </div>
          <div
            class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3"
          >
            <span>Define motion easing presets</span>
            <span class="text-xs text-muted-foreground">13:00</span>
          </div>
          <div
            class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3"
          >
            <span>Shadcn-vue button variants</span>
            <span class="text-xs text-muted-foreground">15:10</span>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p class="text-sm font-semibold">Focus</p>
          <p class="mt-2 text-xs text-muted-foreground">
            Keep the layout lean, highlight primary actions, and reserve animation
            for state transitions.
          </p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p class="text-sm font-semibold">Recent</p>
          <ul class="mt-3 space-y-2 text-xs text-muted-foreground">
            <li>Updated sidebar accent scale</li>
            <li>Refined radius tokens</li>
            <li>Mapped motion curves</li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>
