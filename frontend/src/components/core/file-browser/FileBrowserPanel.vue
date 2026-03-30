<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toErrorMessage } from '@/utils/http/to-error-message'
import FileTree from './FileTree.vue'
import FilePreviewCard from './FilePreviewCard.vue'
import {
  createFileTreeNodes,
  findFileTreeNode,
  updateFileTreeChildren,
  type FileTreeNode,
} from './file-tree'
import type { FileBrowserLoadPreview, FileBrowserLoadTree, FileBrowserPreview } from './types'

defineOptions({
  name: 'FileBrowserPanel',
})

const props = withDefaults(
  defineProps<{
    sourceKey: string | number
    loadTree: FileBrowserLoadTree
    loadPreview: FileBrowserLoadPreview
    headerTitle?: string | null
    hideHeader?: boolean
    hideHeaderTitle?: boolean
    hideRefreshButton?: boolean
    rootPath?: string
    refreshToken?: number
    emptyText?: string
    treeLoadErrorText?: string
    dirLoadErrorText?: string
    previewLoadErrorText?: string
    adaptiveTreeWidth?: boolean
    treeMinWidth?: number
    treeMaxWidth?: number
  }>(),
  {
    headerTitle: null,
    hideHeader: false,
    hideHeaderTitle: false,
    hideRefreshButton: false,
    rootPath: '.',
    refreshToken: 0,
    emptyText: '当前工作区为空',
    treeLoadErrorText: '加载文件树失败',
    dirLoadErrorText: '加载目录失败',
    previewLoadErrorText: '加载文件预览失败',
    adaptiveTreeWidth: false,
    treeMinWidth: 200,
    treeMaxWidth: 320,
  },
)

const treeLoading = ref(false)
const treeErrorMessage = ref('')
const treeNodes = ref<FileTreeNode[]>([])
const expandedPaths = ref<Set<string>>(new Set())
const loadingPaths = ref<Set<string>>(new Set())
const selectedPath = ref<string | null>(null)
const preview = ref<FileBrowserPreview | null>(null)
const previewLoading = ref(false)
const previewErrorMessage = ref('')
const refreshInFlight = ref(false)
const pendingRefresh = ref(false)
const pendingRefreshPreserveExpanded = ref(false)
const TREE_ROW_BASE_WIDTH = 72
const TREE_ROW_DEPTH_WIDTH = 10
const FILE_NAME_FONT = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

let measureCanvas: HTMLCanvasElement | null = null

const updateLoadingPath = (path: string, isLoading: boolean) => {
  const next = new Set(loadingPaths.value)

  if (isLoading) {
    next.add(path)
  } else {
    next.delete(path)
  }

  loadingPaths.value = next
}

const addExpandedPath = (path: string) => {
  const next = new Set(expandedPaths.value)
  next.add(path)
  expandedPaths.value = next
}

const removeExpandedPath = (path: string) => {
  const next = new Set(expandedPaths.value)
  next.delete(path)
  expandedPaths.value = next
}

const resetState = () => {
  treeNodes.value = []
  expandedPaths.value = new Set()
  loadingPaths.value = new Set()
  selectedPath.value = null
  preview.value = null
  treeErrorMessage.value = ''
  previewErrorMessage.value = ''
}

const normalizePreviewType = (raw: FileBrowserPreview): FileBrowserPreview => {
  if (raw.previewType === 'text' && raw.mimeType === 'text/markdown') {
    return { ...raw, previewType: 'markdown' }
  }
  return raw
}

const measureLabelWidth = (label: string) => {
  if (typeof document === 'undefined') {
    return label.length * 7.25
  }

  measureCanvas ??= document.createElement('canvas')
  const context = measureCanvas.getContext('2d')
  if (!context) {
    return label.length * 7.25
  }

  context.font = FILE_NAME_FONT
  return context.measureText(label).width
}

const collectVisibleNodes = (nodes: FileTreeNode[], depth = 0): Array<{ name: string; depth: number }> => {
  return nodes.flatMap((node) => {
    const visibleNodes = [{ name: node.name, depth }]
    if (node.isDir && node.childrenLoaded && expandedPaths.value.has(node.path)) {
      visibleNodes.push(...collectVisibleNodes(node.children ?? [], depth + 1))
    }
    return visibleNodes
  })
}

const treePanelWidth = computed(() => {
  if (!props.adaptiveTreeWidth) {
    return null
  }

  const visibleNodes = collectVisibleNodes(treeNodes.value)
  const widestVisibleNode = visibleNodes.reduce((widest, node) => {
    const nodeWidth = measureLabelWidth(node.name) + TREE_ROW_BASE_WIDTH + node.depth * TREE_ROW_DEPTH_WIDTH
    return Math.max(widest, nodeWidth)
  }, 0)

  const nextWidth = Math.ceil(widestVisibleNode)
  return `${Math.min(props.treeMaxWidth, Math.max(props.treeMinWidth, nextWidth))}px`
})

const loadPreview = async (path: string) => {
  previewLoading.value = true
  previewErrorMessage.value = ''

  try {
    preview.value = normalizePreviewType(await props.loadPreview(path))
  } catch (error) {
    preview.value = null
    previewErrorMessage.value = toErrorMessage(error, props.previewLoadErrorText)
  } finally {
    previewLoading.value = false
  }
}

const autoExpandSingleDirChain = async (initialNodes: FileTreeNode[], expanded: Set<string>) => {
  let nextNodes = initialNodes
  let currentNodes = initialNodes

  while (currentNodes.length === 1 && currentNodes[0]?.isDir) {
    const onlyDir = currentNodes[0]
    expanded.add(onlyDir.path)

    const childResponse = await props.loadTree(onlyDir.path)
    nextNodes = updateFileTreeChildren(nextNodes, onlyDir.path, childResponse.entries)

    const refreshedNode = findFileTreeNode(nextNodes, onlyDir.path)
    currentNodes = refreshedNode?.children ?? []
  }

  return nextNodes
}

