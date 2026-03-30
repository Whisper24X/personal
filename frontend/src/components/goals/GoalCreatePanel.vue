<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from '@/hooks'
import { useAccessStore } from '@/stores/modules/access'
import { businessLinesApi, type AgentToolConfig } from '@/api/business-lines'
import { goalsApi } from '@/api/goals'
import { gitApi } from '@/api/git'
import { projectsApi } from '@/api/projects'
import AppSelect from '@/components/core/select'
import { BUTTON_ACCESS_CONFIG, hasSomeAccess } from '@/constants/access-control'
import type { Project } from '@/types/api/projects'
import { STORAGE_KEYS } from '@/types/common/storage'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { goalInputDirRelativePath } from '@/utils/goal-doc-paths'
import {
  createOrUpdateProjectDoc,
  formatFileSize,
  sanitizeGoalInputBasename,
} from '@/utils/project-doc-upload'
import type { GoalSourceDocType } from '@/types/api/goals'
import { fetchAllPages } from '@/utils/pagination'
import { buildBranchOptions } from '@/utils/git-branch-options'

type SupportedCliToolId = 'claude-code' | 'codex' | 'gemini-cli' | 'cursor-agent' | 'opencode'

const SUPPORTED_CLI_TOOLS: Array<{ id: SupportedCliToolId; label: string }> = [
  { id: 'cursor-agent', label: 'Cursor Agent' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini-cli', label: 'Gemini CLI' },
  { id: 'opencode', label: 'Opencode' },
]

const GOAL_CREATE_SELECT_PANEL_Z_INDEX = 130
const GOAL_CREATE_SELECT_PANEL_PLACEMENT = 'top' as const

/** 与 TaskCreatePanel 标题区一致 */
const TASK_HEADLINES = [
  '我能为你做什么？',
  '告诉我目标，我来帮你推进。',
  '给我一句描述，我帮你拆解成可执行任务。',
  '从一个想法开始，把它落地成结果。',
  '想清楚方向后，剩下的交给我。',
  '输入你的需求，我们马上开始。',
]
const HEADLINE_ROTATE_INTERVAL_MS = 30000

const props = withDefaults(
  defineProps<{
    projectId?: string
  }>(),
  {
    projectId: '',
  },
)

defineOptions({
  name: 'GoalCreatePanel',
})

const route = useRoute()
const router = useRouter()
const message = useMessage()
const accessStore = useAccessStore()

const loading = ref(false)
const loadingAgentConfigs = ref(false)
let latestBranchRequestId = 0
const loadingBranches = ref(false)
const branchOptions = ref<string[]>([])
const submitting = ref(false)
const currentHeadline = ref(TASK_HEADLINES[0] ?? '我能为你做什么？')
let headlineTimer: ReturnType<typeof setInterval> | null = null
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFiles = ref<File[]>([])

const projects = ref<Project[]>([])
const configuredCliTools = ref<Array<{ id: SupportedCliToolId; label: string }>>([])
const agentToolConfigs = ref<AgentToolConfig[]>([])
const agentConfigsByTool = ref<Partial<Record<SupportedCliToolId, AgentToolConfig[]>>>({})

const form = reactive({
  projectId: '',
  title: '',
  summary: '',
  gitBaseBranch: '',
  agentCliId: '' as SupportedCliToolId | '',
  agentCliConfigId: '',
})

const configuredCliToolOptions = computed(() =>
  configuredCliTools.value.map((tool) => ({ label: tool.label, value: tool.id })),
)

const agentToolConfigOptions = computed(() =>
  agentToolConfigs.value.map((config) => ({ label: config.name, value: config.id })),
)

const gitBaseBranchOptions = computed(() =>
  branchOptions.value.map((branch) => ({ label: branch, value: branch })),
)

const canSubmit = computed(() => {
  return (
    Boolean(form.projectId?.trim()) &&
    Boolean(form.title?.trim()) &&
    Boolean(form.gitBaseBranch?.trim()) &&
    Boolean(form.agentCliId) &&
    Boolean(form.agentCliConfigId) &&
    hasSomeAccess(BUTTON_ACCESS_CONFIG.createTask.capabilities, (capability) =>
      accessStore.hasCapability(capability),
    )
  )
})

const resolveQueryProjectId = () =>
  typeof route.query.projectId === 'string' ? route.query.projectId : ''

const resolveStoredProjectId = () =>
  typeof window === 'undefined' ? '' : localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? ''

/** 与 TaskCreatePanel 一致：props / URL query / 侧栏持久化的当前项目 */
const resolveProjectIdFromContext = () =>
  props.projectId || resolveQueryProjectId() || resolveStoredProjectId()

const syncProjectFromContext = () => {
  const projectId = resolveProjectIdFromContext()
  if (projectId) {
    form.projectId = projectId
  }
}

function docTypeForGoalSourceFile(file: File): GoalSourceDocType {
  const name = file.name.toLowerCase()
  if (name.endsWith('.zip')) {
    return 'prototype'
  }
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    return 'requirement'
  }
  return 'requirement'
}

