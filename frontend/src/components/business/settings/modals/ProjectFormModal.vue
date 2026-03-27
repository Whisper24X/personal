<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { projectsApi } from '@/api/projects'
import AppSelect from '@/components/core/select'
import {
  createProjectContainerRuntimeFormState,
  useProjectContainerRuntimeForm,
} from '@/composables/useProjectContainerRuntimeForm'
import {
  createProjectRunnerTemplateFormState,
  useProjectRunnerTemplateForm,
} from '@/composables/useProjectRunnerTemplateForm'
import type {
  ProjectContainerRuntimeConfig,
  ProjectRunnerTemplateConfig,
} from '@/types/api/projects'
import { toErrorMessage } from '@/utils/http/to-error-message'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  businessLineId?: string
  submitting: boolean
  initialName: string
  initialDescription: string
  initialGitUrl: string
  initialDefaultBranch: string
  initialContainerRuntime?: ProjectContainerRuntimeConfig | null
  initialRunnerTemplate?: ProjectRunnerTemplateConfig | null
  errorMessage?: string
  size?: 'default' | 'large'
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (
    event: 'submit',
    payload: {
      name: string
      description: string
      gitUrl: string
      defaultBranch: string
      containerRuntime?: ProjectContainerRuntimeConfig
      runnerTemplate?: ProjectRunnerTemplateConfig
    },
  ): void
}>()

const name = ref('')
const description = ref('')
const gitUrl = ref('')
const defaultBranch = ref('main')
const validationMessage = ref('')
const branchOptions = ref<string[]>([])
const inspectingRepository = ref(false)
const inspectionErrorMessage = ref('')
const nameEditedByUser = ref(false)
const defaultBranchEditedByUser = ref(false)
const autoFilledName = ref('')
const containerRuntimeForm = reactive(createProjectContainerRuntimeFormState())
const runnerTemplateForm = reactive(createProjectRunnerTemplateFormState())
let inspectTimer: ReturnType<typeof setTimeout> | null = null
let inspectRequestId = 0

const modalTitle = computed(() => {
  return props.mode === 'edit' ? '编辑项目' : '新建项目'
})

const sectionClass = computed(() => {
  return props.size === 'large'
    ? 'relative z-10 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl'
    : 'relative z-10 w-full max-w-xl rounded-2xl border border-border bg-background shadow-2xl'
})

const formClass = computed(() => {
  return props.size === 'large'
    ? 'max-h-[calc(95vh-56px)] space-y-3 overflow-y-auto px-4 py-4'
    : 'space-y-3 px-4 py-4'
})

const branchSelectOptions = computed(() => {
  return branchOptions.value.map((branch) => ({
    label: branch,
    value: branch,
  }))
})

const {
  containerSandboxProfileOptions,
  containerNetworkModeOptions,
  containerExposeModeOptions,
  syncFromContainerRuntime,
  validateContainerRuntime,
  buildContainerRuntimeConfig,
} = useProjectContainerRuntimeForm(containerRuntimeForm)
const {
  applyDefaultRunnerTemplates,
  clearRunnerTemplateOverrides,
  syncFromRunnerTemplate,
  validateRunnerTemplate,
  buildRunnerTemplateConfig,
} = useProjectRunnerTemplateForm(runnerTemplateForm)

const PROJECT_FORM_SELECT_PANEL_Z_INDEX = 130

const clearInspectTimer = () => {
  if (inspectTimer) {
    clearTimeout(inspectTimer)
    inspectTimer = null
  }
}

const clearInspectionMeta = () => {
  branchOptions.value = []
  inspectingRepository.value = false
  inspectionErrorMessage.value = ''
}

const resetAutoFillState = () => {
  nameEditedByUser.value = false
  defaultBranchEditedByUser.value = false
  autoFilledName.value = ''
  clearInspectionMeta()
}

const syncFormValues = () => {
  name.value = props.initialName
  description.value = props.initialDescription
  gitUrl.value = props.initialGitUrl
  defaultBranch.value = props.initialDefaultBranch || 'main'
  syncFromContainerRuntime(props.initialContainerRuntime ?? null)
  syncFromRunnerTemplate(props.initialRunnerTemplate ?? null, {
    whenMissing: 'empty',
  })
  validationMessage.value = ''
  resetAutoFillState()
}

const close = () => {
  emit('update:open', false)
}

const markNameAsEdited = () => {
  if (props.mode !== 'create') {
    return
  }

  nameEditedByUser.value = true
}

const markDefaultBranchAsEdited = () => {
  if (props.mode !== 'create') {
    return
  }

  defaultBranchEditedByUser.value = true
}

