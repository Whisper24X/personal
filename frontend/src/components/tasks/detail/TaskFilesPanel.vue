<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { tasksApi } from '@/api/tasks'
import type { TaskWorkspaceEntry, TaskWorkspacePreview } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'

const props = defineProps<{
  taskId: string
  branchName?: string | null
  refreshToken?: number
}>()

const loading = ref(false)
const errorMessage = ref('')
const currentPath = ref('.')
const entries = ref<TaskWorkspaceEntry[]>([])
const selectedPath = ref<string | null>(null)
const preview = ref<TaskWorkspacePreview | null>(null)
const previewLoading = ref(false)

const pathSegments = computed(() => {
  if (currentPath.value === '.') {
    return [] as string[]
  }

  return currentPath.value.split('/').filter(Boolean)
})

const loadTree = async (path = '.') => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await tasksApi.workspaceTree(props.taskId, {
      path,
    })
    currentPath.value = response.cwd
    entries.value = response.entries
  } catch (error) {
    errorMessage.value = toErrorMessage(error, '加载文件树失败')
  } finally {
    loading.value = false
  }
}

const resolveParentPath = () => {
  if (currentPath.value === '.') {
    return '.'
  }

  const parts = currentPath.value.split('/').filter(Boolean)
  parts.pop()

  if (parts.length === 0) {
    return '.'
  }

  return parts.join('/')
}

const loadPreview = async (path: string) => {
  previewLoading.value = true

  try {
    preview.value = await tasksApi.workspacePreview(props.taskId, path)
  } catch (error) {
    preview.value = null
    errorMessage.value = toErrorMessage(error, '加载文件预览失败')
  } finally {
    previewLoading.value = false
  }
}

const openEntry = async (entry: TaskWorkspaceEntry) => {
  if (entry.isDir) {
    await loadTree(entry.path)
    return
  }

  selectedPath.value = entry.path
  await loadPreview(entry.path)
}

const openBreadcrumb = async (index: number) => {
  if (index < 0) {
    await loadTree('.')
    return
  }

  const path = pathSegments.value.slice(0, index + 1).join('/')
  await loadTree(path)
}

watch(
  () => props.taskId,
  async () => {
    selectedPath.value = null
    preview.value = null
    await loadTree('.')
  },
  {
    immediate: true,
  },
)

watch(
  () => props.refreshToken,
  async () => {
    await loadTree(currentPath.value)
  },
)
</script>

<template>
  <div class="flex h-full min-w-0">
    <aside class="border-border/70 w-72 shrink-0 border-r bg-background/80">
      <header class="border-border/70 flex items-center justify-between border-b px-3 py-2 text-xs">
        <div class="min-w-0">
          <p class="text-muted-foreground">Files</p>
          <p class="truncate text-foreground">{{ props.branchName || '-' }}</p>
        </div>

        <button
          class="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          type="button"
          @click="loadTree(currentPath)"
        >
          刷新
        </button>
      </header>

      <div class="space-y-2 p-2 text-xs">
        <div class="flex flex-wrap items-center gap-1 text-muted-foreground">
          <button class="hover:text-foreground" type="button" @click="openBreadcrumb(-1)">workspace</button>
          <template v-for="(segment, index) in pathSegments" :key="`${index}-${segment}`">
            <span>/</span>
            <button class="hover:text-foreground" type="button" @click="openBreadcrumb(index)">{{ segment }}</button>
          </template>
        </div>

        <button
          class="text-muted-foreground hover:text-foreground"
          type="button"
          :disabled="currentPath === '.'"
          @click="loadTree(resolveParentPath())"
        >
          返回上级
        </button>

        <p v-if="loading" class="text-muted-foreground">加载中...</p>
        <p v-else-if="errorMessage" class="text-destructive">{{ errorMessage }}</p>

        <ul v-else class="space-y-1">
          <li v-for="entry in entries" :key="entry.path">
            <button
              class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition hover:bg-muted"
              :class="selectedPath === entry.path ? 'bg-muted' : ''"
              type="button"
              @click="openEntry(entry)"
            >
              <span class="truncate">
                <span class="mr-1 text-muted-foreground">{{ entry.isDir ? 'DIR' : 'FILE' }}</span>
                {{ entry.name }}
              </span>
            </button>
          </li>

          <li v-if="entries.length === 0" class="text-muted-foreground">当前目录为空</li>
        </ul>
      </div>
    </aside>

    <section class="min-w-0 flex-1 overflow-auto bg-muted/10 p-3">
      <div v-if="!selectedPath" class="flex h-full items-center justify-center text-sm text-muted-foreground">
        选择文件以预览
      </div>

      <div v-else-if="previewLoading" class="flex h-full items-center justify-center text-sm text-muted-foreground">
        预览加载中...
      </div>

      <div v-else-if="preview?.tooLarge" class="rounded-md border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
        文件过大，无法预览。
      </div>

      <div v-else-if="preview?.previewType === 'image' && preview.dataUrl" class="flex h-full items-start justify-center overflow-auto rounded-md border border-border bg-background p-2">
        <img :src="preview.dataUrl" :alt="preview.path" class="max-h-full max-w-full object-contain" />
      </div>

      <pre
        v-else-if="preview?.previewType === 'text'"
        class="max-h-full overflow-auto rounded-md border border-border bg-background p-3 text-xs text-foreground"
      >{{ preview?.text || '' }}</pre>

      <div v-else class="rounded-md border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
        二进制文件不支持在线预览。
      </div>
    </section>
  </div>
</template>