function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip')
}

const openFilePicker = () => {
  fileInputRef.value?.click()
}

const pickRandomHeadline = () => {
  if (TASK_HEADLINES.length === 0) {
    currentHeadline.value = '我能为你做什么？'
    return
  }

  if (TASK_HEADLINES.length === 1) {
    currentHeadline.value = TASK_HEADLINES[0] ?? '我能为你做什么？'
    return
  }

  let nextHeadline = currentHeadline.value
  while (nextHeadline === currentHeadline.value) {
    const index = Math.floor(Math.random() * TASK_HEADLINES.length)
    nextHeadline = TASK_HEADLINES[index] ?? currentHeadline.value
  }
  currentHeadline.value = nextHeadline
}

const onFilesSelected = (event: Event) => {
  const input = event.target as HTMLInputElement
  const incomingFiles = Array.from(input.files ?? [])

  if (incomingFiles.length === 0) {
    return
  }

  const merged = [...selectedFiles.value]
  for (const file of incomingFiles) {
    const duplicated = merged.some(
      (item) =>
        item.name === file.name &&
        item.size === file.size &&
        item.lastModified === file.lastModified,
    )
    if (!duplicated) {
      merged.push(file)
    }
  }

  selectedFiles.value = merged
  input.value = ''
}

const removeFile = (index: number) => {
  selectedFiles.value = selectedFiles.value.filter((_, fileIndex) => fileIndex !== index)
}

const isSupportedCliToolId = (toolId: string): toolId is SupportedCliToolId =>
  SUPPORTED_CLI_TOOLS.some((tool) => tool.id === toolId)

const loadBranchesForProject = async (projectId: string) => {
  const requestId = ++latestBranchRequestId
  const project = projects.value.find((item) => item.id === projectId)
  const projectDefaultBranch = project?.defaultBranch?.trim() || ''

  if (!projectId) {
    branchOptions.value = []
    form.gitBaseBranch = ''
    return
  }

  loadingBranches.value = true
  try {
    const branchData = await gitApi.branches(projectId)
    if (requestId !== latestBranchRequestId) {
      return
    }
    const nextBranchOptions = buildBranchOptions({
      localBranches: branchData.localBranches,
      remoteBranches: branchData.remoteBranches,
      preferredBranches: [projectDefaultBranch, branchData.defaultBranch],
    })
    branchOptions.value = nextBranchOptions
    const currentBaseBranch = form.gitBaseBranch.trim()
    const fallbackBaseBranch =
      nextBranchOptions.find((branch) => branch === projectDefaultBranch) ??
      nextBranchOptions[0] ??
      projectDefaultBranch
    form.gitBaseBranch =
      nextBranchOptions.find((branch) => branch === currentBaseBranch) ?? fallbackBaseBranch ?? ''
  } catch (error) {
    if (requestId !== latestBranchRequestId) {
      return
    }
    const fallbackBranches = buildBranchOptions({
      localBranches: [],
      remoteBranches: [],
      preferredBranches: [projectDefaultBranch],
    })
    branchOptions.value = fallbackBranches
    if (!fallbackBranches.includes(form.gitBaseBranch.trim())) {
      form.gitBaseBranch = fallbackBranches[0] ?? ''
    }
    message.error(toErrorMessage(error, '加载项目分支失败'))
  } finally {
    if (requestId === latestBranchRequestId) {
      loadingBranches.value = false
    }
  }
}

