<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { tasksApi } from '@/api/tasks'
import FilePreviewCard from '@/components/core/file-browser/FilePreviewCard.vue'
import FileTree from '@/components/core/file-browser/FileTree.vue'
import { createFileTreeNodes } from '@/components/core/file-browser/file-tree'
import type { FileBrowserPreview } from '@/components/core/file-browser/types'
import type { TaskGitChangedFile } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'TaskDetailArtifactsPanel',
})

const props = withDefaults(
  defineProps<{
    taskId: string
    refreshToken?: number
    /** 本次右栏刷新对应的工作区变更路径；null 表示变更路径未知，需要保守重刷预览 */
    artifactRefreshPaths?: string[] | null
    /** 从执行区文件芯片打开时传入，用于选中并预览 */
    artifactFilePath?: string | null
    /** 递增时应用 artifactFilePath */
    artifactOpenNonce?: number
  }>(),
  {
    refreshToken: 0,
    artifactRefreshPaths: () => [],
    artifactFilePath: null,
    artifactOpenNonce: 0,
  },
)

const loading = ref(false)
const errorMessage = ref('')
const files = ref<TaskGitChangedFile[]>([])
const selectedPath = ref<string | null>(null)
const preview = ref<FileBrowserPreview | null>(null)
const previewLoading = ref(false)
const previewErrorMessage = ref('')
const refreshInFlight = ref(false)
const pendingRefresh = ref(false)
const emptyPaths = new Set<string>()
const ARTIFACT_PANEL_MIN_WIDTH = 160
const ARTIFACT_PANEL_MAX_WIDTH = 280
const ARTIFACT_PANEL_CHROME_WIDTH = 72
const FILE_NAME_FONT =
  '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

let measureCanvas: HTMLCanvasElement | null = null
let previewRequestId = 0
let inFlightPreviewRequest: {
  path: string
  promise: Promise<FileBrowserPreview>
} | null = null

