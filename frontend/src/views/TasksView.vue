<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

type TaskStatus = 'DRAFT' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED'

type TaskRow = {
  id: string
  title: string
  status: TaskStatus
  project: string
  template: string
  updatedAt: string
}

const query = ref('')
const status = ref<TaskStatus | 'ALL'>('ALL')

const tasks = ref<TaskRow[]>([
  {
    id: 't-001',
    title: 'Create workflow template for MVP',
    status: 'DRAFT',
    project: 'AINative Demo',
    template: 'Default',
    updatedAt: '2026-02-05',
  },
  {
    id: 't-002',
    title: 'Run agent to generate API stubs',
    status: 'RUNNING',
    project: 'AINative Demo',
    template: 'Codex Runner',
    updatedAt: '2026-02-05',
  },
  {
    id: 't-003',
    title: 'Fix SSE streaming auth',
    status: 'FAILED',
    project: 'Runner Sandbox',
    template: 'Claude Code',
    updatedAt: '2026-02-04',
  },
  {
    id: 't-004',
    title: 'Upload artifact preview page',
    status: 'SUCCESS',
    project: 'AINative Demo',
    template: 'Cursor Agent',
    updatedAt: '2026-02-03',
  },
])

const statusBadgeClass = (value: TaskStatus) => {
  if (value === 'SUCCESS') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (value === 'FAILED') return 'bg-red-500/10 text-red-700 dark:text-red-300'
  if (value === 'RUNNING') return 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
  if (value === 'QUEUED') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'bg-muted text-muted-foreground'
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return tasks.value.filter((t) => {
    const passQuery =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.project.toLowerCase().includes(q)
    const passStatus = status.value === 'ALL' ? true : t.status === status.value
    return passQuery && passStatus
  })
})
</script>

<template>
  <div class="space-y-6">
    <section class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Run
        </p>
        <h1 class="text-3xl font-semibold tracking-tight">Tasks</h1>
        <p class="max-w-2xl text-sm text-muted-foreground">
          Create and execute agent workflows. Watch logs in real time and preview/download artifacts.
        </p>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label class="relative block">
          <span class="sr-only">Search tasks</span>
          <input
            v-model="query"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring sm:w-72"
            placeholder="Search by title / ID / project"
            type="search"
          />
        </label>

        <label class="relative block">
          <span class="sr-only">Filter status</span>
          <select
            v-model="status"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring sm:w-44"
          >
            <option value="ALL">All</option>
            <option value="DRAFT">Draft</option>
            <option value="QUEUED">Queued</option>
            <option value="RUNNING">Running</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>

        <button
          class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
          type="button"
        >
          New Task
        </button>
      </div>
    </section>

    <section class="rounded-2xl border border-border bg-card shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-[860px] w-full text-left text-sm">
          <thead class="border-b border-border bg-background/60">
            <tr class="text-xs font-semibold text-muted-foreground">
              <th class="px-5 py-3">Title</th>
              <th class="px-5 py-3">Status</th>
              <th class="px-5 py-3">Project</th>
              <th class="px-5 py-3">Template</th>
              <th class="px-5 py-3">Updated</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="t in filtered" :key="t.id" class="hover:bg-background/60">
              <td class="px-5 py-4">
                <RouterLink
                  :to="`/tasks/${t.id}`"
                  class="inline-flex items-center gap-2 font-semibold text-foreground hover:underline"
                >
                  <span class="rounded-lg bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {{ t.id }}
                  </span>
                  <span class="cursor-pointer">{{ t.title }}</span>
                </RouterLink>
              </td>
              <td class="px-5 py-4">
                <span
                  class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold"
                  :class="statusBadgeClass(t.status)"
                >
                  {{ t.status }}
                </span>
              </td>
              <td class="px-5 py-4 text-muted-foreground">
                {{ t.project }}
              </td>
              <td class="px-5 py-4">
                <span
                  class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground"
                >
                  {{ t.template }}
                </span>
              </td>
              <td class="px-5 py-4 text-muted-foreground">
                {{ t.updatedAt }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filtered.length === 0" class="p-8">
        <p class="text-sm font-semibold">No tasks found</p>
        <p class="mt-2 text-sm text-muted-foreground">Try clearing filters or create a new task.</p>
      </div>
    </section>
  </div>
</template>