const syncAgentToolConfigsForSelectedTool = () => {
  if (!form.agentCliId) {
    agentToolConfigs.value = []
    form.agentCliConfigId = ''
    return
  }
  const configs = agentConfigsByTool.value[form.agentCliId] ?? []
  agentToolConfigs.value = configs
  if (!configs.some((config) => config.id === form.agentCliConfigId)) {
    const defaultConfig = configs.find((config) => config.isDefault)
    form.agentCliConfigId = defaultConfig?.id ?? configs[0]?.id ?? ''
  }
}

const loadConversationCliOptions = async (projectId: string) => {
  const project = projects.value.find((item) => item.id === projectId)
  if (!project?.businessLineId) {
    configuredCliTools.value = []
    agentConfigsByTool.value = {}
    agentToolConfigs.value = []
    form.agentCliId = ''
    form.agentCliConfigId = ''
    return
  }

  loadingAgentConfigs.value = true
  try {
    const configs = await businessLinesApi.listAgentToolConfigs(project.businessLineId)
    const groupedConfigs: Partial<Record<SupportedCliToolId, AgentToolConfig[]>> = {}
    for (const config of configs) {
      if (!isSupportedCliToolId(config.toolId)) continue
      const list = groupedConfigs[config.toolId] ?? []
      list.push(config)
      groupedConfigs[config.toolId] = list
    }
    agentConfigsByTool.value = groupedConfigs
    configuredCliTools.value = SUPPORTED_CLI_TOOLS.filter(
      (tool) => (groupedConfigs[tool.id]?.length ?? 0) > 0,
    )
    if (!configuredCliTools.value.some((tool) => tool.id === form.agentCliId)) {
      form.agentCliId = configuredCliTools.value[0]?.id ?? ''
    }
    syncAgentToolConfigsForSelectedTool()
  } catch (error) {
    configuredCliTools.value = []
    agentConfigsByTool.value = {}
    agentToolConfigs.value = []
    form.agentCliId = ''
    form.agentCliConfigId = ''
    message.error(toErrorMessage(error, '加载 Agent CLI 配置失败'))
  } finally {
    loadingAgentConfigs.value = false
  }
}

const refreshAccessContext = async (projectId: string) => {
  try {
    await accessStore.loadContext(projectId ? { projectId } : {})
  } catch {
    accessStore.clear()
  }
}

/**
 * 与 TaskCreatePanel.loadProjectsForForm 相同：优先拉当前上下文单个项目详情，
 * 失败时再退回全量列表以解析 projectId。
 */
const loadProjectsForForm = async () => {
  const preferredId = form.projectId.trim() || resolveProjectIdFromContext().trim()

  if (preferredId) {
    try {
      const project = await projectsApi.detail(preferredId)
      projects.value = [project]
      form.projectId = project.id
      return
    } catch {
      // detail 不可用时退回全量列表
    }
  }

  const projectResponse = await fetchAllPages((page, limit) => projectsApi.list({ page, limit }))
  projects.value = projectResponse
  const contextProjectId = resolveProjectIdFromContext()
  const hasContext = projectResponse.some((p) => p.id === contextProjectId)
  if (hasContext) {
    form.projectId = contextProjectId
  } else if (
    !form.projectId ||
    !projectResponse.some((project) => project.id === form.projectId)
  ) {
    form.projectId = ''
  }
}

const loadPageData = async () => {
  loading.value = true
  try {
    await loadProjectsForForm()
    await refreshAccessContext(form.projectId)
    await loadConversationCliOptions(form.projectId)
    await loadBranchesForProject(form.projectId)
  } catch (error) {
    message.error(toErrorMessage(error, '加载失败'))
  } finally {
    loading.value = false
  }
}

