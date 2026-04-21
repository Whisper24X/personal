<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  createProjectContainerRuntimeFormState,
  useProjectContainerRuntimeForm,
} from '@shared/composables/useProjectContainerRuntimeForm'
import type { ProjectContainerRuntimeConfig } from '@/types/api/projects'

defineOptions({
  name: 'ProjectRuntimeSettingsModal',
})

const props = defineProps<{
  open: boolean
  submitting: boolean
  projectName: string
  projectGitUrl: string
  initialContainerRuntime?: ProjectContainerRuntimeConfig | null
  errorMessage?: string
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (
    event: 'submit',
    payload: {
      containerRuntime?: ProjectContainerRuntimeConfig
    },
  ): void
}>()

const validationMessage = ref('')
const containerRuntimeForm = reactive(createProjectContainerRuntimeFormState())

const { syncFromContainerRuntime, validateContainerRuntime, buildContainerRuntimeConfig } =
  useProjectContainerRuntimeForm(containerRuntimeForm)

const modalTitle = computed(() => {
  return '隔离容器设置'
})

const syncFormValues = () => {
  syncFromContainerRuntime(props.initialContainerRuntime ?? null)
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

  validationMessage.value = ''
  emit('submit', {
    containerRuntime: buildContainerRuntimeConfig(),
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
  () => [props.initialContainerRuntime, props.projectName],
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

        <form
          class="grid max-h-[calc(95vh-56px)] gap-3 overflow-y-auto px-4 py-4 md:grid-cols-2"
          @submit.prevent="submit"
        >
          <label class="block space-y-1 md:col-span-2">
            <span class="text-xs font-semibold text-muted-foreground">
              结构化服务编排配置（JSON）
            </span>
            <textarea
              v-model="containerRuntimeForm.containerRunnerOrchestration"
              class="min-h-[240px] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
              spellcheck="false"
              placeholder='{&#10;  "services": [&#10;    {&#10;      "name": "ainative-app",&#10;      "workdir": "ainative-app",&#10;      "command": "npm run dev",&#10;      "port": 5173&#10;    }&#10;  ],&#10;  "preview": {&#10;    "service": "ainative-app",&#10;    "path": "/"&#10;  }&#10;}'
            />
            <p class="text-[11px] text-muted-foreground">
              平台配置是唯一真源；保存后会导出仓库根目录 `ainative.runner.json` 作为本地启动备份。
            </p>
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
              {{ props.submitting ? '保存中...' : '保存设置' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
