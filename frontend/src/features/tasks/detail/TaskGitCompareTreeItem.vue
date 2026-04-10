<script setup lang="ts">
import { computed } from 'vue'
import type { FileTreeNode } from '@shared/components/file-browser/file-tree'
import type { TaskGitBranchDiffFile } from '@/types/api/tasks'

defineOptions({
  name: 'TaskGitCompareTreeItem',
})

const INDENT_STEP_PX = 12
const INDENT_BASE_PX = 8

const props = withDefaults(
  defineProps<{
    node: FileTreeNode
    filesByPath: Record<string, TaskGitBranchDiffFile>
    collapsedPaths: Set<string>
    selectedPath?: string | null
    depth?: number
  }>(),
  {
    selectedPath: null,
    depth: 0,
  },
)

const emit = defineEmits<{
  (event: 'select-file', path: string): void
  (event: 'toggle-dir', path: string): void
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

  emit('select-file', props.node.path)
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

      <span
        v-if="file"
        class="shrink-0 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-700 dark:text-sky-300"
        :title="statusTitle"
      >
        {{ statusText }}
      </span>
    </button>

    <div v-if="props.node.isDir && isExpanded" class="space-y-0.5">
      <TaskGitCompareTreeItem
        v-for="child in props.node.children ?? []"
        :key="child.path"
        :node="child"
        :files-by-path="props.filesByPath"
        :collapsed-paths="props.collapsedPaths"
        :selected-path="props.selectedPath"
        :depth="props.depth + 1"
        @select-file="emit('select-file', $event)"
        @toggle-dir="emit('toggle-dir', $event)"
      />
    </div>
  </div>
</template>
