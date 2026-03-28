<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
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
  ProjectRunnerImageBuildStatus,
  ProjectRunnerTemplateConfig,
} from '@/types/api/projects'

defineOptions({
  name: 'ProjectRuntimeSettingsModal',
})

const props = defineProps<{
  open: boolean
  submitting: boolean
  projectName: string
  projectGitUrl: string
  initialContainerRuntime?: ProjectContainerRuntimeConfig | null
  initialRunnerTemplate?: ProjectRunnerTemplateConfig | null
  buildStatus?: ProjectRunnerImageBuildStatus | null
  errorMessage?: string
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (
    event: 'submit',
    payload: {
      containerRuntime?: ProjectContainerRuntimeConfig
      runnerTemplate?: ProjectRunnerTemplateConfig
    },
  ): void
}>()

const validationMessage = ref('')
const containerRuntimeForm = reactive(createProjectContainerRuntimeFormState())
const runnerTemplateForm = reactive(createProjectRunnerTemplateFormState())

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
} = useProjectRunnerTemplateForm(runnerTemplateForm, {
  getSandboxProfile: () => containerRuntimeForm.containerSandboxProfile,
})

const PROJECT_RUNTIME_SELECT_PANEL_Z_INDEX = 140

const modalTitle = computed(() => {
  return '隔离容器设置'
})

const formatStatusTime = (value?: string | null) => {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const buildStatusLabel = computed(() => {
  if (!props.buildStatus) {
    return '尚未触发重建'
  }

  if (props.buildStatus.status === 'building') {
    return '构建中'
  }

  if (props.buildStatus.status === 'success') {
    return '构建成功'
  }

  return '构建失败'
})

const buildStatusToneClass = computed(() => {
  if (!props.buildStatus) {
    return 'text-muted-foreground'
  }

  if (props.buildStatus.status === 'building') {
    return 'text-primary'
  }

  if (props.buildStatus.status === 'success') {
    return 'text-emerald-600'
  }

  return 'text-destructive'
})

const syncFormValues = () => {
  syncFromContainerRuntime(props.initialContainerRuntime ?? null)
  syncFromRunnerTemplate(props.initialRunnerTemplate ?? null, {
    whenMissing: 'empty',
  })
  validationMessage.value = ''
}

const close = () => {
  emit('update:open', false)
}

const submit = () => {
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
    containerRuntime: buildContainerRuntimeConfig(),
    runnerTemplate: buildRunnerTemplateConfig(),
  })
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      syncFormValues()
    }
  },
)

watch(
  () => [props.initialContainerRuntime, props.initialRunnerTemplate, props.projectName],
  () => {
    if (props.open) {
      syncFormValues()
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭隔离容器设置弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        aria-modal="true"
        role="dialog"
        class="relative z-10 flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <div class="min-w-0">
            <h2 class="text-sm font-semibold">{{ modalTitle }}</h2>
            <p class="mt-1 truncate text-xs text-muted-foreground">
              {{ props.projectName || '未命名项目' }}
            </p>
          </div>
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

        <form class="grid max-h-[calc(95vh-56px)] gap-3 overflow-y-auto px-4 py-4 md:grid-cols-2" @submit.prevent="submit">
          <div class="rounded-xl border border-border bg-background/60 p-3 md:col-span-2">
            <p class="text-xs font-semibold text-muted-foreground">当前项目</p>
            <p class="mt-1 text-sm font-medium text-foreground">
              {{ props.projectName || '未命名项目' }}
            </p>
            <p class="mt-1 break-all font-mono text-[11px] text-muted-foreground">
              {{ props.projectGitUrl || '-' }}
            </p>
          </div>

          <div class="rounded-xl border border-border bg-background/60 p-3 md:col-span-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs font-semibold text-muted-foreground">基础镜像重建状态</p>
                <p class="mt-1 text-sm font-medium" :class="buildStatusToneClass">
                  {{ buildStatusLabel }}
                </p>
              </div>
              <p
                v-if="props.buildStatus?.imageTag"
                class="max-w-full break-all font-mono text-[11px] text-muted-foreground"
              >
                {{ props.buildStatus.imageTag }}
              </p>
            </div>
            <div class="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
              <p>开始时间：{{ formatStatusTime(props.buildStatus?.startedAt) }}</p>
              <p>结束时间：{{ formatStatusTime(props.buildStatus?.finishedAt) }}</p>
            </div>
            <p v-if="props.buildStatus?.errorMessage" class="mt-2 text-sm text-destructive">
              {{ props.buildStatus.errorMessage }}
            </p>
            <p v-else-if="props.buildStatus?.status === 'building'" class="mt-2 text-[11px] text-muted-foreground">
              保存成功后会自动轮询状态，直到本次镜像重建完成。
            </p>
          </div>

          <div class="rounded-xl border border-border bg-background/60 p-3 md:col-span-2">
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
              :panel-z-index="PROJECT_RUNTIME_SELECT_PANEL_Z_INDEX"
              trigger-class="h-10 rounded-lg border-border bg-background px-3 text-sm shadow-none"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">容器网络模式</span>
            <AppSelect
              v-model="containerRuntimeForm.containerNetworkMode"
              aria-label="容器网络模式"
              :options="containerNetworkModeOptions"
              :panel-z-index="PROJECT_RUNTIME_SELECT_PANEL_Z_INDEX"
              trigger-class="h-10 rounded-lg border-border bg-background px-3 text-sm shadow-none"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">端口映射</span>
            <AppSelect
              v-model="containerRuntimeForm.containerExposeMode"
              aria-label="端口映射"
              :options="containerExposeModeOptions"
              :panel-z-index="PROJECT_RUNTIME_SELECT_PANEL_Z_INDEX"
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

          <label class="block space-y-1 md:col-span-2">
            <span class="text-xs font-semibold text-muted-foreground">
              容器环境变量（每行 `KEY=VALUE`）
            </span>
            <textarea
              v-model="containerRuntimeForm.containerEnv"
              class="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="PORT=8080&#10;NODE_ENV=development"
            />
          </label>

          <div class="rounded-xl border border-border bg-background/60 p-3 md:col-span-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs font-semibold text-muted-foreground">项目级 Runner 模板</p>
                <p class="mt-1 text-[11px] text-muted-foreground">
                  默认根据隔离容器设置自动生成；只有填写的项才会覆盖项目级配置。
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

          <p v-if="validationMessage" class="text-sm text-destructive md:col-span-2">
            {{ validationMessage }}
          </p>
          <p v-else-if="props.errorMessage" class="text-sm text-destructive md:col-span-2">
            {{ props.errorMessage }}
          </p>

          <div class="flex justify-end gap-2 pt-1 md:col-span-2">
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
              {{ props.submitting ? '保存中...' : '保存并重建镜像' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
