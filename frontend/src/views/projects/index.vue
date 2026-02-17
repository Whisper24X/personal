<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { businessLinesApi, type BusinessLine } from '@/api/business-lines'
import { projectsApi } from '@/api/projects'
import type { Project } from '@/types/api/projects'

const loading = ref(false)
const submitting = ref(false)
const deletingProjectId = ref<string | null>(null)
const query = ref('')
const errorMessage = ref('')

const businessLines = ref<BusinessLine[]>([])
const projects = ref<Project[]>([])

const createForm = reactive({
  businessLineId: '',
  name: '',
  description: '',
  gitUrl: '',
  defaultBranch: 'main',
})

const formatDate = (value?: string) => {
  if (!value) return '-'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value
  return parsedDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const loadData = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const [businessLineResponse, projectResponse] = await Promise.all([
      businessLinesApi.list({ page: 1, limit: 50 }),
      projectsApi.list({ page: 1, limit: 50 }),
    ])

    businessLines.value = businessLineResponse.data
    projects.value = projectResponse.data

    if (!createForm.businessLineId) {
      createForm.businessLineId = businessLineResponse.data[0]?.id ?? ''
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载项目数据失败'
  } finally {
    loading.value = false
  }
}

const groupedProjects = computed(() => {
  const groupMap = new Map<string, { line: BusinessLine; projects: Project[] }>()

  for (const line of businessLines.value) {
    groupMap.set(line.id, {
      line,
      projects: [],
    })
  }

  for (const project of projects.value) {
    const group = groupMap.get(project.businessLineId)
    if (!group) {
      continue
    }

    group.projects.push(project)
  }

  return Array.from(groupMap.values()).map((group) => ({
    ...group,
    projects: [...group.projects].sort((left, right) => left.name.localeCompare(right.name)),
  }))
})

const filteredGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    return groupedProjects.value
  }

  return groupedProjects.value
    .map((group) => {
      const lineMatched = group.line.name.toLowerCase().includes(q) || group.line.id.toLowerCase().includes(q)

      const filteredProjects = group.projects.filter((project) => {
        return (
          project.name.toLowerCase().includes(q) ||
          project.id.toLowerCase().includes(q) ||
          project.gitUrl.toLowerCase().includes(q)
        )
      })

      return {
        ...group,
        projects: lineMatched ? group.projects : filteredProjects,
      }
    })
    .filter((group) => group.projects.length > 0)
})

const totalProjectCount = computed(() => {
  return filteredGroups.value.reduce((sum, group) => sum + group.projects.length, 0)
})

const resetCreateForm = () => {
  createForm.name = ''
  createForm.description = ''
  createForm.gitUrl = ''
  createForm.defaultBranch = 'main'
}

const createProject = async () => {
  if (!createForm.businessLineId || !createForm.name.trim() || !createForm.gitUrl.trim()) {
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    await projectsApi.create({
      businessLineId: createForm.businessLineId,
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      gitUrl: createForm.gitUrl.trim(),
      defaultBranch: createForm.defaultBranch.trim() || 'main',
    })

    resetCreateForm()
    await loadData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '创建项目失败'
  } finally {
    submitting.value = false
  }
}

const removeProject = async (project: Project) => {
  if (!window.confirm(`确认删除项目「${project.name}」吗？`)) {
    return
  }

  deletingProjectId.value = project.id
  errorMessage.value = ''

  try {
    await projectsApi.remove(project.id)
    await loadData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '删除项目失败'
  } finally {
    deletingProjectId.value = null
  }
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">组织与项目</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">业务线与项目</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        对接真实接口管理项目，支持创建、查看与删除。项目详情页可继续配置成员与执行参数。
      </p>
    </section>

    <section class="panel-card p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-semibold">新建项目</p>
        <label class="relative block">
          <span class="sr-only">搜索项目</span>
          <input
            v-model="query"
            class="h-10 w-72 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
            placeholder="按业务线 / 项目 / 仓库搜索"
            type="search"
          />
        </label>
      </div>

      <form class="grid gap-3 md:grid-cols-2" @submit.prevent="createProject">
        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">所属业务线</span>
          <select
            v-model="createForm.businessLineId"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            <option v-for="line in businessLines" :key="line.id" :value="line.id">
              {{ line.name }}
            </option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">项目名称</span>
          <input
            v-model="createForm.name"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="例如：AINative Web"
            type="text"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">Git 仓库地址</span>
          <input
            v-model="createForm.gitUrl"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="git@gitlab.example.com:group/project.git"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">默认分支</span>
          <input
            v-model="createForm.defaultBranch"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">描述（可选）</span>
          <input
            v-model="createForm.description"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            type="text"
          />
        </label>

        <div class="md:col-span-2 flex justify-end">
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="submitting"
            type="submit"
          >
            {{ submitting ? '创建中...' : '创建项目' }}
          </button>
        </div>
      </form>

      <p v-if="errorMessage" class="mt-3 text-sm text-destructive">{{ errorMessage }}</p>
    </section>

    <section class="panel-card border-none bg-transparent p-0 shadow-none">
      <div class="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
        <span>业务线 {{ filteredGroups.length }} 条</span>
        <span>•</span>
        <span>项目 {{ totalProjectCount }} 个</span>
      </div>
    </section>

    <section v-if="loading" class="panel-card p-8 text-sm text-muted-foreground">加载中...</section>

    <section v-else-if="filteredGroups.length > 0" class="space-y-5">
      <article v-for="group in filteredGroups" :key="group.line.id" class="panel-card overflow-hidden">
        <div class="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p class="text-sm font-semibold">{{ group.line.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ group.line.id }}</p>
          </div>
          <span class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
            项目 {{ group.projects.length }}
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[860px] text-left text-sm">
            <thead class="border-b border-border bg-background/60">
              <tr class="text-xs font-semibold text-muted-foreground">
                <th class="px-5 py-3">项目</th>
                <th class="px-5 py-3">仓库地址</th>
                <th class="px-5 py-3">默认分支</th>
                <th class="px-5 py-3">更新时间</th>
                <th class="px-5 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="project in group.projects" :key="project.id" class="transition hover:bg-background/70">
                <td class="px-5 py-4">
                  <RouterLink :to="`/projects/${project.id}`" class="font-semibold text-foreground hover:underline">
                    {{ project.name }}
                  </RouterLink>
                  <p class="mt-1 font-mono text-xs text-muted-foreground">{{ project.id }}</p>
                </td>
                <td class="px-5 py-4">
                  <span class="font-mono text-xs text-muted-foreground">{{ project.gitUrl }}</span>
                </td>
                <td class="px-5 py-4 text-muted-foreground">{{ project.defaultBranch }}</td>
                <td class="px-5 py-4 text-muted-foreground">{{ formatDate(project.updatedAt) }}</td>
                <td class="px-5 py-4">
                  <div class="flex justify-end gap-2">
                    <RouterLink
                      :to="`/projects/${project.id}`"
                      class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
                    >
                      详情
                    </RouterLink>
                    <button
                      class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="deletingProjectId === project.id"
                      type="button"
                      @click="removeProject(project)"
                    >
                      {{ deletingProjectId === project.id ? '删除中...' : '删除' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>

    <section v-else class="panel-card p-8">
      <p class="text-sm font-semibold">未找到业务线或项目</p>
      <p class="mt-2 text-sm text-muted-foreground">请调整搜索条件，或创建第一条项目记录。</p>
    </section>
  </div>
</template>
