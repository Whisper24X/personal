<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import FileTree from '@/components/core/file-browser/FileTree.vue'
import FilePreviewCard from '@/components/core/file-browser/FilePreviewCard.vue'
import {
  createFileTreeNodes,
  updateFileTreeChildren,
  type FileTreeNode,
} from '@/components/core/file-browser/file-tree'
import type { FileBrowserPreview } from '@/components/core/file-browser/types'
import MarkdownPreview from '@/components/knowledge-base/MarkdownPreview.vue'
import { projectsApi } from '@/api/projects'
import { openSseStream } from '@/api/http'
import { useMessage } from '@/hooks'
import type { Project } from '@/types/api/projects'
import type { ProjectDocCitation } from '@/types/api/project-docs'
import { STORAGE_KEYS } from '@/types/common/storage'
import { HttpError } from '@/utils/http/error'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'KnowledgeBaseView',
})

const route = useRoute()
const router = useRouter()
const message = useMessage()

const loading = ref(false)
const docsLoading = ref(false)
const uploading = ref(false)
const dragActive = ref(false)

const project = ref<Project | null>(null)
const treeNodes = ref<FileTreeNode[]>([])
const selectedPath = ref('')
const preview = ref<FileBrowserPreview | null>(null)
const previewLoading = ref(false)
const previewError = ref('')

const expandedPaths = ref<Set<string>>(new Set())
const loadingPaths = ref<Set<string>>(new Set())

const queryLoading = ref(false)
const queryQuestion = ref('')
const queryError = ref('')
const queryScope = ref<'project' | 'current_doc'>('project')

type QueryMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: ProjectDocCitation[]
  isStreaming?: boolean
}

const queryMessages = ref<QueryMessage[]>([])
const queryAbortController = ref<AbortController | null>(null)
const streamTextBuffer = ref('')
const activeAssistantMessage = ref<QueryMessage | null>(null)
let streamRenderTimer: ReturnType<typeof setInterval> | null = null

const STREAM_CHARS_PER_TICK = 3
const STREAM_TICK_MS = 45

const stopStreamRenderer = () => {
  if (streamRenderTimer) {
    clearInterval(streamRenderTimer)
    streamRenderTimer = null
  }
}

const flushStreamBuffer = () => {
  if (activeAssistantMessage.value && streamTextBuffer.value) {
    activeAssistantMessage.value.content += streamTextBuffer.value
  }
  streamTextBuffer.value = ''
}

const ensureStreamRenderer = () => {
  if (streamRenderTimer) return
  streamRenderTimer = setInterval(() => {
    if (!activeAssistantMessage.value || !streamTextBuffer.value) {
      return
    }

    const nextDelta = streamTextBuffer.value.slice(0, STREAM_CHARS_PER_TICK)
    streamTextBuffer.value = streamTextBuffer.value.slice(STREAM_CHARS_PER_TICK)
    activeAssistantMessage.value.content += nextDelta
  }, STREAM_TICK_MS)
}

const fileInputRef = ref<HTMLInputElement | null>(null)

const modalOpen = ref(false)
const editingPath = ref('')
const modalSaving = ref(false)
const deletingPath = ref('')
const formPath = ref('')
const formContent = ref('')
const formError = ref('')

const normalizeRouteParam = (value: unknown) => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return ''
}

const resolveStoredProjectId = () => {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? ''
}

const activeProjectId = computed(() => {
  return normalizeRouteParam(route.query.projectId) || resolveStoredProjectId()
})

const hasProjectId = computed(() => Boolean(activeProjectId.value))
const isEditing = computed(() => Boolean(editingPath.value))

const canQueryCurrentDoc = computed(() => Boolean(selectedPath.value))

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, msg: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(msg))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