const applyRepositoryInspection = (inspection: {
  repoName: string
  branches: string[]
  recommendedDefaultBranch: string | null
}) => {
  branchOptions.value = inspection.branches

  if (
    inspection.repoName &&
    (!nameEditedByUser.value ||
      !name.value.trim() ||
      name.value.trim() === autoFilledName.value)
  ) {
    name.value = inspection.repoName
    autoFilledName.value = inspection.repoName
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
    defaultBranch.value = recommendedBranch
    return
  }

  if (!inspection.branches.includes(defaultBranch.value.trim())) {
    defaultBranch.value = recommendedBranch
  }
}

const inspectRepository = async () => {
  const businessLineId = props.businessLineId?.trim() ?? ''
  const normalizedGitUrl = gitUrl.value.trim()

  if (!businessLineId || !normalizedGitUrl) {
    clearInspectionMeta()
    return
  }

  const currentRequestId = ++inspectRequestId
  inspectingRepository.value = true
  inspectionErrorMessage.value = ''

  try {
    const inspection = await projectsApi.inspectRepository({
      businessLineId,
      gitUrl: normalizedGitUrl,
    })

    if (currentRequestId !== inspectRequestId) {
      return
    }

    applyRepositoryInspection(inspection)
  } catch (error) {
    if (currentRequestId !== inspectRequestId) {
      return
    }

    clearInspectionMeta()
    inspectionErrorMessage.value = toErrorMessage(
      error,
      '读取仓库信息失败，请检查 Git 地址和访问权限',
    )
  } finally {
    if (currentRequestId === inspectRequestId) {
      inspectingRepository.value = false
    }
  }
}

const scheduleRepositoryInspection = () => {
  clearInspectTimer()
  inspectTimer = setTimeout(() => {
    void inspectRepository()
  }, 450)
}

const submit = () => {
  if (!name.value.trim()) {
    validationMessage.value = '项目名称不能为空'
    return
  }

  if (!gitUrl.value.trim()) {
    validationMessage.value = '仓库地址不能为空'
    return
  }

  if (!defaultBranch.value.trim()) {
    validationMessage.value = '默认分支不能为空'
    return
  }

  const containerRuntimeValidationMessage = validateContainerRuntime()
  if (containerRuntimeValidationMessage) {
    validationMessage.value = containerRuntimeValidationMessage
    return
  }

  const runnerTemplateValidationMessage = validateRunnerTemplate()
  if (runnerTemplateValidationMessage) {
    validationMessage.value = runnerTemplateValidationMessage
    return
  }

  validationMessage.value = ''
  emit('submit', {
    name: name.value.trim(),
    description: description.value,
    gitUrl: gitUrl.value.trim(),
    defaultBranch: defaultBranch.value.trim(),
    containerRuntime: buildContainerRuntimeConfig(),
    runnerTemplate: buildRunnerTemplateConfig(),
  })
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    syncFormValues()
  },
)

watch(
  () => [
    props.initialName,
    props.initialDescription,
    props.initialGitUrl,
    props.initialDefaultBranch,
    props.initialContainerRuntime,
    props.initialRunnerTemplate,
    props.mode,
  ],
  () => {
    if (!props.open) {
      return
    }

    syncFormValues()
  },
)

watch(
  () => [props.open, props.mode, props.businessLineId, gitUrl.value],
  ([open, mode]) => {
    clearInspectTimer()
    inspectRequestId += 1

    if (!open || mode !== 'create') {
      clearInspectionMeta()
      return
    }

    if (!gitUrl.value.trim() || !props.businessLineId?.trim()) {
      clearInspectionMeta()
      return
    }

    scheduleRepositoryInspection()
  },
)

