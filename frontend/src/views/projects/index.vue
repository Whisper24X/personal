<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useMessage } from '@/hooks'
import { businessLinesApi, type BusinessLine } from '@/api/business-lines'
import { projectsApi } from '@/api/projects'
import type { Project } from '@/types/api/projects'
import ConfirmActionModal from '@/components/business/settings/modals/ConfirmActionModal.vue'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'

defineOptions({
  name: 'ProjectsView',
})

const loading = ref(false)
const loadingMore = ref(false)
const submitting = ref(false)
const deletingProjectId = ref<string | null>(null)
const projectDeleteModalOpen = ref(false)
const deletingProjectTarget = ref<Project | null>(null)
const editingProjectId = ref<string | null>(null)
const projectFormModalOpen = ref(false)
const query = ref('')
const validationMessage = ref('')
const repositoryBranchOptions = ref<string[]>([])
const inspectingRepository = ref(false)
const repositoryInspectionError = ref('')
const projectNameEditedByUser = ref(false)
const defaultBranchEditedByUser = ref(false)
const autoFilledProjectName = ref('')
const message = useMessage()
let inspectRepositoryTimer: ReturnType<typeof setTimeout> | null = null
let inspectRepositoryRequestId = 0

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

const clearInspectRepositoryTimer = () => {
  if (inspectRepositoryTimer) {
    clearTimeout(inspectRepositoryTimer)
    inspectRepositoryTimer = null
  }
}

const clearRepositoryInspectionMeta = () => {
  repositoryBranchOptions.value = []
  inspectingRepository.value = false
  repositoryInspectionError.value = ''
}

const resetRepositoryAutoFillState = () => {
  projectNameEditedByUser.value = false
  defaultBranchEditedByUser.value = false
  autoFilledProjectName.value = ''
  clearRepositoryInspectionMeta()
}

const resetProjectForm = () => {
  editingProjectId.value = null
  createForm.name = ''
  createForm.description = ''
  createForm.gitUrl = ''
  createForm.defaultBranch = 'main'
  resetRepositoryAutoFillState()
}

const openCreateProjectModal = () => {
  resetProjectForm()
  validationMessage.value = ''
  projectFormModalOpen.value = true
}

const closeProjectFormModal = () => {
  projectFormModalOpen.value = false
  resetProjectForm()
  validationMessage.value = ''
}

const startEditProject = (project: Project) => {
  editingProjectId.value = project.id
  createForm.businessLineId = project.businessLineId
  createForm.name = project.name
  createForm.description = project.description ?? ''
  createForm.gitUrl = project.gitUrl
  createForm.defaultBranch = project.defaultBranch
  clearRepositoryInspectionMeta()
  validationMessage.value = ''
  projectFormModalOpen.value = true
}

const handleProjectNameInput = () => {
  if (isEditingProject.value) {
    return
  }

  projectNameEditedByUser.value = true
}

const handleDefaultBranchInput = () => {
  if (isEditingProject.value) {
    return
  }

  defaultBranchEditedByUser.value = true
}

const applyRepositoryInspection = (inspection: {
  repoName: string
  branches: string[]
  recommendedDefaultBranch: string | null
}) => {
  repositoryBranchOptions.value = inspection.branches

  if (
    inspection.repoName &&
    (!projectNameEditedByUser.value ||
      !createForm.name.trim() ||
      createForm.name.trim() === autoFilledProjectName.value)
  ) {
    createForm.name = inspection.repoName
    autoFilledProjectName.value = inspection.repoName
  }

  if (!inspection.branches.length) {
    return
  }

  const recommendedBranch =
    inspection.recommendedDefaultBranch ?? inspection.branches[0]

  if (!recommendedBranch) {
    return
  }

  if (!defaultBranchEditedByUser.value) {
    createForm.defaultBranch = recommendedBranch
    return
  }

  if (!inspection.branches.includes(createForm.defaultBranch.trim())) {
    createForm.defaultBranch = recommendedBranch
  }
}

const inspectProjectRepository = async () => {
  const businessLineId = createForm.businessLineId.trim()
  const gitUrl = createForm.gitUrl.trim()

  if (!projectFormModalOpen.value || isEditingProject.value || !businessLineId || !gitUrl) {
    clearRepositoryInspectionMeta()
    return
  }

  const currentRequestId = ++inspectRepositoryRequestId
  inspectingRepository.value = true
  repositoryInspectionError.value = ''

  try {
    const inspection = await projectsApi.inspectRepository({
      businessLineId,
      gitUrl,
    })

    if (currentRequestId !== inspectRepositoryRequestId) {
      return
    }

    applyRepositoryInspection(inspection)
  } catch (error) {
    if (currentRequestId !== inspectRepositoryRequestId) {
      return
    }

    clearRepositoryInspectionMeta()
    repositoryInspectionError.value = toErrorMessage(
      error,
      '读取仓库信息失败，请检查 Git 地址和访问权限',
    )
  } finally {
    if (currentRequestId === inspectRepositoryRequestId) {
      inspectingRepository.value = false
    }
  }
}

