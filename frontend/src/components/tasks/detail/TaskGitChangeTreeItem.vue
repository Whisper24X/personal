<script setup lang="ts">
import { computed } from 'vue'
import type { FileTreeNode } from '@/components/core/file-browser/file-tree'
import type { TaskGitChangedFile } from '@/types/api/tasks'

defineOptions({
  name: 'TaskGitChangeTreeItem',
})

const INDENT_STEP_PX = 12
const INDENT_BASE_PX = 8

const props = withDefaults(
  defineProps<{
    node: FileTreeNode
    filesByPath: Record<string, TaskGitChangedFile>
    collapsedPaths: Set<string>
    selectedPath?: string | null
    depth?: number
    staged: boolean
  }>(),
  {
    selectedPath: null,
    depth: 0,
  },
)

const emit = defineEmits<{
  (event: 'select-file', file: TaskGitChangedFile): void
  (event: 'toggle-dir', path: string): void
  (event: 'toggle-stage', payload: { filePath: string; staged: boolean }): void
}>()

const file = computed(() => {
  if (props.node.isDir) {
    return null
  }

  return props.filesByPath[props.node.path] ?? null
})

const isExpanded = computed(() => {
  return !props.collapsedPaths.has(props.node.path)
})

const indentationStyle = computed(() => {
  return {
    paddingLeft: `${props.depth * INDENT_STEP_PX + INDENT_BASE_PX}px`,
  }
})

const statusText = computed(() => {
  return file.value?.status.trim() || ''
})

const statusTitle = computed(() => {
  const status = file.value?.status.trim()
  const map: Record<string, string> = {
    M: '修改',
    A: '新增',
    D: '删除',
    R: '重命名',
    C: '复制',
    U: '冲突',
    '??': '未跟踪',
    '!!': '忽略',
  }

  return status ? (map[status] ?? status) : ''
})

const rowClasses = computed(() => {
  if (props.node.isDir) {
    return 'text-foreground/90 hover:bg-accent/40'
  }

  if (props.selectedPath === props.node.path) {
    return 'bg-accent/70 text-foreground'
  }

  return 'text-muted-foreground hover:bg-accent/40'
})

const handleClick = () => {
  if (props.node.isDir) {
    emit('toggle-dir', props.node.path)
    return
  }

  if (file.value) {
    emit('select-file', file.value)
  }
}

const handleToggleStage = () => {
  if (!file.value) {
    return
  }

  emit('toggle-stage', {
    filePath: file.value.path,
    staged: props.staged,
  })
}
</script>

<template>
  <div class="space-y-0.5">
    <button
      class="group/tree flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[12px] font-mono transition-colors"
      :class="rowClasses"
      :style="indentationStyle"
      :aria-expanded="props.node.isDir ? isExpanded : undefined"
      :aria-current="
        !props.node.isDir && props.selectedPath === props.node.path ? 'true' : undefined
      "
      type="button"
      @click="handleClick"
    >
      <span class="flex size-3 shrink-0 items-center justify-center text-muted-foreground/80">
        <svg
          v-if="props.node.isDir"
          viewBox="0 0 20 20"
          fill="none"
          class="size-3 transition-transform"
          :class="isExpanded ? 'rotate-90' : ''"
          aria-hidden="true"
        >
          <path
            d="M7.5 5 12.5 10 7.5 15"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.6"
          />
        </svg>
        <span v-else class="size-3" aria-hidden="true" />
      </span>

      <svg
        v-if="props.node.isDir"
        viewBox="0 0 20 20"
        fill="none"
        class="size-3.5 shrink-0 text-amber-500/90"
        aria-hidden="true"
      >
        <path
          d="M2.5 5.5a1 1 0 0 1 1-1h4l1.3 1.5H16.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8Z"
          stroke="currentColor"
          stroke-linejoin="round"
          stroke-width="1.5"
        />
      </svg>
      <svg
        v-else
        viewBox="0 0 20 20"
        fill="none"
        class="size-3.5 shrink-0 text-muted-foreground/75"
        aria-hidden="true"
      >
        <path
          d="M6 3.5h5.5L15 7v9.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          stroke-linejoin="round"
          stroke-width="1.5"
        />
        <path d="M11.5 3.5V7H15" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
      </svg>

      <span
        class="min-w-0 flex-1 truncate"
        :class="props.node.isDir ? 'font-semibold text-foreground' : ''"
      >
        {{ props.node.name }}
      </span>

      <template v-if="file">
        <span
          class="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
          :class="
            props.staged
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'bg-muted/40 text-muted-foreground'
          "
          :title="statusTitle"
        >
          {{ statusText }}
        </span>
        <button
          class="shrink-0 rounded px-1 text-[10px] text-muted-foreground/70 transition-colors hover:bg-background hover:text-foreground"
          type="button"
          @click.stop="handleToggleStage"
        >
          {{ props.staged ? '取消' : '暂存' }}
        </button>
      </template>
    </button>

    <div v-if="props.node.isDir && isExpanded" class="space-y-0.5">
      <TaskGitChangeTreeItem
        v-for="child in props.node.children ?? []"
        :key="child.path"
        :node="child"
        :files-by-path="props.filesByPath"
        :collapsed-paths="props.collapsedPaths"
        :selected-path="props.selectedPath"
        :depth="props.depth + 1"
        :staged="props.staged"
        @select-file="emit('select-file', $event)"
        @toggle-dir="emit('toggle-dir', $event)"
        @toggle-stage="emit('toggle-stage', $event)"
      />
    </div>
  </div>
</template>
