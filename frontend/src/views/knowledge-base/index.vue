<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import MarkdownPreview from '@/components/knowledge-base/MarkdownPreview.vue'
import { projectsApi } from '@/api/projects'
import { openSseStream } from '@/api/http'
import { useMessage } from '@/hooks'
import type { Project } from '@/types/api/projects'
import type { ProjectDocCitation, ProjectDocItem } from '@/types/api/project-docs'
import { STORAGE_KEYS } from '@/types/common/storage'
import { HttpError } from '@/utils/http/error'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'KnowledgeBaseView',
})

type TreeItem = {
  key: string
  name: string
  path: string
  depth: number
  isDir: boolean
  treePrefix: string
  doc?: ProjectDocItem
}

type FolderNode = {
  name: string
  path: string
  dirs: Map<string, FolderNode>
  files: ProjectDocItem[]
}

const route = useRoute()
const router = useRouter()
const message = useMessage()

const loading = ref(false)
const docsLoading = ref(false)
const previewLoading = ref(false)
const uploading = ref(false)
const dragActive = ref(false)

const project = ref<Project | null>(null)
const docs = ref<ProjectDocItem[]>([])
const selectedPath = ref('')
const selectedContent = ref('')
const previewError = ref('')
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

const sortedDocs = computed(() => {
  return [...docs.value].sort((left, right) => left.path.localeCompare(right.path))
})

const selectedDoc = computed(() => {
  return docs.value.find((doc) => doc.path === selectedPath.value) ?? null
})

const canQueryCurrentDoc = computed(() => Boolean(selectedPath.value))

const treeItems = computed<TreeItem[]>(() => {
  const root: FolderNode = {
    name: 'docs',
    path: '',
    dirs: new Map(),
    files: [],
  }

  for (const doc of sortedDocs.value) {
    const segments = doc.path.split('/').filter(Boolean)
    let current = root

    for (let index = 0; index < Math.max(segments.length - 1, 0); index += 1) {
      const segment = segments[index]!
      const nextPath = current.path ? `${current.path}/${segment}` : segment
      const existed = current.dirs.get(segment)
      if (existed) {
        current = existed
        continue
      }

      const created: FolderNode = {
        name: segment,
        path: nextPath,
        dirs: new Map(),
        files: [],
      }
      current.dirs.set(segment, created)
      current = created
    }

    current.files.push(doc)
  }

  const result: TreeItem[] = []
  const walk = (node: FolderNode, depth: number, prefix: string) => {
    const dirNodes = [...node.dirs.values()].sort((left, right) => left.name.localeCompare(right.name))
    const fileNodes = [...node.files].sort((left, right) => left.path.localeCompare(right.path))
    const totalDirs = dirNodes.length
    const totalFiles = fileNodes.length

    dirNodes.forEach((dirNode, i) => {
      const isLastDir = i === totalDirs - 1 && totalFiles === 0
      const connector = isLastDir ? '└── ' : '├── '
      result.push({
        key: `dir:${dirNode.path}`,
        name: `${dirNode.name}/`,
        path: dirNode.path,
        depth,
        isDir: true,
        treePrefix: prefix + connector,
      })
      const childPrefix = prefix + (isLastDir ? '    ' : '│   ')
      walk(dirNode, depth + 1, childPrefix)
    })

    fileNodes.forEach((fileNode, i) => {
      const isLast = i === totalFiles - 1
      const connector = isLast ? '└── ' : '├── '
      result.push({
        key: `file:${fileNode.path}`,
        name: fileNode.name,
        path: fileNode.path,
        depth,
        isDir: false,
        treePrefix: prefix + connector,
        doc: fileNode,
      })
    })
  }

  walk(root, 0, '')
  return result
})