onBeforeUnmount(() => {
  clearInspectTimer()
  inspectRequestId += 1
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭项目表单弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        aria-modal="true"
        role="dialog"
        :class="sectionClass"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="text-sm font-semibold">{{ modalTitle }}</h2>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="close"
          >
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
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        <form :class="formClass" @submit.prevent="submit">
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">仓库地址</span>
            <input
              v-model="gitUrl"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="git@gitlab.example.com:group/project.git"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">默认分支</span>
            <AppSelect
              v-if="props.mode === 'create' && branchOptions.length > 0"
              v-model="defaultBranch"
              aria-label="默认分支"
              :options="branchSelectOptions"
              :panel-z-index="PROJECT_FORM_SELECT_PANEL_Z_INDEX"
              trigger-class="h-10 rounded-lg border-border bg-background px-3 text-sm shadow-none"
              @change="markDefaultBranchAsEdited"
            />
            <input
              v-else
              v-model="defaultBranch"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="main"
              @input="markDefaultBranchAsEdited"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">项目名称</span>
            <input
              v-model="name"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="输入项目名称"
              @input="markNameAsEdited"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">描述（可选）</span>
            <input
              v-model="description"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="输入项目描述"
            />
          </label>

          <div class="rounded-xl border border-border bg-background/60 p-3">
            <p class="text-xs font-semibold text-muted-foreground">项目级隔离容器配置</p>
            <p class="mt-1 text-[11px] text-muted-foreground">
              留空表示跟随全局配置，仅覆盖当前项目隔离容器启动参数。
            </p>
          </div>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">Sandbox Profile</span>
            <AppSelect
              v-model="containerRuntimeForm.containerSandboxProfile"
              aria-label="Sandbox Profile"
              :options="containerSandboxProfileOptions"
              :panel-z-index="PROJECT_FORM_SELECT_PANEL_Z_INDEX"
              trigger-class="h-10 rounded-lg border-border bg-background px-3 text-sm shadow-none"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">容器网络模式</span>
            <AppSelect
              v-model="containerRuntimeForm.containerNetworkMode"
              aria-label="容器网络模式"
              :options="containerNetworkModeOptions"
              :panel-z-index="PROJECT_FORM_SELECT_PANEL_Z_INDEX"
              trigger-class="h-10 rounded-lg border-border bg-background px-3 text-sm shadow-none"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">端口映射</span>
            <AppSelect
              v-model="containerRuntimeForm.containerExposeMode"
              aria-label="端口映射"
              :options="containerExposeModeOptions"
              :panel-z-index="PROJECT_FORM_SELECT_PANEL_Z_INDEX"
              trigger-class="h-10 rounded-lg border-border bg-background px-3 text-sm shadow-none"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">启动超时（毫秒）</span>
            <input
              v-model="containerRuntimeForm.containerStartTimeoutMs"
              type="number"
              min="1000"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="例如 90000"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">暴露宿主 IP（可选）</span>
            <input
              v-model="containerRuntimeForm.containerExposeHostIp"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="例如 127.0.0.1"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">容器暴露端口（可选）</span>
            <input
              v-model="containerRuntimeForm.containerExposeContainerPort"
              type="number"
              min="1"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="例如 8080"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">内存上限 MB（可选）</span>
            <input
              v-model="containerRuntimeForm.containerMemoryMb"
              type="number"
              min="1"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="例如 2048"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">PIDs 上限（可选）</span>
            <input
              v-model="containerRuntimeForm.containerPidsLimit"
              type="number"
              min="1"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="例如 256"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">
              容器环境变量（每行 `KEY=VALUE`）
            </span>
            <textarea
              v-model="containerRuntimeForm.containerEnv"
              class="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="PORT=8080&#10;NODE_ENV=development"
            />
          </label>

          <div class="rounded-xl border border-border bg-background/60 p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs font-semibold text-muted-foreground">项目级 Runner 模板</p>
                <p class="mt-1 text-[11px] text-muted-foreground">
                    默认继承 `backend/runner/` 下三份模板；只有填写的项才会覆盖项目级配置。
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                  @click="applyDefaultRunnerTemplates"
                >
                    载入默认模板
                </button>
                <button
                  type="button"
                  class="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                  @click="clearRunnerTemplateOverrides"
                >
                  清空并回退全局
                </button>
              </div>
            </div>
          </div>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">Dockerfile.runner</span>
            <textarea
              v-model="runnerTemplateForm.runnerDockerfile"
              class="min-h-[260px] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
              spellcheck="false"
              placeholder="输入项目级 Dockerfile.runner"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">sandbox.nginx.conf</span>
            <textarea
              v-model="runnerTemplateForm.runnerSandboxNginxConf"
              class="min-h-[260px] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
              spellcheck="false"
              placeholder="输入项目级 sandbox.nginx.conf"
            />
          </label>

          <label class="block space-y-1 md:col-span-2">
            <span class="text-xs font-semibold text-muted-foreground">sandbox.supervisord.conf</span>
            <textarea
              v-model="runnerTemplateForm.runnerSandboxSupervisordConf"
              class="min-h-[260px] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
              spellcheck="false"
              placeholder="输入项目级 sandbox.supervisord.conf"
            />
          </label>

          <p v-if="props.mode === 'create' && inspectingRepository" class="text-xs text-muted-foreground">
            正在读取仓库信息...
          </p>
          <p v-else-if="props.mode === 'create' && inspectionErrorMessage" class="text-xs text-destructive">
            {{ inspectionErrorMessage }}
          </p>

          <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
          <p v-else-if="props.errorMessage" class="text-sm text-destructive">{{ props.errorMessage }}</p>

          <div class="flex justify-end gap-2 pt-1">
            <button
              type="button"
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              @click="close"
            >
              取消
            </button>
            <button
              type="submit"
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.submitting"
            >
              {{ props.submitting ? '保存中...' : props.mode === 'edit' ? '保存修改' : '新建项目' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
