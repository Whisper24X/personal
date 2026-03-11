<script setup lang="ts">
import { ref, watch } from 'vue'
import { toErrorMessage } from '@/utils/http/to-error-message'
import FileTree from './FileTree.vue'
import FilePreviewCard from './FilePreviewCard.vue'
import {
  createFileTreeNodes,
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
    rootPath?: string
    refreshToken?: number
    emptyText?: string
    treeLoadErrorText?: string
    dirLoadErrorText?: string
    previewLoadErrorText?: string
  }>(),
  {
    headerTitle: null,
    rootPath: '.',
    refreshToken: 0,
    emptyText: '当前工作区为空',
    treeLoadErrorText: '加载文件树失败',
    dirLoadErrorText: '加载目录失败',
    previewLoadErrorText: '加载文件预览失败',
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

const loadWorkspaceRoot = async (options?: { preserveExpanded?: boolean }) => {
  if (refreshInFlight.value) {
    return
  }

  refreshInFlight.value = true
  treeLoading.value = true
  treeErrorMessage.value = ''

  try {
    const response = await props.loadTree(props.rootPath)

    let nextNodes = createFileTreeNodes(response.entries)
    const expandedSnapshot = [...expandedPaths.value]

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
  } catch (error) {
    treeNodes.value = []
    treeErrorMessage.value = toErrorMessage(error, props.treeLoadErrorText)
  } finally {
    treeLoading.value = false
    refreshInFlight.value = false
  }
}

const refreshTree = async () => {
  await loadWorkspaceRoot({ preserveExpanded: true })

  if (selectedPath.value) {
    await loadPreview(selectedPath.value)
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
    await loadWorkspaceRoot()
  },
  {
    immediate: true,
  },
)

watch(
  () => props.refreshToken,
  async () => {
    await refreshTree()
  },
)
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 overflow-hidden">
    <aside class="border-border/70 flex min-h-0 w-80 shrink-0 flex-col border-r bg-muted/10">
      <header class="border-border/70 flex h-12 items-center justify-between border-b bg-background/80 px-3 text-xs backdrop-blur">
        <div class="min-w-0">
          <p class="truncate text-foreground">{{ props.headerTitle || '-' }}</p>
        </div>

        <button
          class="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          type="button"
          @click="refreshTree"
        >
          刷新
        </button>
      </header>

      <div class="min-h-0 flex-1 overflow-auto px-1.5 py-2">
        <div class="space-y-2 text-xs">
          <p v-if="treeErrorMessage" class="px-2 text-destructive">{{ treeErrorMessage }}</p>
          <p v-else-if="!treeLoading && treeNodes.length === 0" class="px-2 text-muted-foreground">{{ props.emptyText }}</p>

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
</template>
