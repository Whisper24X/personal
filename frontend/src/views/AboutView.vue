<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Settings
      </p>
      <h1 class="text-3xl font-semibold tracking-tight">Workspace Preferences</h1>
      <p class="max-w-2xl text-sm text-muted-foreground">
        Control theme, density, and collaboration defaults for this workspace.
      </p>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <div class="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p class="text-sm font-semibold">Appearance</p>
        <p class="mt-2 text-xs text-muted-foreground">
          Set base theme, accent color, and default typography scale.
        </p>
        <div class="mt-4 flex gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:-translate-y-0.5 hover:shadow-md"
            type="button"
          >
            Light
          </button>
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:-translate-y-0.5 hover:shadow-md"
            type="button"
          >
            Dark
          </button>
        </div>
      </div>

      <div class="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p class="text-sm font-semibold">Collaboration</p>
        <p class="mt-2 text-xs text-muted-foreground">
          Enable presence indicators and shared cursors in review sessions.
        </p>
        <div class="mt-4 flex items-center justify-between">
          <span class="text-xs text-muted-foreground">Presence</span>
          <span class="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
            Enabled
          </span>
        </div>
      </div>
    </section>
  </div>
</template>