const submit = async () => {
  if (
    !hasSomeAccess(BUTTON_ACCESS_CONFIG.createTask.capabilities, (capability) =>
      accessStore.hasCapability(capability),
    )
  ) {
    message.error('当前项目暂无创建需求权限')
    return
  }
  const projectIdForSubmit = resolveProjectIdFromContext().trim() || form.projectId.trim()
  if (!projectIdForSubmit) {
    message.error('请先在左侧栏选择项目后再创建需求')
    return
  }
  if (!form.title.trim()) {
    message.error('请填写目标')
    return
  }
  if (!form.gitBaseBranch.trim()) {
    message.error('请选择 Git 基准分支')
    return
  }
  if (!form.agentCliId || !form.agentCliConfigId) {
    message.error('请先在业务线配置 Agent CLI，并选择 CLI 与配置')
    return
  }

  submitting.value = true
  try {
    const goal = await goalsApi.create({
      projectId: projectIdForSubmit,
      title: form.title.trim(),
      gitBaseBranch: form.gitBaseBranch.trim(),
      summary: form.summary.trim() || undefined,
      agentCliId: form.agentCliId,
      agentCliConfigId: form.agentCliConfigId,
    })

    const files = selectedFiles.value
    let uploadFailCount = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) {
        continue
      }
      const relativePath = `${goalInputDirRelativePath(goal.id)}/${crypto.randomUUID()}-${sanitizeGoalInputBasename(file.name)}`
      try {
        await createOrUpdateProjectDoc(projectIdForSubmit, relativePath, file)
        await goalsApi.addSourceDoc(goal.id, {
          projectDocPath: relativePath,
          docType: docTypeForGoalSourceFile(file),
          sortOrder: i,
        })
        if (isZipFile(file)) {
          try {
            const unpackResult = await goalsApi.unpackInputZip(goal.id, {
              projectDocPath: relativePath,
            })
            if (unpackResult.extractedFileCount === 0) {
              uploadFailCount += 1
              message.warning('压缩包内没有可登记的有效文件，请更换后重试')
            }
          } catch (unpackError) {
            uploadFailCount += 1
            message.error(toErrorMessage(unpackError, '压缩包处理失败'))
          }
        }
      } catch {
        uploadFailCount += 1
      }
    }

    if (files.length === 0) {
      message.success('已创建需求')
    } else if (uploadFailCount === 0) {
      message.success('已创建需求，已关联资料')
    } else if (uploadFailCount === files.length) {
      message.warning('需求已创建，但资料未能上传，请稍后在项目知识库或详情中补充')
    } else {
      message.warning(
        `需求已创建，有 ${uploadFailCount} 个文件未能关联，其余已保存；可在知识库或稍后重试`,
      )
    }

    selectedFiles.value = []
    await router.push({ name: 'goal-detail', params: { goalId: goal.id } })
  } catch (error) {
    message.error(toErrorMessage(error, '创建需求失败'))
  } finally {
    submitting.value = false
  }
}

watch(
  () => form.projectId,
  async (projectId, prev) => {
    if (projectId === prev) return
    await refreshAccessContext(projectId)
    await loadConversationCliOptions(projectId)
    await loadBranchesForProject(projectId)
  },
)

watch(
  () => form.agentCliId,
  (id, prev) => {
    if (id === prev) return
    syncAgentToolConfigsForSelectedTool()
  },
)

watch(
  () => route.query.projectId,
  () => {
    syncProjectFromContext()
  },
)

watch(
  () => props.projectId,
  () => {
    syncProjectFromContext()
  },
)

onMounted(() => {
  pickRandomHeadline()
  headlineTimer = setInterval(() => {
    pickRandomHeadline()
  }, HEADLINE_ROTATE_INTERVAL_MS)
  syncProjectFromContext()
  void loadPageData()
})

onBeforeUnmount(() => {
  if (headlineTimer !== null) {
    clearInterval(headlineTimer)
    headlineTimer = null
  }
})
</script>

