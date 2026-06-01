<script setup lang="ts">
import type { FileTreeNode } from './file-tree'

defineOptions({
  name: 'FileTree',
})

const props = withDefaults(
  defineProps<{
    nodes: FileTreeNode[]
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
  'toggle-dir': [node: FileTreeNode]
  'select-file': [node: FileTreeNode]
}>()

const rowStyle = (depth: number) => {
  return {
    paddingLeft: `${6 + depth * 10}px`,
  }
}

const isExpanded = (path: string) => props.expandedPaths.has(path)
const isLoading = (path: string) => props.loadingPaths.has(path)

const onNodeClick = (node: FileTreeNode) => {
  if (node.isDir) {
    emit('toggle-dir', node)
    return
  }

  emit('select-file', node)
}
</script>

<template>
  <div class="space-y-0.5">
    <div v-for="node in props.nodes" :key="node.path" class="space-y-0.5">
      <button
        class="group/tree relative flex h-7 w-full items-center gap-1.5 rounded-sm px-2 font-mono text-[12px] transition-colors"
        :class="props.selectedPath === node.path ? 'bg-accent/70 text-foreground' : 'text-foreground/90 hover:bg-accent/40'"
        :style="rowStyle(props.depth)"
        type="button"
        @click="onNodeClick(node)"
      >
        <span
          v-if="props.selectedPath === node.path"
          class="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-primary"
          aria-hidden="true"
        />

        <span class="flex size-3 shrink-0 items-center justify-center text-muted-foreground/80">
          <svg
            v-if="node.isDir && isExpanded(node.path)"
            viewBox="0 0 20 20"
            fill="none"
            class="size-3 transition-transform"
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
          class="size-3.5 shrink-0 text-amber-500/90"
          aria-hidden="true"
        >
          <path d="M2.5 5.5a1 1 0 0 1 1-1h4l1.3 1.5H16.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
        </svg>
        <svg
          v-else
          viewBox="0 0 20 20"
          fill="none"
          class="size-3.5 shrink-0 text-muted-foreground/75"
          aria-hidden="true"
        >
          <path d="M6 3.5h5.5L15 7v9.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
          <path d="M11.5 3.5V7H15" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
        </svg>

        <span class="min-w-0 flex-1 truncate text-left" :title="node.name">{{ node.name }}</span>
        <span
          v-if="isLoading(node.path)"
          class="ml-auto shrink-0 rounded border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          加载中
        </span>
      </button>

      <FileTree
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
        class="px-2 py-1 text-[11px] text-muted-foreground"
        :style="rowStyle(props.depth + 1)"
      >
        空目录
      </p>
    </div>
  </div>
</template>
