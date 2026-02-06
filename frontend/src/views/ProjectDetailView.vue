<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const projectId = computed(() => String(route.params.id ?? ''))

type TabKey = 'overview' | 'tasks' | 'config'
const tab = ref<TabKey>('overview')

const project = computed(() => ({
  id: projectId.value,
  name: projectId.value === 'demo-ainative' ? 'AINative Demo' : 'Project',
  repoUrl:
    projectId.value === 'demo-ainative'
      ? 'git@example.com:platform/ainative.git'
      : 'git@example.com:org/repo.git',
  defaultBranch: 'main',
  updatedAt: '2026-02-05',
}))

const tabClass = (key: TabKey) =>
  key === tab.value
    ? 'bg-background text-foreground shadow-sm'
    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <RouterLink to="/projects" class="hover:text-foreground hover:underline">
          Projects
        </RouterLink>
        <span>/</span>
        <span class="font-mono">{{ project.id }}</span>
      </div>

      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="space-y-1">
          <h1 class="text-3xl font-semibold tracking-tight">{{ project.name }}</h1>
          <p class="text-sm text-muted-foreground">
            <span class="font-mono text-xs">{{ project.repoUrl }}</span>
            <span class="mx-2">•</span>
            <span class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
              {{ project.defaultBranch }}
            </span>
            <span class="mx-2">•</span>
            <span>Updated {{ project.updatedAt }}</span>
          </p>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:shadow-md"
            type="button"
          >
            Edit Config
          </button>
          <RouterLink
            to="/tasks"
            class="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
          >
            New Task
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="tabClass('overview')"
        type="button"
        @click="tab = 'overview'"
      >
        Overview
      </button>
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="tabClass('tasks')"
        type="button"
        @click="tab = 'tasks'"
      >
        Tasks
      </button>
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="tabClass('config')"
        type="button"
        @click="tab = 'config'"
      >
        Config
      </button>
    </section>

    <section v-if="tab === 'overview'" class="space-y-6">
      <div class="grid gap-4 md:grid-cols-3">
        <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p class="text-xs text-muted-foreground">Total tasks</p>
          <p class="mt-2 text-2xl font-semibold">24</p>
          <p class="mt-3 text-xs text-muted-foreground">Across all templates</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p class="text-xs text-muted-foreground">Running</p>
          <p class="mt-2 text-2xl font-semibold">2</p>
          <p class="mt-3 text-xs text-muted-foreground">Log streaming enabled</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p class="text-xs text-muted-foreground">Last run</p>
          <p class="mt-2 text-2xl font-semibold">12m ago</p>
          <p class="mt-3 text-xs text-muted-foreground">Task t-004</p>
        </div>
      </div>

      <div class="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold">Recent tasks</p>
            <p class="text-xs text-muted-foreground">Latest activity in this project</p>
          </div>
          <RouterLink
            to="/tasks"
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
          >
            View all
          </RouterLink>
        </div>
        <div class="mt-4 space-y-2 text-sm">
          <RouterLink
            to="/tasks/t-004"
            class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 hover:bg-background"
          >
            <span class="font-semibold">Upload artifact preview page</span>
            <span class="text-xs text-muted-foreground">SUCCESS</span>
          </RouterLink>
          <RouterLink
            to="/tasks/t-002"
            class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 hover:bg-background"
          >
            <span class="font-semibold">Run agent to generate API stubs</span>
            <span class="text-xs text-muted-foreground">RUNNING</span>
          </RouterLink>
          <RouterLink
            to="/tasks/t-001"
            class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 hover:bg-background"
          >
            <span class="font-semibold">Create workflow template for MVP</span>
            <span class="text-xs text-muted-foreground">DRAFT</span>
          </RouterLink>
        </div>
      </div>
    </section>

    <section v-else-if="tab === 'tasks'" class="space-y-4">
      <div class="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p class="text-sm font-semibold">Tasks</p>
        <p class="mt-1 text-sm text-muted-foreground">
          Embedded task list filtered by this project (MVP can link to global list).
        </p>
        <div class="mt-4">
          <RouterLink
            to="/tasks"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
          >
            Go to Tasks
          </RouterLink>
        </div>
      </div>
    </section>

    <section v-else class="space-y-4">
      <div class="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p class="text-sm font-semibold">Project Config (MVP)</p>
        <p class="mt-1 text-sm text-muted-foreground">
          Repo binding and default execution settings. (API wiring later.)
        </p>

        <form class="mt-6 grid gap-4 md:grid-cols-2">
          <label class="space-y-2 md:col-span-2">
            <span class="text-xs font-semibold text-muted-foreground">Repository URL</span>
            <input
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
              :value="project.repoUrl"
              type="text"
            />
          </label>

          <label class="space-y-2">
            <span class="text-xs font-semibold text-muted-foreground">Default branch</span>
            <input
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
              :value="project.defaultBranch"
              type="text"
            />
          </label>

          <label class="space-y-2">
            <span class="text-xs font-semibold text-muted-foreground">Allowed agents</span>
            <select
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
            >
              <option>Codex</option>
              <option>Cursor</option>
              <option>Claude</option>
            </select>
          </label>

          <div class="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:shadow-md"
              type="button"
            >
              Reset
            </button>
            <button
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
              type="button"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>
