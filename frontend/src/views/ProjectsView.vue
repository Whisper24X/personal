<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

type ProjectRow = {
  id: string
  name: string
  repoUrl: string
  defaultBranch: string
  updatedAt: string
}

const query = ref('')

const projects = ref<ProjectRow[]>([
  {
    id: 'demo-ainative',
    name: 'AINative Demo',
    repoUrl: 'git@example.com:platform/ainative.git',
    defaultBranch: 'main',
    updatedAt: '2026-02-05',
  },
  {
    id: 'demo-runner',
    name: 'Runner Sandbox',
    repoUrl: 'git@example.com:platform/runner.git',
    defaultBranch: 'develop',
    updatedAt: '2026-02-04',
  },
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return projects.value
  return projects.value.filter((p) => {
    return (
      p.name.toLowerCase().includes(q) ||
      p.repoUrl.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    )
  })
})
</script>

<template>
  <div class="space-y-6">
    <section class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Build
        </p>
        <h1 class="text-3xl font-semibold tracking-tight">Projects</h1>
        <p class="max-w-2xl text-sm text-muted-foreground">
          Bind a Git repository and configure which agents / skills can run tasks for this project.
        </p>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label class="relative block">
          <span class="sr-only">Search projects</span>
          <input
            v-model="query"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring sm:w-72"
            placeholder="Search by name / repo / ID"
            type="search"
          />
        </label>
        <button
          class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
          type="button"
        >
          New Project
        </button>
      </div>
    </section>

    <section class="rounded-2xl border border-border bg-card shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-[760px] w-full text-left text-sm">
          <thead class="border-b border-border bg-background/60">
            <tr class="text-xs font-semibold text-muted-foreground">
              <th class="px-5 py-3">Name</th>
              <th class="px-5 py-3">Repo</th>
              <th class="px-5 py-3">Branch</th>
              <th class="px-5 py-3">Updated</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="p in filtered"
              :key="p.id"
              class="hover:bg-background/60"
            >
              <td class="px-5 py-4">
                <RouterLink
                  :to="`/projects/${p.id}`"
                  class="inline-flex items-center gap-2 font-semibold text-foreground hover:underline"
                >
                  <span class="rounded-lg bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {{ p.id }}
                  </span>
                  <span class="cursor-pointer">{{ p.name }}</span>
                </RouterLink>
              </td>
              <td class="px-5 py-4 text-muted-foreground">
                <span class="font-mono text-xs">{{ p.repoUrl }}</span>
              </td>
              <td class="px-5 py-4">
                <span
                  class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground"
                >
                  {{ p.defaultBranch }}
                </span>
              </td>
              <td class="px-5 py-4 text-muted-foreground">
                {{ p.updatedAt }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filtered.length === 0" class="p-8">
        <p class="text-sm font-semibold">No projects found</p>
        <p class="mt-2 text-sm text-muted-foreground">
          Try clearing filters or create your first project to bind a repo and run tasks.
        </p>
      </div>
    </section>
  </div>
</template>

