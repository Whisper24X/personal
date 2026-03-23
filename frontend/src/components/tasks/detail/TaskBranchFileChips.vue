<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { tasksApi } from '@/api/tasks'
import type { TaskGitChangedFile, TaskGitStatus } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'
import {
  gitWorkspaceStatusBadgeClass,
  gitWorkspaceStatusLabel,
} from '@/utils/git-branch-file-status'

defineOptions({ name: 'TaskBranchFileChips' })

const emit = defineEmits<{
  'open-artifact': [file: TaskGitChangedFile]
}>()

const props = withDefaults(
  defineProps<{
    taskId: string
    /** 与右栏同步刷新（detail 内递增） */
    refreshToken?: number
  }>(),
  {
    refreshToken: 0,
  },
)

const statusInfo = ref<TaskGitStatus | null>(null)
const loading = ref(false)
const errorMessage = ref('')

const files = computed(() => statusInfo.value?.files ?? [])

const load = async () => {
  if (!props.taskId) return
  loading.value = true
  errorMessage.value = ''
  try {
    statusInfo.value = await tasksApi.gitStatus(props.taskId)
  } catch (error) {
    statusInfo.value = null
    errorMessage.value = toErrorMessage(error, '加载工作区变更失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.taskId, props.refreshToken] as const,
  () => {
    void load()
  },
  { immediate: true },
)

function fileBasename(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  return parts.length ? (parts[parts.length - 1] ?? path) : path
}

function chipKey(file: TaskGitChangedFile): string {
  return `${file.path}:${file.staged ? '1' : '0'}`
}

function statusBadgeText(status: string): string {
  const s = status.replace(/ /g, '')
  return s.length <= 2 ? s : s.slice(0, 2)
}

function onChipClick(file: TaskGitChangedFile) {
  emit('open-artifact', file)
}
</script>

<template>
  <!-- 与 AssistantMessageShell 内步骤条对齐：🤖 头像 w-7 + gap-2.5 -->
  <div
    v-if="taskId"
    class="min-w-0 pl-[calc(1.75rem+0.625rem)] pt-0.5 pb-0.5"
    aria-label="工作区变更文件"
  >
    <p v-if="errorMessage && !loading" class="text-destructive mb-1 text-[11px]">{{ errorMessage }}</p>

    <p v-else-if="loading && files.length === 0" class="text-muted-foreground mb-1 text-[11px]">加载变更…</p>

    <div
      v-if="files.length > 0"
      class="flex max-h-32 flex-wrap gap-2 overflow-y-auto"
    >
      <button
        v-for="file in files"
        :key="chipKey(file)"
        class="border-border/50 bg-background/80 hover:bg-muted/60 inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[12px] leading-snug transition-colors"
        type="button"
        :title="`${gitWorkspaceStatusLabel(file.status)}${file.staged ? '（已暂存）' : ''} · ${file.path}`"
        @click="onChipClick(file)"
      >
        <span
          class="shrink-0 rounded px-1 py-0.5 font-mono text-[10px] font-medium"
          :class="gitWorkspaceStatusBadgeClass(file.status)"
        >
          {{ statusBadgeText(file.status) }}
        </span>
        <span class="min-w-0 truncate text-foreground">{{ fileBasename(file.path) }}</span>
      </button>
    </div>
  </div>
</template>