<template>
  <div
    class="fade-up flex min-h-[calc(var(--app-viewport-height)-8rem)] items-center justify-center px-4 py-8 sm:px-8"
  >
    <div class="w-full max-w-[1120px]">
      <div v-if="loading" class="py-24 text-center text-sm text-muted-foreground">加载中...</div>

      <template v-else>
        <header class="mb-8 flex flex-col items-center text-center sm:mb-10">
          <div
            class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-foreground/80"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5z" />
            </svg>
          </div>
          <Transition name="headline-fade" mode="out-in">
            <h1
              :key="currentHeadline"
              class="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl"
            >
              {{ currentHeadline }}
            </h1>
          </Transition>
        </header>

        <form
          class="overflow-hidden rounded-3xl border border-border bg-card/90 shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
          @submit.prevent="submit"
        >
          <div
            class="flex min-h-[360px] flex-col px-5 pt-5 sm:px-6 sm:pt-6"
          >
            <input
              v-model="form.title"
              type="text"
              maxlength="200"
              placeholder="输入你的目标"
              class="w-full shrink-0 border-0 bg-transparent text-lg font-medium text-foreground outline-none placeholder:text-muted-foreground"
            />
            <textarea
              v-model="form.summary"
              class="mt-4 min-h-0 flex-1 resize-none border-0 bg-transparent px-1 text-lg text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="摘要（可选）"
            />
          </div>

          <div v-if="selectedFiles.length > 0" class="mx-5 mb-2 flex flex-wrap gap-2 sm:mx-6">
            <span
              v-for="(file, index) in selectedFiles"
              :key="`${file.name}-${file.size}-${file.lastModified}`"
              class="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
            >
              <span class="max-w-[220px] truncate">{{ file.name }}</span>
              <span class="text-muted-foreground">{{ formatFileSize(file.size) }}</span>
              <button
                type="button"
                class="rounded-full text-muted-foreground transition hover:text-foreground"
                aria-label="移除文件"
                @click="removeFile(index)"
              >
                ×
              </button>
            </span>
          </div>

          <div class="border-t border-border">
            <div class="overflow-x-auto px-4 py-3 sm:px-5">
              <div class="flex min-w-full w-max flex-nowrap items-center gap-2 [&>*]:shrink-0">
                <input
                  ref="fileInputRef"
                  type="file"
                  multiple
                  accept=".zip,.md,.markdown,application/zip,text/markdown"
                  class="hidden"
                  @change="onFilesSelected"
                />
                <button
                  type="button"
                  class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground/80 transition hover:bg-muted"
                  aria-label="添加文件"
                  @click="openFilePicker"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </button>

                <AppSelect
                  v-model="form.agentCliId"
                  aria-label="Agent CLI"
                  :block="false"
                  :match-trigger-width="false"
                  :trigger-label-truncate="false"
                  :option-label-truncate="false"
                  :options="configuredCliToolOptions"
                  :disabled="loadingAgentConfigs || configuredCliTools.length === 0"
                  :panel-z-index="GOAL_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="GOAL_CREATE_SELECT_PANEL_PLACEMENT"
                  size="lg"
                  trigger-class="min-w-[120px] rounded-full border-border bg-background pl-3 pr-3 text-sm font-medium shadow-none"
                >
                  <template #prefix>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-foreground/70"
                      aria-hidden="true"
                    >
                      <path d="M4 17 10 11 4 5" />
                      <path d="M12 19h8" />
                    </svg>
                  </template>
                </AppSelect>

                <AppSelect
                  v-model="form.gitBaseBranch"
                  aria-label="Git 基准分支"
                  :block="false"
                  :match-trigger-width="false"
                  :trigger-label-truncate="false"
                  :option-label-truncate="false"
                  :options="gitBaseBranchOptions"
                  :disabled="loadingBranches || branchOptions.length === 0"
                  :panel-z-index="GOAL_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="GOAL_CREATE_SELECT_PANEL_PLACEMENT"
                  size="lg"
                  trigger-class="min-w-[120px] max-w-[200px] rounded-full border-border bg-background pl-3 pr-3 text-sm font-medium shadow-none"
                >
                  <template #prefix>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-foreground/70"
                      aria-hidden="true"
                    >
                      <line x1="6" x2="6" y1="3" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                  </template>
                </AppSelect>

                <AppSelect
                  v-model="form.agentCliConfigId"
                  aria-label="Agent CLI 配置"
                  :block="false"
                  :match-trigger-width="false"
                  :trigger-label-truncate="false"
                  :option-label-truncate="false"
                  :options="agentToolConfigOptions"
                  :disabled="loadingAgentConfigs || agentToolConfigs.length === 0"
                  :panel-z-index="GOAL_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="GOAL_CREATE_SELECT_PANEL_PLACEMENT"
                  size="lg"
                  trigger-class="min-w-[120px] rounded-full border-border bg-background pl-3 pr-3 text-sm font-medium shadow-none"
                >
                  <template #prefix>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-foreground/70"
                      aria-hidden="true"
                    >
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </svg>
                  </template>
                </AppSelect>

                <button
                  type="submit"
                  class="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="submitting || !canSubmit"
                  aria-label="创建需求"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m12 19 0-14" />
                    <path d="m5 12 7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.headline-fade-enter-active,
.headline-fade-leave-active {
  transition: opacity 0.45s ease;
}

.headline-fade-enter-from,
.headline-fade-leave-to {
  opacity: 0;
}
</style>
