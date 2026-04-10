import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createFileTreeNodes,
  updateFileTreeChildren,
  type FileTreeNode,
} from '@shared/components/file-browser/file-tree'
import type { FileBrowserPreview } from '@shared/components/file-browser/types'
import { projectsApi } from '@/api/projects'
import { openSseStream } from '@/api/http'
import { useMessage } from '@app/composables/useMessage'
import type { Project } from '@/types/api/projects'
import type { ProjectDocCitation } from '@/types/api/project-docs'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { HttpError } from '@api/shared/error'
import { toErrorMessage } from '@api/shared/to-error-message'
import { createOrUpdateProjectDoc } from '@shared/utils/project-doc-upload'
import {
  KNOWLEDGE_BASE_STREAM_CHARS_PER_TICK as STREAM_CHARS_PER_TICK,
  KNOWLEDGE_BASE_STREAM_TICK_MS as STREAM_TICK_MS,
} from './knowledge-base-page.constants'

export type KnowledgeBasePageContext = ReturnType<typeof useKnowledgeBasePage>

export function useKnowledgeBasePage() {
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
        await createOrUpdateProjectDoc(projectId, nextPath, file)
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
  return reactive({
    activeAssistantMessage,
    resolveStoredProjectId,
    queryAbortController,
    ensureStreamRenderer,
    submitKnowledgeQuery,
    normalizeRouteParam,
    normalizeUploadPath,
    onDropAreaDragLeave,
    stopStreamRenderer,
    canQueryCurrentDoc,
    onDropAreaDragOver,
    flushStreamBuffer,
    onFileInputChange,
    streamTextBuffer,
    openEditSelected,
    handleSelectFile,
    activeProjectId,
    loadSelectedDoc,
    autoSelectFirst,
    openCreateModal,
    handleToggleDir,
    loadProjectData,
    removeDocByPath,
    previewLoading,
    removeSelected,
    jumpToCitation,
    onDropAreaDrop,
    expandedPaths,
    queryQuestion,
    queryMessages,
    findFirstFile,
    openEditModal,
    onChooseFiles,
    selectedPath,
    previewError,
    loadingPaths,
    queryLoading,
    fileInputRef,
    deletingPath,
    hasProjectId,
    loadDocsRoot,
    docsLoading,
    editingPath,
    modalSaving,
    formContent,
    withTimeout,
    uploadFiles,
    dragActive,
    queryError,
    queryScope,
    closeModal,
    uploading,
    treeNodes,
    modalOpen,
    formError,
    isEditing,
    selectDoc,
    submitDoc,
    formPath,
    message,
    loading,
    project,
    preview,
    router,
    route,
  })
}
