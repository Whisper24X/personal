<script setup lang="ts">
import type { TaskFileTreeNode } from './task-file-tree'

defineOptions({
  name: 'TaskFileTree',
})

const props = withDefaults(
  defineProps<{
    nodes: TaskFileTreeNode[]
    expandedPaths: Set<string>
    loadingPaths: Set<string>
    depth?: number
    selectedPath?: string | null
  }>(),
  {
    depth: 0,
    selectedPath: null,
  },
)

const emit = defineEmits<{
  'toggle-dir': [node: TaskFileTreeNode]
  'select-file': [node: TaskFileTreeNode]
}>()

const rowStyle = (depth: number) => {
  return {
    paddingLeft: `${8 + depth * 12}px`,
  }
}

const isExpanded = (path: string) => props.expandedPaths.has(path)
const isLoading = (path: string) => props.loadingPaths.has(path)

const onNodeClick = (node: TaskFileTreeNode) => {
  if (node.isDir) {
    emit('toggle-dir', node)
    return
  }

  emit('select-file', node)
}
</script>

<template>
  <div class="space-y-1">
    <div v-for="node in props.nodes" :key="node.path" class="space-y-1">
      <button
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
        :class="props.selectedPath === node.path ? 'bg-accent text-foreground' : 'hover:bg-accent/60'"
        :style="rowStyle(props.depth)"
        type="button"
        @click="onNodeClick(node)"
      >
        <span class="flex size-3 shrink-0 items-center justify-center text-muted-foreground">
          <svg
            v-if="node.isDir && isExpanded(node.path)"
            viewBox="0 0 20 20"
            fill="none"
            class="size-3"
            aria-hidden="true"
          >
            <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" />
          </svg>
          <svg
            v-else-if="node.isDir"
            viewBox="0 0 20 20"
            fill="none"
            class="size-3"
            aria-hidden="true"
          >
            <path d="M7.5 5 12.5 10 7.5 15" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" />
          </svg>
          <span v-else class="size-3" aria-hidden="true" />
        </span>

        <svg
          v-if="node.isDir"
          viewBox="0 0 20 20"
          fill="none"
          class="size-3.5 shrink-0 text-amber-500"
          aria-hidden="true"
        >
          <path d="M2.5 5.5a1 1 0 0 1 1-1h4l1.3 1.5H16.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
        </svg>
        <svg
          v-else
          viewBox="0 0 20 20"
          fill="none"
          class="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        >
          <path d="M6 3.5h5.5L15 7v9.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
          <path d="M11.5 3.5V7H15" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
        </svg>

        <span class="min-w-0 flex-1 truncate" :title="node.name">{{ node.name }}</span>
        <span v-if="isLoading(node.path)" class="ml-auto text-[10px] text-muted-foreground">加载中...</span>
      </button>

      <TaskFileTree
        v-if="node.isDir && isExpanded(node.path) && node.childrenLoaded"
        :nodes="node.children ?? []"
        :depth="props.depth + 1"
        :selected-path="props.selectedPath"
        :expanded-paths="props.expandedPaths"
        :loading-paths="props.loadingPaths"
        @toggle-dir="emit('toggle-dir', $event)"
        @select-file="emit('select-file', $event)"
      />

      <p
        v-if="node.isDir && isExpanded(node.path) && node.childrenLoaded && (node.children?.length ?? 0) === 0"
        class="px-2 py-1 text-xs text-muted-foreground"
        :style="rowStyle(props.depth + 1)"
      >
        空目录
      </p>
    </div>
  </div>
</template>