const loadSelectedDoc = async () => {
  const projectId = activeProjectId.value
  const filePath = selectedPath.value
  if (!projectId || !filePath) {
    preview.value = null
    previewError.value = ''
    return
  }

  previewLoading.value = true
  previewError.value = ''
  try {
    const raw = await withTimeout(
      projectsApi.docsPreview(projectId, filePath),
      20_000,
      '读取文档超时，请稍后重试',
    )
    const withMediaUrl = { ...raw }
    if (['pdf', 'video', 'audio'].includes(raw.previewType) && !raw.tooLarge) {
      withMediaUrl.dataUrl = projectsApi.getDocsFileRawUrl(projectId, filePath)
    }
    // 后端可能将 .md 标成 text/plain；按扩展名兜底为 Markdown 渲染
    const isMarkdown =
      raw.previewType === 'text' &&
      (raw.mimeType === 'text/markdown' ||
        /\.(md|mdx|markdown)$/i.test(filePath))
    preview.value = {
      ...withMediaUrl,
      previewType: isMarkdown ? 'markdown' : raw.previewType,
    }
  } catch (error) {
    preview.value = null
    previewError.value = toErrorMessage(error, '读取知识库文件失败')
  } finally {
    previewLoading.value = false
  }
}

const findFirstFile = (nodes: FileTreeNode[]): FileTreeNode | null => {
  for (const node of nodes) {
    if (!node.isDir) return node
    if (node.children?.length) {
      const found = findFirstFile(node.children)
      if (found) return found
    }
  }
  return null
}

const autoSelectFirst = () => {
  const firstFile = findFirstFile(treeNodes.value)
  if (firstFile) {
    selectedPath.value = firstFile.path
    void loadSelectedDoc()
  }
}

const openCreateModal = () => {
  editingPath.value = ''
  formPath.value = ''
  formContent.value = ''
  formError.value = ''
  modalOpen.value = true
}

const openEditModal = async (docPath: string) => {
  if (!activeProjectId.value) return
  editingPath.value = docPath
  formPath.value = docPath
  formContent.value = ''
  formError.value = ''
  modalOpen.value = true
  modalSaving.value = true

  try {
    const detail = await withTimeout(
      projectsApi.readDoc(activeProjectId.value, docPath),
      20_000,
      '读取文档超时，请稍后重试',
    )
    formContent.value = detail.content
  } catch (error) {
    formError.value = toErrorMessage(error, '读取知识库文件失败')
  } finally {
    modalSaving.value = false
  }
}

const openEditSelected = async () => {
  if (!selectedPath.value) return
  await openEditModal(selectedPath.value)
}

const closeModal = () => {
  modalOpen.value = false
  editingPath.value = ''
  formPath.value = ''
  formContent.value = ''
  formError.value = ''
}

const selectDoc = (path: string) => {
  if (selectedPath.value === path) return
  selectedPath.value = path
  void loadSelectedDoc()
}

const handleToggleDir = async (node: FileTreeNode) => {
  if (expandedPaths.value.has(node.path)) {
    const next = new Set(expandedPaths.value)
    next.delete(node.path)
    expandedPaths.value = next
    return
  }

  const next = new Set(expandedPaths.value)
  next.add(node.path)
  expandedPaths.value = next

  if (node.childrenLoaded) return

  const projectId = activeProjectId.value
  if (!projectId) return

  const lp = new Set(loadingPaths.value)
  lp.add(node.path)
  loadingPaths.value = lp

  try {
    const response = await projectsApi.docsTree(projectId, { path: node.path })
    treeNodes.value = updateFileTreeChildren(treeNodes.value, node.path, response.entries)
  } catch (error) {
    message.error(toErrorMessage(error, '加载目录失败'))
  } finally {
    const lpDone = new Set(loadingPaths.value)
    lpDone.delete(node.path)
    loadingPaths.value = lpDone
  }
}

const handleSelectFile = (node: FileTreeNode) => {
  selectDoc(node.path)
}

const loadDocsRoot = async () => {
  const projectId = activeProjectId.value
  if (!projectId) {
    treeNodes.value = []
    selectedPath.value = ''
    preview.value = null
    previewError.value = ''
    return
  }

  docsLoading.value = true
  try {
    const response = await withTimeout(
      projectsApi.docsTree(projectId),
      25_000,
      '加载文档列表超时，请稍后重试',
    )

    const docsRoot: FileTreeNode = {
      name: 'docs',
      path: '.',
      isDir: true,
      children: createFileTreeNodes(response.entries),
      childrenLoaded: true,
    }

    let nextNodes: FileTreeNode[] = [docsRoot]

    const expandedSnapshot = [...expandedPaths.value].filter((p) => p !== '.')
    for (const expandedPath of expandedSnapshot) {
      try {
        const childResponse = await projectsApi.docsTree(projectId, { path: expandedPath })
        nextNodes = updateFileTreeChildren(nextNodes, expandedPath, childResponse.entries)
      } catch {
        // skip stale expanded dirs
      }
    }

    treeNodes.value = nextNodes
    expandedPaths.value = new Set(['.', ...expandedSnapshot])
    autoSelectFirst()
  } catch (error) {
    message.error(toErrorMessage(error, '加载知识库失败'))
  } finally {
    docsLoading.value = false
  }
}

