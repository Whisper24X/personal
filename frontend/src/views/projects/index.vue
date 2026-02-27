<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useMessage } from '@/hooks'
import { businessLinesApi, type BusinessLine } from '@/api/business-lines'
import { projectsApi } from '@/api/projects'
import type { Project } from '@/types/api/projects'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'

defineOptions({
  name: 'ProjectsView',
})

const loading = ref(false)
const loadingMore = ref(false)
const submitting = ref(false)
const deletingProjectId = ref<string | null>(null)
const editingProjectId = ref<string | null>(null)
const query = ref('')
const validationMessage = ref('')
const message = useMessage()

const businessLines = ref<BusinessLine[]>([])
const projects = ref<Project[]>([])
const projectPage = ref(1)
const projectHasNextPage = ref(false)

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

  try {
    const [businessLineResponse, projectResponse] = await Promise.all([
      fetchAllPages((page, limit) => businessLinesApi.list({ page, limit })),
      projectsApi.list({ page: 1, limit: 50 }),
    ])

    businessLines.value = businessLineResponse
    projects.value = projectResponse.data
    projectPage.value = 1
    projectHasNextPage.value = projectResponse.hasNextPage

    if (!createForm.businessLineId) {
      createForm.businessLineId = businessLineResponse[0]?.id ?? ''
    }
  } catch (error) {
    message.error(toErrorMessage(error, '加载项目数据失败'))
  } finally {
    loading.value = false
  }
}

const loadMoreProjects = async () => {
  if (loadingMore.value || !projectHasNextPage.value) {
    return
  }

  loadingMore.value = true

  try {
    const nextPage = projectPage.value + 1
    const response = await projectsApi.list({ page: nextPage, limit: 50 })

    const existingProjectIds = new Set(projects.value.map((project) => project.id))
    projects.value = projects.value.concat(
      response.data.filter((project) => !existingProjectIds.has(project.id)),
    )

    projectPage.value = nextPage
    projectHasNextPage.value = response.hasNextPage
  } catch (error) {
    message.error(toErrorMessage(error, '加载更多项目失败'))
  } finally {
    loadingMore.value = false
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

const isEditingProject = computed(() => Boolean(editingProjectId.value))

const resetProjectForm = () => {
  editingProjectId.value = null
  createForm.name = ''
  createForm.description = ''
  createForm.gitUrl = ''
  createForm.defaultBranch = 'main'
}

const startEditProject = (project: Project) => {
  editingProjectId.value = project.id
  createForm.businessLineId = project.businessLineId
  createForm.name = project.name
  createForm.description = project.description ?? ''
  createForm.gitUrl = project.gitUrl
  createForm.defaultBranch = project.defaultBranch
}

const submitProject = async () => {
  if (!createForm.businessLineId || !createForm.name.trim() || !createForm.gitUrl.trim()) {
    validationMessage.value = '所属业务线、项目名称和仓库地址不能为空'
    return
  }

  submitting.value = true
  validationMessage.value = ''

  try {
    const payload = {
      businessLineId: createForm.businessLineId,
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      gitUrl: createForm.gitUrl.trim(),
      defaultBranch: createForm.defaultBranch.trim() || 'main',
    }

    if (editingProjectId.value) {
      await projectsApi.update(editingProjectId.value, payload)
      message.success('保存项目成功')
    } else {
      await projectsApi.create(payload)
      message.success('创建项目成功')
    }

    resetProjectForm()
    await loadData()
  } catch (error) {
    message.error(toErrorMessage(error, '保存项目失败'))
  } finally {
    submitting.value = false
  }
}

const removeProject = async (project: Project) => {
  if (!window.confirm(`确认删除项目「${project.name}」吗？`)) {
    return
  }

  deletingProjectId.value = project.id

  try {
    await projectsApi.remove(project.id)
    if (editingProjectId.value === project.id) {
      resetProjectForm()
    }
    await loadData()
    message.success('删除项目成功')
  } catch (error) {
    message.error(toErrorMessage(error, '删除项目失败'))
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
        对接真实接口管理项目，支持创建、编辑、查看与删除。项目详情页可继续配置成员与执行参数。
      </p>
    </section>

    <section class="panel-card p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-semibold">{{ isEditingProject ? '编辑项目' : '新建项目' }}</p>
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

      <form class="grid gap-3 md:grid-cols-2" @submit.prevent="submitProject">
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
            v-if="isEditingProject"
            class="mr-2 h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:shadow-md"
            type="button"
            @click="resetProjectForm"
          >
            取消编辑
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="submitting"
            type="submit"
          >
            {{ submitting ? '保存中...' : isEditingProject ? '保存修改' : '创建项目' }}
          </button>
        </div>
      </form>

      <p v-if="validationMessage" class="mt-3 text-sm text-destructive">{{ validationMessage }}</p>
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
                      class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
                      type="button"
                      @click="startEditProject(project)"
                    >
                      编辑
                    </button>
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

    <section v-if="!loading && filteredGroups.length > 0 && projectHasNextPage" class="panel-card p-4">
      <button
        class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loadingMore"
        type="button"
        @click="loadMoreProjects"
      >
        {{ loadingMore ? '加载中...' : '加载更多项目' }}
      </button>
    </section>

    <section v-if="!loading && filteredGroups.length === 0" class="panel-card p-8">
      <p class="text-sm font-semibold">未找到业务线或项目</p>
      <p class="mt-2 text-sm text-muted-foreground">请调整搜索条件，或创建第一条项目记录。</p>
    </section>
  </div>
</template>