const formatDate = (value?: string) => {
  if (!value) return '-'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value
  return parsedDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

const loadSelectedDoc = async () => {
  const projectId = activeProjectId.value
  const path = selectedPath.value
  if (!projectId || !path) {
    selectedContent.value = ''
    previewError.value = ''
    return
  }

  previewLoading.value = true
  previewError.value = ''
  try {
    const detail = await projectsApi.readDoc(projectId, path)
    selectedContent.value = detail.content
  } catch (error) {
    selectedContent.value = ''
    previewError.value = toErrorMessage(error, '读取知识库文件失败')
  } finally {
    previewLoading.value = false
  }
}

const syncSelectionAfterDocsChanged = async () => {
  if (!docs.value.length) {
    selectedPath.value = ''
    selectedContent.value = ''
    previewError.value = ''
    return
  }

  const selectedStillExists = docs.value.some((doc) => doc.path === selectedPath.value)
  if (!selectedStillExists) {
    selectedPath.value = docs.value[0]!.path
  }

  await loadSelectedDoc()
}

const openCreateModal = () => {
  editingPath.value = ''
  formPath.value = ''
  formContent.value = ''
  formError.value = ''
  modalOpen.value = true
}

const openEditModal = async (doc: ProjectDocItem) => {
  if (!activeProjectId.value) return
  editingPath.value = doc.path
  formPath.value = doc.path
  formContent.value = ''
  formError.value = ''
  modalOpen.value = true
  modalSaving.value = true

  try {
    const detail = await projectsApi.readDoc(activeProjectId.value, doc.path)
    formContent.value = detail.content
  } catch (error) {
    formError.value = toErrorMessage(error, '读取知识库文件失败')
  } finally {
    modalSaving.value = false
  }
}

const openEditSelected = async () => {
  if (!selectedDoc.value) return
  await openEditModal(selectedDoc.value)
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

const loadDocs = async () => {
  if (!activeProjectId.value) {
    docs.value = []
    selectedPath.value = ''
    selectedContent.value = ''
    previewError.value = ''
    return
  }

  docsLoading.value = true
  try {
    docs.value = await projectsApi.listDocs(activeProjectId.value)
    await syncSelectionAfterDocsChanged()
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
    docs.value = []
    selectedPath.value = ''
    selectedContent.value = ''
    previewError.value = ''
    queryMessages.value = []
    queryError.value = ''
    return
  }

  loading.value = true
  try {
    project.value = await projectsApi.detail(projectId)
    await loadDocs()
  } catch (error) {
    project.value = null
    docs.value = []
    selectedPath.value = ''
    selectedContent.value = ''
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
    await loadDocs()
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
    await loadDocs()
  } catch (error) {
    message.error(toErrorMessage(error, '删除知识库文件失败'))
  } finally {
    deletingPath.value = ''
  }
}

const removeSelected = async () => {
  if (!selectedDoc.value) return
  await removeDocByPath(selectedDoc.value.path)
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

  const existingPaths = new Set(docs.value.map((doc) => doc.path))
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
        const content = await file.text()
        if (existingPaths.has(nextPath)) {
          await projectsApi.updateDoc(projectId, { path: nextPath, content })
        } else {
          await projectsApi.createDoc(projectId, { path: nextPath, content })
          existingPaths.add(nextPath)
        }
        successCount += 1
      } catch {
        failCount += 1
      }
    }

    await loadDocs()
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
  <div class="container min-h-full space-y-4 py-4 md:py-5 fade-up">
    <section class="flex-shrink-0 space-y-1.5">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">知识库</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">项目知识库</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        左侧模拟 <code>/docs</code> 文件夹，右侧可预览文档内容；支持新建、编辑、删除、拖拽上传和点击选择上传。
      </p>
    </section>

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
          <article class="panel-card flex min-h-[780px] flex-col overflow-hidden p-4">
            <div class="flex-shrink-0 space-y-1">
              <p class="text-sm font-semibold">{{ project.name }}</p>
              <p class="text-xs text-muted-foreground">
                <span class="font-mono">{{ project.id }}</span>
                <span class="mx-2">•</span>
                <RouterLink :to="`/projects/${project.id}`" class="hover:text-foreground hover:underline">项目详情</RouterLink>
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
                @click="loadDocs"
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
              <p class="flex-shrink-0 px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">docs/</p>
              <div class="min-h-0 flex-1 overflow-auto pr-1 font-mono text-xs">
                <div v-if="treeItems.length === 0" class="px-2 py-6 text-muted-foreground">
                  暂无文档
                </div>
                <template v-else>
                  <div
                    v-for="item in treeItems"
                    :key="item.key"
                    class="mb-0.5 flex select-none rounded-md leading-relaxed"
                  >
                    <span v-if="item.isDir" class="flex-1 py-0.5 text-muted-foreground">
                      <span class="text-muted-foreground/70">{{ item.treePrefix }}</span>{{ item.name }}
                    </span>
                    <button
                      v-else
                      type="button"
                      class="min-w-0 flex-1 py-0.5 text-left transition"
                      :class="item.path === selectedPath ? 'text-foreground' : 'text-foreground/85 hover:text-foreground'"
                      @click="selectDoc(item.path)"
                    >
                      <span class="text-muted-foreground/70">{{ item.treePrefix }}</span>
                      <span
                        :class="[
                          'rounded px-1 py-0.5 transition',
                          item.path === selectedPath ? 'bg-primary/15' : 'hover:bg-background',
                        ]"
                      >
                        {{ item.name }}
                      </span>
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </article>

          <article class="panel-card flex min-h-[780px] flex-col overflow-hidden p-4">
            <div v-if="!selectedDoc" class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              从左侧文件树选择一个文档以预览内容。
            </div>

            <template v-else>
              <div class="flex flex-shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                  <p class="font-mono text-sm font-semibold">{{ selectedDoc.path }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {{ formatSize(selectedDoc.size) }} • 更新于 {{ formatDate(selectedDoc.updatedAt) }}
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    class="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-md"
                    type="button"
                    @click="openEditSelected"
                  >
                    编辑
                  </button>
                  <button
                    class="h-9 rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="deletingPath === selectedDoc.path"
                    type="button"
                    @click="removeSelected"
                  >
                    {{ deletingPath === selectedDoc.path ? '删除中...' : '删除' }}
                  </button>
                </div>
              </div>

              <div class="mt-4 flex min-h-[760px] flex-col gap-3">
                <div class="min-h-[380px] max-h-[520px] overflow-y-auto overflow-x-auto rounded-lg border border-border bg-background p-4">
                  <div v-if="previewLoading" class="text-sm text-muted-foreground">文档加载中...</div>
                  <div v-else-if="previewError" class="text-sm text-destructive">{{ previewError }}</div>
                  <MarkdownPreview v-else :content="selectedContent" />
                </div>

                <section class="flex h-[520px] min-h-[520px] max-h-[520px] flex-col overflow-hidden rounded-lg border border-border bg-background p-3">
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

                  <div class="mt-2 min-h-0 flex-1 overflow-auto pr-1">
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

                  <form class="mt-2 flex items-end gap-2 border-t border-border pt-2" @submit.prevent="submitKnowledgeQuery">
                    <textarea
                      v-model="queryQuestion"
                      class="min-h-[56px] flex-1 resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
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
              </div>
            </template>
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
