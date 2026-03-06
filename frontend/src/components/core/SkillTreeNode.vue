<script setup lang="ts">
import type { SkillTreeNode } from '@/types/api/skills'

const props = defineProps<{
  nodes: SkillTreeNode[]
  selectedPath: string
  expandedDirs: Set<string>
  depth?: number
}>()

const emit = defineEmits<{
  'select-file': [path: string]
  'toggle-dir': [path: string]
}>()

const currentDepth = props.depth ?? 0
</script>

<template>
  <template v-for="node in nodes" :key="node.path">
    <template v-if="node.isDir">
      <button
        type="button"
        class="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-xs text-foreground/80 transition hover:bg-muted"
        :style="{ paddingLeft: `${currentDepth * 12 + 8}px` }"
        @click="emit('toggle-dir', node.path)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" :class="expandedDirs.has(node.path) ? 'rotate-90' : ''" class="flex-shrink-0 transition-transform"><path d="m9 18 6-6-6-6"/></svg>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="flex-shrink-0 text-muted-foreground"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
        <span class="truncate font-semibold">{{ node.name }}</span>
      </button>
      <SkillTreeNode
        v-if="expandedDirs.has(node.path)"
        :nodes="node.children"
        :selected-path="selectedPath"
        :expanded-dirs="expandedDirs"
        :depth="currentDepth + 1"
        @select-file="emit('select-file', $event)"
        @toggle-dir="emit('toggle-dir', $event)"
      />
    </template>
    <button
      v-else
      type="button"
      class="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-xs transition hover:bg-muted"
      :class="selectedPath === node.path ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground/70'"
      :style="{ paddingLeft: `${currentDepth * 12 + 8}px` }"
      @click="emit('select-file', node.path)"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="flex-shrink-0 text-muted-foreground"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
      <span class="truncate">{{ node.name }}</span>
    </button>
  </template>
</template>