const loadProjectData = async () => {
  const projectId = activeProjectId.value
  if (!projectId) {
    project.value = null
    treeNodes.value = []
    selectedPath.value = ''
    preview.value = null
    previewError.value = ''
    queryMessages.value = []
    queryError.value = ''
    return
  }

  loading.value = true
  try {
    project.value = await withTimeout(
      projectsApi.detail(projectId),
      20_000,
      '加载项目信息超时，请稍后重试',
    )
    void loadDocsRoot()
  } catch (error) {
    project.value = null
    treeNodes.value = []
    selectedPath.value = ''
    preview.value = null
    previewError.value = ''
    queryMessages.value = []
    queryError.value = ''
    message.error(toErrorMessage(error, '加载项目知识库失败'))

    if (error instanceof HttpError && (error.status === 404 || error.status === 403)) {
      localStorage.removeItem(STORAGE_KEYS.lastSelectedProjectId)
      if (route.query.projectId) {
        void router.replace({ path: route.path, query: {} })
      }
    }
  } finally {
    loading.value = false
  }
}

const submitDoc = async () => {
  if (!activeProjectId.value) return

  const path = formPath.value.trim()
  if (!path) {
    formError.value = '文件路径不能为空'
    return
  }

  modalSaving.value = true
  formError.value = ''
  try {
    if (isEditing.value) {
      await projectsApi.updateDoc(activeProjectId.value, {
        path,
        content: formContent.value,
      })
      message.success('更新知识库文件成功')
      selectedPath.value = path
    } else {
      await projectsApi.createDoc(activeProjectId.value, {
        path,
        content: formContent.value,
      })
      message.success('创建知识库文件成功')
      selectedPath.value = path
    }

    closeModal()
    await loadDocsRoot()
    if (selectedPath.value === path) {
      void loadSelectedDoc()
    }
  } catch (error) {
    formError.value = toErrorMessage(error, '保存知识库文件失败')
  } finally {
    modalSaving.value = false
  }
}

const removeDocByPath = async (path: string) => {
  if (!activeProjectId.value) return
  if (!window.confirm(`确认删除知识库文件「${path}」吗？`)) return

  deletingPath.value = path
  try {
    await projectsApi.removeDoc(activeProjectId.value, path)
    message.success('删除知识库文件成功')
    if (selectedPath.value === path) {
      selectedPath.value = ''
      preview.value = null
      previewError.value = ''
    }
    await loadDocsRoot()
  } catch (error) {
    message.error(toErrorMessage(error, '删除知识库文件失败'))
  } finally {
    deletingPath.value = ''
  }
}

const removeSelected = async () => {
  if (!selectedPath.value) return
  await removeDocByPath(selectedPath.value)
}

