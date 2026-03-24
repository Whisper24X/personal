<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from '@/hooks'
import { useAccessStore } from '@/stores/modules/access'
import { businessLinesApi, type AgentToolConfig } from '@/api/business-lines'
import { goalsApi } from '@/api/goals'
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
import { fetchAllPages } from '@/utils/pagination'

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
const submitting = ref(false)
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
  agentCliId: '' as SupportedCliToolId | '',
  agentCliConfigId: '',
})

const configuredCliToolOptions = computed(() =>
  configuredCliTools.value.map((tool) => ({ label: tool.label, value: tool.id })),
)

const agentToolConfigOptions = computed(() =>
  agentToolConfigs.value.map((config) => ({ label: config.name, value: config.id })),
)

const canSubmit = computed(() => {
  return (
    Boolean(form.projectId?.trim()) &&
    Boolean(form.title?.trim()) &&
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

const openFilePicker = () => {
  fileInputRef.value?.click()
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
    message.error('当前项目暂无创建 Goal 权限')
    return
  }
  const projectIdForSubmit = resolveProjectIdFromContext().trim() || form.projectId.trim()
  if (!projectIdForSubmit) {
    message.error('请先在左侧栏选择项目后再创建 Goal')
    return
  }
  if (!form.title.trim()) {
    message.error('请填写目标')
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
      summary: form.summary.trim() || undefined,
      agentCliId: form.agentCliId,
      agentCliConfigId: form.agentCliConfigId,
    })

    const files = selectedFiles.value
    let uploadFailCount = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const relativePath = `${goalInputDirRelativePath(goal.id)}/${crypto.randomUUID()}-${sanitizeGoalInputBasename(file.name)}`
      try {
        await createOrUpdateProjectDoc(projectIdForSubmit, relativePath, file)
        await goalsApi.addSourceDoc(goal.id, {
          projectDocPath: relativePath,
          docType: 'requirement',
          sortOrder: i,
        })
      } catch {
        uploadFailCount += 1
      }
    }

    if (files.length === 0) {
      message.success('已创建 Goal')
    } else if (uploadFailCount === 0) {
      message.success('已创建 Goal，已关联资料')
    } else if (uploadFailCount === files.length) {
      message.warning('Goal 已创建，但资料未能上传，请稍后在项目知识库或详情中补充')
    } else {
      message.warning(
        `Goal 已创建，有 ${uploadFailCount} 个文件未能关联，其余已保存；可在知识库或稍后重试`,
      )
    }

    selectedFiles.value = []
    await router.push({ name: 'goal-detail', params: { goalId: goal.id } })
  } catch (error) {
    message.error(toErrorMessage(error, '创建 Goal 失败'))
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
  syncProjectFromContext()
  void loadPageData()
})
</script>

<template>
  <div
    class="fade-up flex min-h-[calc(var(--app-viewport-height)-8rem)] items-center justify-center px-4 py-8 sm:px-8"
  >
    <div class="w-full max-w-[720px]">
      <div v-if="loading" class="py-24 text-center text-sm text-muted-foreground">加载中...</div>

      <template v-else>
        <header class="mb-8 text-center sm:mb-10">
          <h1 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            新建 Goal
          </h1>
          <p class="mt-2 text-sm text-muted-foreground">
            填写目标并配置用于生成 PRD 与拆解计划的 Agent CLI
          </p>
        </header>

        <form
          class="space-y-5 overflow-hidden rounded-3xl border border-border bg-card/90 p-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
          @submit.prevent="submit"
        >
          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground">目标</label>
            <input
              v-model="form.title"
              type="text"
              maxlength="200"
              placeholder="输入你的目标"
              class="border-input bg-background focus-visible:ring-ring w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus-visible:ring-2"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground">摘要（可选）</label>
            <textarea
              v-model="form.summary"
              rows="3"
              placeholder="简要描述目标背景或范围"
              class="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none focus-visible:ring-2"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground">关联资料（可选）</label>
            <p class="mb-2 text-xs text-muted-foreground">
              暂时只支持上传md文件, 将保存到项目文档并用于生成 PRD
            </p>
            <div v-if="selectedFiles.length > 0" class="mb-2 flex flex-wrap gap-2">
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
            <div class="flex items-center gap-2">
              <input
                ref="fileInputRef"
                type="file"
                multiple
                class="hidden"
                @change="onFilesSelected"
              />
              <button
                type="button"
                class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground/80 transition hover:bg-muted"
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
              <span class="text-xs text-muted-foreground">可多选</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="w-full text-sm font-medium text-foreground">Agent CLI</span>
            <AppSelect
              v-model="form.agentCliId"
              aria-label="Agent CLI"
              :block="false"
              :options="configuredCliToolOptions"
              :disabled="loadingAgentConfigs || configuredCliTools.length === 0"
              :panel-z-index="GOAL_CREATE_SELECT_PANEL_Z_INDEX"
              :panel-placement="GOAL_CREATE_SELECT_PANEL_PLACEMENT"
              size="lg"
              trigger-class="min-w-[140px] rounded-full border border-border bg-background px-3 py-2 text-sm font-medium shadow-none"
            />
            <AppSelect
              v-model="form.agentCliConfigId"
              aria-label="Agent CLI 配置"
              :block="false"
              :options="agentToolConfigOptions"
              :disabled="loadingAgentConfigs || agentToolConfigs.length === 0"
              :panel-z-index="GOAL_CREATE_SELECT_PANEL_Z_INDEX"
              :panel-placement="GOAL_CREATE_SELECT_PANEL_PLACEMENT"
              size="lg"
              trigger-class="min-w-[160px] rounded-full border border-border bg-background px-3 py-2 text-sm font-medium shadow-none"
            />
          </div>
          <p
            v-if="!loadingAgentConfigs && form.projectId && configuredCliTools.length === 0"
            class="text-xs text-amber-600 dark:text-amber-500"
          >
            当前业务线暂无可用 Agent CLI 配置，请先在业务线设置中配置。
          </p>

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="border-input bg-background hover:bg-muted h-10 rounded-xl border px-4 text-sm font-medium"
              @click="router.back()"
            >
              取消
            </button>
            <button
              type="submit"
              class="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl px-5 text-sm font-medium disabled:opacity-50"
              :disabled="submitting || !canSubmit"
            >
              {{ submitting ? '创建中…' : '创建' }}
            </button>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>
