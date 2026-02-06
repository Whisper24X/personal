<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

type ProjectRow = {
  id: string
  name: string
  repoUrl: string
  defaultBranch: string
  status: '运行中' | '空闲' | '告警'
  updatedAt: string
}

type BusinessLineGroup = {
  id: string
  name: string
  owner: string
  projects: ProjectRow[]
}

const query = ref('')

const businessLines = ref<BusinessLineGroup[]>([
  {
    id: 'bl-platform',
    name: '平台研发线',
    owner: '张敏',
    projects: [
      {
        id: 'demo-ainative',
        name: 'AINative 示例项目',
        repoUrl: 'git@example.com:platform/ainative.git',
        defaultBranch: 'main',
        status: '运行中',
        updatedAt: '2026-02-06',
      },
      {
        id: 'platform-ops',
        name: '平台运维自动化',
        repoUrl: 'git@example.com:platform/ops.git',
        defaultBranch: 'main',
        status: '空闲',
        updatedAt: '2026-02-05',
      },
    ],
  },
  {
    id: 'bl-growth',
    name: '增长业务线',
    owner: '李博',
    projects: [
      {
        id: 'demo-runner',
        name: 'Runner 沙箱项目',
        repoUrl: 'git@example.com:platform/runner.git',
        defaultBranch: 'develop',
        status: '告警',
        updatedAt: '2026-02-04',
      },
      {
        id: 'growth-web',
        name: '增长实验平台',
        repoUrl: 'git@example.com:growth/web.git',
        defaultBranch: 'release',
        status: '空闲',
        updatedAt: '2026-02-03',
      },
    ],
  },
])

const filteredLines = computed(() => {
  const q = query.value.trim().toLowerCase()

  if (!q) return businessLines.value

  return businessLines.value
    .map((line) => {
      const filteredProjects = line.projects.filter((project) => {
        return (
          project.name.toLowerCase().includes(q) ||
          project.repoUrl.toLowerCase().includes(q) ||
          project.id.toLowerCase().includes(q)
        )
      })

      const matchedBusinessLine =
        line.name.toLowerCase().includes(q) ||
        line.owner.toLowerCase().includes(q) ||
        line.id.toLowerCase().includes(q)

      return {
        ...line,
        projects: matchedBusinessLine ? line.projects : filteredProjects,
      }
    })
    .filter((line) => line.projects.length > 0)
})

const totalProjectCount = computed(() => {
  return filteredLines.value.reduce((sum, line) => sum + line.projects.length, 0)
})

const statusClass = (status: ProjectRow['status']) => {
  if (status === '运行中') return 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
  if (status === '告警') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'bg-muted text-muted-foreground'
}
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">组织与项目</p>
        <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">业务线与项目</h1>
        <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          在同一视图下查看业务线负责人、项目归属和仓库状态，便于统一管理交付上下文。
        </p>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center lg:min-w-[28rem] lg:justify-end">
        <label class="relative block">
          <span class="sr-only">搜索业务线和项目</span>
          <input
            v-model="query"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring sm:w-80"
            placeholder="按业务线 / 项目 / 仓库 / ID 搜索"
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

    <section class="panel-card border-none bg-transparent p-0 shadow-none">
      <div class="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
        <span>业务线 {{ filteredLines.length }} 条</span>
        <span>•</span>
        <span>项目 {{ totalProjectCount }} 个</span>
      </div>
    </section>

    <section v-if="filteredLines.length > 0" class="space-y-5">
      <article
        v-for="line in filteredLines"
        :key="line.id"
        class="panel-card overflow-hidden"
      >
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="rounded-lg border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                {{ line.id }}
              </span>
              <p class="text-sm font-semibold">{{ line.name }}</p>
            </div>
            <p class="mt-2 text-xs text-muted-foreground">负责人：{{ line.owner }}</p>
          </div>
          <span class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
            项目数 {{ line.projects.length }}
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[820px] text-left text-sm">
            <thead class="border-b border-border bg-background/60">
              <tr class="text-xs font-semibold text-muted-foreground">
                <th class="px-5 py-3">项目</th>
                <th class="px-5 py-3">仓库地址</th>
                <th class="px-5 py-3">分支</th>
                <th class="px-5 py-3">状态</th>
                <th class="px-5 py-3">最近更新</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="project in line.projects" :key="project.id" class="transition hover:bg-background/70">
                <td class="px-5 py-4">
                  <RouterLink
                    :to="`/projects/${project.id}`"
                    class="inline-flex items-center gap-2 font-semibold text-foreground hover:underline"
                  >
                    <span class="rounded-lg border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                      {{ project.id }}
                    </span>
                    <span>{{ project.name }}</span>
                  </RouterLink>
                </td>
                <td class="px-5 py-4 text-muted-foreground">
                  <span class="font-mono text-xs">{{ project.repoUrl }}</span>
                </td>
                <td class="px-5 py-4">
                  <span class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {{ project.defaultBranch }}
                  </span>
                </td>
                <td class="px-5 py-4">
                  <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold" :class="statusClass(project.status)">
                    {{ project.status }}
                  </span>
                </td>
                <td class="px-5 py-4 text-muted-foreground">{{ project.updatedAt }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>

    <section v-else class="panel-card p-8">
      <p class="text-sm font-semibold">未找到业务线或项目</p>
      <p class="mt-2 text-sm text-muted-foreground">请调整搜索条件，或创建第一条业务线和项目。</p>
    </section>
  </div>
</template>