const submitKnowledgeQuery = async () => {
  const projectId = activeProjectId.value
  const question = queryQuestion.value.trim()
  if (!projectId || !question) return

  queryAbortController.value?.abort()
  queryAbortController.value = new AbortController()
  queryLoading.value = true
  queryError.value = ''
  queryQuestion.value = ''

  const userMessage: QueryMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: question,
  }
  const assistantMessage: QueryMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: '',
    citations: [],
    isStreaming: true,
  }
  queryMessages.value.push(userMessage, assistantMessage)
  activeAssistantMessage.value = assistantMessage
  streamTextBuffer.value = ''
  ensureStreamRenderer()

  const scope = queryScope.value === 'current_doc' && selectedPath.value ? 'current_doc' : 'project'

  try {
    await openSseStream(
      `/projects/${projectId}/docs/query/stream`,
      {
        question,
        scope,
        currentPath: scope === 'current_doc' ? selectedPath.value : undefined,
        maxContextDocs: 6,
      },
      {
        signal: queryAbortController.value.signal,
        onEvent: (event) => {
          if (event.event === 'chunk') {
            try {
              const payload = JSON.parse(event.data) as { delta?: string }
              if (payload.delta) {
                streamTextBuffer.value += payload.delta
              }
            } catch {
              // ignore invalid chunk payload
            }
            return
          }

          if (event.event === 'citations') {
            try {
              const payload = JSON.parse(event.data) as { citations?: ProjectDocCitation[] }
              assistantMessage.citations = payload.citations ?? []
            } catch {
              assistantMessage.citations = []
            }
            return
          }

          if (event.event === 'error') {
            try {
              const payload = JSON.parse(event.data) as { message?: string }
              queryError.value = payload.message || '知识问答失败'
            } catch {
              queryError.value = '知识问答失败'
            }
            assistantMessage.isStreaming = false
            flushStreamBuffer()
            return
          }

          if (event.event === 'done') {
            flushStreamBuffer()
            assistantMessage.isStreaming = false
            queryLoading.value = false
          }
        },
        onError: (error) => {
          flushStreamBuffer()
          assistantMessage.isStreaming = false
          queryLoading.value = false
          queryError.value = toErrorMessage(error, '知识问答失败')
        },
      },
    )
  } catch (error) {
    flushStreamBuffer()
    assistantMessage.isStreaming = false
    queryLoading.value = false
    queryError.value = toErrorMessage(error, '知识问答失败')
    if (!assistantMessage.content.trim()) {
      assistantMessage.content = '本次问答请求失败，请稍后重试。'
    }
  } finally {
    flushStreamBuffer()
    assistantMessage.isStreaming = false
    queryLoading.value = false
    queryAbortController.value = null
    activeAssistantMessage.value = null
    stopStreamRenderer()
  }
}

const jumpToCitation = (docPath: string) => {
  if (!docPath) return
  if (selectedPath.value !== docPath) {
    selectDoc(docPath)
  }
}

onBeforeUnmount(() => {
  queryAbortController.value?.abort()
  stopStreamRenderer()
})

const normalizeUploadPath = (file: File) => {
  const withRelative = file as File & { webkitRelativePath?: string }
  const rawPath = withRelative.webkitRelativePath?.trim() || file.name
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized) return ''
  if (normalized.startsWith('docs/')) return normalized.slice('docs/'.length)
  return normalized
}

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'yml',
  'yaml',
  'xml',
  'csv',
  'ts',
  'tsx',
  'js',
  'jsx',
  'vue',
  'css',
  'scss',
  'sass',
  'less',
  'html',
  'htm',
  'sql',
  'sh',
  'bash',
  'zsh',
  'py',
  'java',
  'go',
  'rs',
  'c',
  'cc',
  'cpp',
  'h',
  'hpp',
])

const isBinaryFile = (file: File) => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mimeType = (file.type || '').toLowerCase()
  if (!mimeType) {
    return !TEXT_EXTENSIONS.has(ext)
  }

  if (mimeType.startsWith('text/')) {
    return false
  }
  if (
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/x-yaml'
  ) {
    return false
  }

  return true
}

const uploadFiles = async (fileLikeList: FileList | File[]) => {
  const projectId = activeProjectId.value
  if (!projectId) return

  const files = Array.from(fileLikeList)
  if (!files.length) return

  let successCount = 0
  let failCount = 0

  uploading.value = true
  try {
    for (const file of files) {
      const nextPath = normalizeUploadPath(file)
      if (!nextPath) {
        failCount += 1
        continue
      }

      try {
        let payload: { path: string; content?: string; contentBase64?: string }
        if (isBinaryFile(file)) {
          const buf = await file.arrayBuffer()
          const bytes = new Uint8Array(buf)
          let binary = ''
          const chunkSize = 8192
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
          }
          payload = { path: nextPath, contentBase64: btoa(binary) }
        } else {
          const content = await file.text()
          payload = { path: nextPath, content }
        }
        try {
          await projectsApi.createDoc(projectId, payload)
        } catch {
          await projectsApi.updateDoc(projectId, payload)
        }
        successCount += 1
      } catch {
        failCount += 1
      }
    }

    await loadDocsRoot()
    if (successCount > 0 && failCount === 0) {
      message.success(`上传成功，共 ${successCount} 个文件`)
    } else if (successCount > 0) {
      message.warning(`上传完成：成功 ${successCount} 个，失败 ${failCount} 个`)
    } else {
      message.error('上传失败，请检查文件格式或内容')
    }
  } finally {
    uploading.value = false
  }
}

const onChooseFiles = () => {
  fileInputRef.value?.click()
}

