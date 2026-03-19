<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { projectsApi } from '@/api/projects'
import AppSelect from '@/components/core/select'
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
  errorMessage?: string
  size?: 'default' | 'large'
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'submit', payload: { name: string; description: string; gitUrl: string; defaultBranch: string }): void
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

  validationMessage.value = ''
  emit('submit', {
    name: name.value.trim(),
    description: description.value,
    gitUrl: gitUrl.value.trim(),
    defaultBranch: defaultBranch.value.trim(),
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
  () => [props.initialName, props.initialDescription, props.initialGitUrl, props.initialDefaultBranch, props.mode],
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