const scheduleRepositoryInspection = () => {
  clearInspectRepositoryTimer()
  inspectRepositoryTimer = setTimeout(() => {
    void inspectProjectRepository()
  }, 450)
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
      message.success('新建项目成功')
    }

    closeProjectFormModal()
    await loadData()
  } catch (error) {
    message.error(toErrorMessage(error, '保存项目失败'))
  } finally {
    submitting.value = false
  }
}

const removeProject = async (project: Project) => {
  deletingProjectTarget.value = project
  projectDeleteModalOpen.value = true
}

const setProjectDeleteModalOpen = (open: boolean) => {
  projectDeleteModalOpen.value = open
  if (!open) {
    deletingProjectTarget.value = null
  }
}

const confirmRemoveProject = async () => {
  const project = deletingProjectTarget.value
  if (!project) {
    return
  }

  deletingProjectId.value = project.id

  try {
    await projectsApi.remove(project.id)
    if (editingProjectId.value === project.id) {
      closeProjectFormModal()
    }
    await loadData()
    message.success('删除项目成功')
    setProjectDeleteModalOpen(false)
  } catch (error) {
    message.error(toErrorMessage(error, '删除项目失败'))
  } finally {
    deletingProjectId.value = null
  }
}

onMounted(() => {
  void loadData()
})

watch(
  () => [projectFormModalOpen.value, editingProjectId.value, createForm.businessLineId, createForm.gitUrl],
  ([projectModalOpen, currentEditingProjectId]) => {
    clearInspectRepositoryTimer()
    inspectRepositoryRequestId += 1

    if (!projectModalOpen || currentEditingProjectId) {
      clearRepositoryInspectionMeta()
      return
    }

    if (!createForm.businessLineId.trim() || !createForm.gitUrl.trim()) {
      clearRepositoryInspectionMeta()
      return
    }

    scheduleRepositoryInspection()
  },
)

onBeforeUnmount(() => {
  clearInspectRepositoryTimer()
  inspectRepositoryRequestId += 1
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
        <p class="text-sm font-semibold">项目筛选与操作</p>
        <div class="flex items-center gap-2">
          <label class="relative block">
            <span class="sr-only">搜索项目</span>
            <input
              v-model="query"
              class="h-10 w-72 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
              placeholder="按业务线 / 项目 / 仓库搜索"
              type="search"
            />
          </label>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
            type="button"
            @click="openCreateProjectModal"
          >
            新建项目
          </button>
        </div>
      </div>
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

    <ConfirmActionModal
      :open="projectDeleteModalOpen"
      :confirming="deletingProjectId === (deletingProjectTarget?.id ?? null)"
      title="删除项目"
      :description="`确认删除项目「${deletingProjectTarget?.name ?? ''}」吗？`"
      confirm-text="删除"
      @update:open="setProjectDeleteModalOpen"
      @confirm="confirmRemoveProject"
    />

    <Teleport to="body">
      <div v-if="projectFormModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="关闭项目表单弹窗"
          class="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          @click="closeProjectFormModal"
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-form-modal-title"
          class="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl"
          tabindex="-1"
          @keydown.esc.prevent="closeProjectFormModal"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="project-form-modal-title" class="text-sm font-semibold">
              {{ isEditingProject ? '编辑项目' : '新建项目' }}
            </h2>
            <button
              type="button"
              aria-label="关闭"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
              @click="closeProjectFormModal"
            >
              ×
            </button>
          </header>

          <form class="grid gap-3 px-4 py-4 md:grid-cols-2" @submit.prevent="submitProject">
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

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">仓库地址</span>
              <input
                v-model="createForm.gitUrl"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="git@gitlab.example.com:group/project.git"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">默认分支</span>
              <select
                v-if="!isEditingProject && repositoryBranchOptions.length > 0"
                v-model="createForm.defaultBranch"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                @change="handleDefaultBranchInput"
              >
                <option v-for="branch in repositoryBranchOptions" :key="branch" :value="branch">
                  {{ branch }}
                </option>
              </select>
              <input
                v-else
                v-model="createForm.defaultBranch"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
                @input="handleDefaultBranchInput"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">项目名称</span>
              <input
                v-model="createForm.name"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如：AINative Web"
                type="text"
                @input="handleProjectNameInput"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">描述（可选）</span>
              <input
                v-model="createForm.description"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <p
              v-if="!isEditingProject && inspectingRepository"
              class="text-xs text-muted-foreground md:col-span-2"
            >
              正在读取仓库信息...
            </p>
            <p
              v-else-if="!isEditingProject && repositoryInspectionError"
              class="text-xs text-destructive md:col-span-2"
            >
              {{ repositoryInspectionError }}
            </p>

            <p v-if="validationMessage" class="text-sm text-destructive md:col-span-2">{{ validationMessage }}</p>

            <div class="md:col-span-2 flex justify-end gap-2">
              <button
                class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:shadow-md"
                type="button"
                @click="closeProjectFormModal"
              >
                取消
              </button>
              <button
                class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="submitting"
                type="submit"
              >
                {{ submitting ? '保存中...' : isEditingProject ? '保存修改' : '新建项目' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