const onFileInputChange = (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const files = input?.files
  if (!files || files.length === 0) return
  void uploadFiles(files)
  input.value = ''
}

const onDropAreaDragOver = (event: DragEvent) => {
  event.preventDefault()
  dragActive.value = true
}

const onDropAreaDragLeave = () => {
  dragActive.value = false
}

const onDropAreaDrop = (event: DragEvent) => {
  event.preventDefault()
  dragActive.value = false
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return
  void uploadFiles(files)
}

watch(
  activeProjectId,
  () => {
    void loadProjectData()
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-full space-y-4 px-4 py-4 md:px-6 md:py-5 xl:px-8 fade-up">
    <section v-if="!hasProjectId" class="flex-shrink-0 panel-card p-5">
      <p class="text-sm font-semibold">未选择项目</p>
      <p class="mt-2 text-sm text-muted-foreground">请先在左侧选择项目，再进入知识库页面进行配置。</p>
    </section>

    <template v-else>
      <section v-if="loading" class="flex-shrink-0 panel-card p-5">
        <p class="text-sm text-muted-foreground">加载中...</p>
      </section>

      <template v-else-if="project">
        <section class="grid grid-cols-1 gap-4 xl:items-start xl:grid-cols-[22rem_1fr]">
          <article class="panel-card flex min-h-[780px] flex-col overflow-auto p-4">
            <div class="flex-shrink-0 space-y-1">
              <p class="text-sm font-semibold">{{ project.name }}</p>
              <p class="text-xs text-muted-foreground">
                <span class="font-mono">{{ project.id }}</span>
                <span class="mx-2">•</span>
                <RouterLink
                  :to="{ path: '/dashboard', query: { projectId: project.id } }"
                  class="hover:text-foreground hover:underline"
                >
                  项目工作台
                </RouterLink>
              </p>
            </div>

            <div class="mt-3 flex-shrink-0 grid grid-cols-2 gap-2">
              <button
                class="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-md"
                type="button"
                @click="openCreateModal"
              >
                新建文档
              </button>
              <button
                class="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="docsLoading"
                type="button"
                @click="loadDocsRoot"
              >
                {{ docsLoading ? '刷新中' : '刷新列表' }}
              </button>
            </div>

            <div
              class="mt-3 flex-shrink-0 rounded-xl border border-dashed p-3 transition"
              :class="dragActive ? 'border-primary bg-primary/5' : 'border-border bg-background/40'"
              @dragover="onDropAreaDragOver"
              @dragleave="onDropAreaDragLeave"
              @drop="onDropAreaDrop"
            >
              <p class="text-xs text-muted-foreground">拖拽文件到这里上传到 docs，或使用按钮选择文件。</p>
              <button
                class="mt-2 h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="uploading"
                type="button"
                @click="onChooseFiles"
              >
                {{ uploading ? '上传中...' : '选择文件上传' }}
              </button>
              <input
                ref="fileInputRef"
                class="hidden"
                type="file"
                multiple
                @change="onFileInputChange"
              />
            </div>

            <div class="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background/50 p-2">
              <div class="min-h-0 flex-1 overflow-auto pr-1 text-xs">
                <div v-if="treeNodes.length === 0 && !docsLoading" class="px-2 py-6 text-muted-foreground">
                  暂无文档
                </div>
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
          </article>

          <article class="panel-card flex flex-col flex-1 p-4 min-h-[780px]">
            <FilePreviewCard
              class="flex flex-col flex-1 min-h-0"
              :selected-path="selectedPath"
              :preview="preview"
              :loading="previewLoading"
              :error-message="previewError"
              preview-max-height-class="max-h-[62vh] min-h-[400px]"
              empty-message="从左侧文件树选择一个文档以预览内容。"
            >
              <template #actions>
                <button
                  class="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-md"
                  type="button"
                  @click="openEditSelected"
                >
                  编辑
                </button>
                <button
                  class="h-9 rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="deletingPath === selectedPath"
                  type="button"
                  @click="removeSelected"
                >
                  {{ deletingPath === selectedPath ? '删除中...' : '删除' }}
                </button>
              </template>

              <template #footer>
                <section class="flex min-h-[280px] max-h-[40vh] flex-col overflow-hidden rounded-lg border border-border bg-background p-3">
                  <div class="flex items-center justify-between border-b border-border pb-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">知识问答</p>
                    <div class="flex items-center gap-3 text-xs">
                      <label class="inline-flex items-center gap-1 text-muted-foreground">
                        <input
                          v-model="queryScope"
                          type="radio"
                          class="accent-primary"
                          value="project"
                        >
                        全项目
                      </label>
                      <label class="inline-flex items-center gap-1 text-muted-foreground">
                        <input
                          v-model="queryScope"
                          type="radio"
                          class="accent-primary"
                          value="current_doc"
                          :disabled="!canQueryCurrentDoc"
                        >
                        当前文件
                      </label>
                    </div>
                  </div>

                  <div class="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-muted/25 p-2 pr-1">
                    <p v-if="queryMessages.length === 0 && !queryError" class="text-sm text-muted-foreground">
                      输入问题后点击提问，答案会基于 docs 内容生成并附带引用来源。
                    </p>
                    <p v-if="queryError" class="mb-2 text-sm text-destructive">{{ queryError }}</p>

                    <div v-if="queryMessages.length > 0" class="space-y-3">
                      <div
                        v-for="msg in queryMessages"
                        :key="msg.id"
                        class="flex"
                        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
                      >
                        <div
                          class="max-w-[92%] rounded-xl px-3 py-2"
                          :class="msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-foreground'"
                        >
                          <p class="mb-1 text-[11px] font-semibold opacity-75">
                            {{ msg.role === 'user' ? '你' : 'AI' }}
                          </p>
                          <p v-if="msg.role === 'user'" class="whitespace-pre-wrap text-sm">{{ msg.content }}</p>
                          <MarkdownPreview v-else :content="msg.content || (msg.isStreaming ? '正在思考中...' : '')" />

                          <div
                            v-if="msg.role === 'assistant' && msg.citations && msg.citations.length > 0"
                            class="mt-2 rounded-md border border-border/70 bg-background/60 p-2"
                          >
                            <p class="text-xs font-semibold text-muted-foreground">引用来源</p>
                            <div class="mt-2 space-y-2">
                              <button
                                v-for="citation in msg.citations"
                                :key="`${msg.id}-${citation.path}-${citation.snippet}`"
                                type="button"
                                class="w-full rounded-md border border-border/70 bg-background px-2 py-1 text-left transition hover:border-primary/40 hover:bg-primary/5"
                                @click="jumpToCitation(citation.path)"
                              >
                                <p class="font-mono text-[11px] text-foreground">{{ citation.path }}</p>
                                <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ citation.snippet }}</p>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <form class="mt-2 flex items-end gap-2 rounded-lg border border-border bg-card p-2" @submit.prevent="submitKnowledgeQuery">
                    <textarea
                      v-model="queryQuestion"
                      class="min-h-[56px] flex-1 resize-y rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground shadow-xs outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                      placeholder="例如：这个项目的部署流程是什么？"
                    />
                    <button
                      class="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="queryLoading || !queryQuestion.trim()"
                      type="submit"
                    >
                      {{ queryLoading ? '提问中...' : '提问' }}
                    </button>
                  </form>
                </section>
              </template>
            </FilePreviewCard>
          </article>
        </section>
      </template>
    </template>

    <Teleport to="body">
      <div
        v-if="modalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-doc-form-modal-title"
        @click.self="closeModal"
      >
        <section class="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="project-doc-form-modal-title" class="text-sm font-semibold">
              {{ isEditing ? '编辑知识库文件' : '新增知识库文件' }}
            </h2>
            <button
              class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              type="button"
              aria-label="关闭知识库弹窗"
              @click="closeModal"
            >
              关闭
            </button>
          </header>

          <form class="grid max-h-[calc(92vh-56px)] gap-3 overflow-auto px-4 py-4" @submit.prevent="submitDoc">
            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">文件路径（相对 docs）</span>
              <input
                v-model="formPath"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如：architecture/overview.md"
                type="text"
                :disabled="isEditing"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">文档内容</span>
              <textarea
                v-model="formContent"
                class="min-h-[360px] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
                placeholder="请输入知识库内容（支持 Markdown）"
              />
            </label>

            <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>

            <div class="flex justify-end gap-2">
              <button
                class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
                type="button"
                @click="closeModal"
              >
                取消
              </button>
              <button
                class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="modalSaving"
                type="submit"
              >
                {{ modalSaving ? '保存中...' : isEditing ? '保存修改' : '创建文档' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