const flatFiles = computed(() => {
  return [...files.value].sort((left, right) => {
    const nameCompare = resolveFileName(left.path).localeCompare(
      resolveFileName(right.path),
      undefined,
      {
        numeric: true,
        sensitivity: 'base',
      },
    )

    if (nameCompare !== 0) {
      return nameCompare
    }

    return left.path.localeCompare(right.path, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  })
})

const measureFileNameWidth = (fileName: string) => {
  if (typeof document === 'undefined') {
    return fileName.length * 7.25
  }

  measureCanvas ??= document.createElement('canvas')
  const context = measureCanvas.getContext('2d')
  if (!context) {
    return fileName.length * 7.25
  }

  context.font = FILE_NAME_FONT
  return context.measureText(fileName).width
}

const artifactsPanelWidth = computed(() => {
  const widestFileName = flatFiles.value.reduce((widest, file) => {
    return Math.max(widest, measureFileNameWidth(resolveFileName(file.path)))
  }, 0)

  const nextWidth = Math.ceil(widestFileName + ARTIFACT_PANEL_CHROME_WIDTH)
  return `${Math.min(ARTIFACT_PANEL_MAX_WIDTH, Math.max(ARTIFACT_PANEL_MIN_WIDTH, nextWidth))}px`
})

const fileNodes = computed(() => {
  return createFileTreeNodes(
    flatFiles.value.map((file) => ({
      name: resolveFileName(file.path),
      path: file.path,
      isDir: false,
    })),
  )
})

const normalizePreviewType = (value: FileBrowserPreview): FileBrowserPreview => {
  if (value.previewType === 'text' && value.mimeType === 'text/markdown') {
    return {
      ...value,
      previewType: 'markdown',
    }
  }

  return value
}

const resolveFileName = (filePath: string) => {
  const segments = filePath.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? filePath
}

const fetchPreview = (path: string) => {
  if (inFlightPreviewRequest?.path === path) {
    return inFlightPreviewRequest.promise
  }

  const promise = (async () => {
    const nextPreview = normalizePreviewType(await tasksApi.gitArtifactPreview(props.taskId, path))
    if (['pdf', 'video', 'audio'].includes(nextPreview.previewType) && !nextPreview.tooLarge) {
      nextPreview.dataUrl = tasksApi.getGitArtifactRawUrl(props.taskId, path)
    }
    return nextPreview
  })()

  inFlightPreviewRequest = {
    path,
    promise,
  }

  void promise.finally(() => {
    if (inFlightPreviewRequest?.promise === promise) {
      inFlightPreviewRequest = null
    }
  })

  return promise
}

const loadPreview = async (path: string) => {
  const requestId = ++previewRequestId
  previewLoading.value = true
  previewErrorMessage.value = ''

  try {
    const nextPreview = await fetchPreview(path)
    if (requestId !== previewRequestId) {
      return
    }
    preview.value = nextPreview
  } catch (error) {
    if (requestId !== previewRequestId) {
      return
    }
    preview.value = null
    previewErrorMessage.value = toErrorMessage(error, '加载产物预览失败')
  } finally {
    if (requestId === previewRequestId) {
      previewLoading.value = false
    }
  }
}

const shouldReloadPreview = ({
  previousSelectedPath,
  nextSelectedPath,
  refreshPaths,
}: {
  previousSelectedPath: string | null
  nextSelectedPath: string
  refreshPaths: string[] | null
}) => {
  if (nextSelectedPath !== previousSelectedPath) {
    return true
  }

  if (!preview.value) {
    return true
  }

  if (refreshPaths === null) {
    return true
  }

  return refreshPaths.includes(nextSelectedPath)
}

const performLoadFiles = async (refreshPaths: string[] | null) => {
  loading.value = true
  errorMessage.value = ''

  try {
    const status = await tasksApi.gitStatus(props.taskId)
    const nextFiles = status.files ?? []
    files.value = nextFiles
    const previousSelectedPath = selectedPath.value

    const preferred = props.artifactFilePath?.trim()
    const preferredInList = Boolean(preferred && nextFiles.some((f) => f.path === preferred))

    const selectedStillExists = selectedPath.value
      ? nextFiles.some((file) => file.path === selectedPath.value)
      : false
    const nextSelectedPath = preferredInList
      ? preferred!
      : preferred && nextFiles.length === 0
        ? preferred
        : selectedStillExists
          ? selectedPath.value
          : (nextFiles[0]?.path ?? null)

    selectedPath.value = nextSelectedPath

    if (nextSelectedPath) {
      if (
        shouldReloadPreview({
          previousSelectedPath,
          nextSelectedPath,
          refreshPaths,
        })
      ) {
        await loadPreview(nextSelectedPath)
      }
    } else {
      preview.value = null
      previewErrorMessage.value = ''
    }
  } catch (error) {
    files.value = []
    selectedPath.value = null
    preview.value = null
    errorMessage.value = toErrorMessage(error, '加载产物列表失败')
  } finally {
    loading.value = false
  }
}

const loadFiles = async () => {
  if (refreshInFlight.value) {
    pendingRefresh.value = true
    return
  }

  refreshInFlight.value = true

  try {
    do {
      pendingRefresh.value = false
      await performLoadFiles(props.artifactRefreshPaths)
    } while (pendingRefresh.value)
  } finally {
    refreshInFlight.value = false
  }
}

const selectFile = async (filePath: string) => {
  selectedPath.value = filePath
  await loadPreview(filePath)
}

const handleSelectFile = async (node: { path: string; isDir: boolean }) => {
  if (node.isDir) {
    return
  }

  await selectFile(node.path)
}

watch(
  [() => props.taskId, () => props.refreshToken],
  async () => {
    await loadFiles()
  },
  {
    immediate: true,
  },
)

watch(
  () => [props.artifactOpenNonce, props.artifactFilePath] as const,
  async ([nonce, path]) => {
    if (!nonce || nonce <= 0) return
    const trimmed = path?.trim()
    if (!trimmed) return
    await selectFile(trimmed)
  },
  { flush: 'post', immediate: true },
)
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 overflow-hidden">
    <aside
      :style="{ width: artifactsPanelWidth }"
      class="border-border/70 flex min-h-0 shrink-0 flex-col border-r bg-muted/10"
    >
      <div class="min-h-0 flex-1 overflow-auto px-1.5 py-1.5">
        <div class="space-y-1.5 text-xs">
          <p v-if="errorMessage" class="px-1.5 text-destructive">{{ errorMessage }}</p>
          <p v-else-if="loading" class="px-1.5 text-muted-foreground">正在加载产物...</p>
          <p v-else-if="fileNodes.length === 0" class="px-1.5 text-muted-foreground">暂无产物</p>

          <div v-else class="artifacts-file-list">
            <FileTree
              :nodes="fileNodes"
              :selected-path="selectedPath"
              :expanded-paths="emptyPaths"
              :loading-paths="emptyPaths"
              @toggle-dir="void 0"
              @select-file="handleSelectFile"
            />
          </div>
        </div>
      </div>
    </aside>

    <FilePreviewCard
      :selected-path="selectedPath"
      :preview="preview"
      :loading="previewLoading"
      :error-message="previewErrorMessage"
      empty-message="选择产物以预览内容"
    />
  </div>
</template>

<style scoped>
:deep(.artifacts-file-list .bg-primary) {
  display: none;
}
</style>