const performLoadWorkspaceRoot = async (options?: { preserveExpanded?: boolean }) => {
  treeLoading.value = true
  treeErrorMessage.value = ''

  try {
    const response = await props.loadTree(props.rootPath)

    let nextNodes = createFileTreeNodes(response.entries)
    const expandedSnapshot = [...expandedPaths.value]
    const nextExpandedPaths = options?.preserveExpanded
      ? new Set(expandedSnapshot)
      : new Set<string>()

    nextNodes = await autoExpandSingleDirChain(nextNodes, nextExpandedPaths)

    if (options?.preserveExpanded && expandedSnapshot.length > 0) {
      for (const path of expandedSnapshot) {
        try {
          const childResponse = await props.loadTree(path)
          nextNodes = updateFileTreeChildren(nextNodes, path, childResponse.entries)
        } catch (error) {
          treeErrorMessage.value = toErrorMessage(error, `刷新目录 ${path} 失败`)
        }
      }
    }

    treeNodes.value = nextNodes
    expandedPaths.value = nextExpandedPaths
  } catch (error) {
    treeNodes.value = []
    treeErrorMessage.value = toErrorMessage(error, props.treeLoadErrorText)
  } finally {
    treeLoading.value = false
  }
}

const runRefreshTree = async (options?: { preserveExpanded?: boolean }) => {
  await performLoadWorkspaceRoot(options)

  if (selectedPath.value) {
    await loadPreview(selectedPath.value)
  }
}

const refreshTree = async (options?: { preserveExpanded?: boolean }) => {
  if (refreshInFlight.value) {
    pendingRefresh.value = true
    pendingRefreshPreserveExpanded.value =
      pendingRefreshPreserveExpanded.value || Boolean(options?.preserveExpanded)
    return
  }

  refreshInFlight.value = true

  try {
    let nextOptions = options

    do {
      pendingRefresh.value = false
      pendingRefreshPreserveExpanded.value = false
      await runRefreshTree(nextOptions)

      if (!pendingRefresh.value) {
        break
      }

      nextOptions = {
        preserveExpanded: pendingRefreshPreserveExpanded.value,
      }
    } while (pendingRefresh.value)
  } finally {
    refreshInFlight.value = false
  }
}

const handleToggleDir = async (node: FileTreeNode) => {
  if (!node.isDir) {
    return
  }

  if (expandedPaths.value.has(node.path)) {
    removeExpandedPath(node.path)
    return
  }

  addExpandedPath(node.path)

  if (node.childrenLoaded) {
    return
  }

  updateLoadingPath(node.path, true)

  try {
    const response = await props.loadTree(node.path)
    treeNodes.value = updateFileTreeChildren(treeNodes.value, node.path, response.entries)
  } catch (error) {
    treeErrorMessage.value = toErrorMessage(error, props.dirLoadErrorText)
  } finally {
    updateLoadingPath(node.path, false)
  }
}

const handleSelectFile = async (node: FileTreeNode) => {
  if (node.isDir) {
    return
  }

  selectedPath.value = node.path
  await loadPreview(node.path)
}

watch(
  [() => props.sourceKey, () => props.rootPath],
  async () => {
    resetState()
    await refreshTree()
  },
  {
    immediate: true,
  },
)

watch(
  () => props.refreshToken,
  async () => {
    await refreshTree({ preserveExpanded: true })
  },
)
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
    <header
      v-if="!props.hideHeader"
      class="border-border/70 flex items-center justify-between gap-2 border-b px-3 py-2"
    >
      <div v-if="!props.hideHeaderTitle" class="min-w-0 flex-1">
        <p class="truncate text-xs text-foreground">{{ props.headerTitle || '-' }}</p>
      </div>

      <div v-if="!props.hideRefreshButton" class="flex shrink-0 items-center gap-1">
        <button
          class="h-6 rounded-md border border-border/60 bg-background px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          type="button"
          @click="refreshTree({ preserveExpanded: true })"
        >
          刷新
        </button>
      </div>
    </header>

    <div class="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <aside
        :style="treePanelWidth ? { width: treePanelWidth } : undefined"
        class="border-border/70 flex min-h-0 shrink-0 flex-col border-r bg-muted/10"
        :class="treePanelWidth ? undefined : 'w-80'"
      >
        <div class="min-h-0 flex-1 overflow-auto px-1.5 py-2">
          <div class="space-y-2 text-xs">
            <p v-if="treeErrorMessage" class="px-2 text-destructive">{{ treeErrorMessage }}</p>
            <p v-else-if="!treeLoading && treeNodes.length === 0" class="px-2 text-muted-foreground">
              {{ props.emptyText }}
            </p>

            <FileTree
              v-else-if="treeNodes.length > 0"
              :nodes="treeNodes"
              :selected-path="selectedPath"
              :expanded-paths="expandedPaths"
              :loading-paths="loadingPaths"
              @toggle-dir="handleToggleDir"
              @select-file="handleSelectFile"
            />
          </div>
        </div>
      </aside>

      <FilePreviewCard
        :selected-path="selectedPath"
        :preview="preview"
        :loading="previewLoading"
        :error-message="previewErrorMessage"
      >
        <template v-if="$slots.actions" #actions>
          <slot name="actions" />
        </template>
        <template v-if="$slots.footer" #footer>
          <slot name="footer" />
        </template>
      </FilePreviewCard>
    </div>
  </div>
</template>
