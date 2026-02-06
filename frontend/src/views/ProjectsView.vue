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
    name: 'AINative 示例项目',
    repoUrl: 'git@example.com:platform/ainative.git',
    defaultBranch: 'main',
    updatedAt: '2026-02-05',
  },
  {
    id: 'demo-runner',
    name: 'Runner 沙箱项目',
    repoUrl: 'git@example.com:platform/runner.git',
    defaultBranch: 'develop',
    updatedAt: '2026-02-04',
  },
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return projects.value
  return projects.value.filter((project) => {
    return (
      project.name.toLowerCase().includes(q) ||
      project.repoUrl.toLowerCase().includes(q) ||
      project.id.toLowerCase().includes(q)
    )
  })
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">项目管理</p>
        <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">项目列表</h1>
        <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          绑定代码仓库、设置默认分支，为任务执行提供稳定的项目上下文。
        </p>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center lg:min-w-[28rem] lg:justify-end">
        <label class="relative block">
          <span class="sr-only">搜索项目</span>
          <input
            v-model="query"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring sm:w-80"
            placeholder="按项目名 / 仓库 / ID 搜索"
            type="search"
          />
        </label>
        <button
          class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
          type="button"
        >
          新建项目
        </button>
      </div>
    </section>

    <section class="panel-card">
      <div class="border-b border-border px-5 py-4">
        <p class="text-sm font-semibold">仓库清单</p>
        <p class="mt-1 text-xs text-muted-foreground">当前可见 {{ filtered.length }} 个项目</p>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-border bg-background/60">
            <tr class="text-xs font-semibold text-muted-foreground">
              <th class="px-5 py-3">项目名</th>
              <th class="px-5 py-3">仓库地址</th>
              <th class="px-5 py-3">默认分支</th>
              <th class="px-5 py-3">最近更新</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="project in filtered" :key="project.id" class="transition hover:bg-background/70">
              <td class="px-5 py-4">
                <RouterLink
                  :to="`/projects/${project.id}`"
                  class="inline-flex items-center gap-2 font-semibold text-foreground hover:underline"
                >
                  <span
                    class="rounded-lg border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    {{ project.id }}
                  </span>
                  <span class="cursor-pointer">{{ project.name }}</span>
                </RouterLink>
              </td>
              <td class="px-5 py-4 text-muted-foreground">
                <span class="font-mono text-xs">{{ project.repoUrl }}</span>
              </td>
              <td class="px-5 py-4">
                <span
                  class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground"
                >
                  {{ project.defaultBranch }}
                </span>
              </td>
              <td class="px-5 py-4 text-muted-foreground">{{ project.updatedAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filtered.length === 0" class="p-8">
        <p class="text-sm font-semibold">未找到项目</p>
        <p class="mt-2 text-sm text-muted-foreground">请调整搜索条件，或先创建第一个项目。</p>
      </div>
    </section>
  </div>
</template>
