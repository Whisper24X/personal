<script setup lang="ts">
import { computed } from 'vue'
import type { SkillTreeNode as SkillTreeFileNode } from '@/types/api/skills'

defineOptions({
  name: 'SkillTreeItem',
})

const INDENT_STEP_PX = 12
const INDENT_BASE_PX = 8

const props = withDefaults(
  defineProps<{
    node: SkillTreeFileNode
    selectedPath: string
    expandedDirs: Set<string>
    depth?: number
  }>(),
  {
    depth: 0,
  },
)

const emit = defineEmits<{
  (event: 'select-file', path: string): void
  (event: 'toggle-dir', path: string): void
}>()

const isExpanded = computed(() => {
  return props.expandedDirs.has(props.node.path)
})

const indentationStyle = computed(() => {
  return {
    paddingLeft: `${props.depth * INDENT_STEP_PX + INDENT_BASE_PX}px`,
  }
})

const itemClasses = computed(() => {
  return props.node.isDir
    ? 'text-foreground/80'
    : props.selectedPath === props.node.path
      ? 'bg-primary/10 font-semibold text-primary'
      : 'text-foreground/70'
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
  <div>
    <button
      type="button"
      class="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-xs transition hover:bg-muted"
      :class="itemClasses"
      :style="indentationStyle"
      :aria-expanded="props.node.isDir ? isExpanded : undefined"
      :aria-current="!props.node.isDir && props.selectedPath === props.node.path ? 'true' : undefined"
      @click="handleClick"
    >
      <template v-if="props.node.isDir">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="shrink-0 transition-transform"
          :class="isExpanded ? 'rotate-90' : ''"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="shrink-0 text-muted-foreground"
        >
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        </svg>
      </template>

      <template v-else>
        <span class="inline-flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden="true" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="shrink-0 text-muted-foreground"
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
      </template>

      <span class="truncate" :class="props.node.isDir ? 'font-semibold' : ''">
        {{ props.node.name }}
      </span>
    </button>

    <div v-if="props.node.isDir && isExpanded">
      <SkillTreeItem
        v-for="child in props.node.children"
        :key="child.path"
        :node="child"
        :selected-path="props.selectedPath"
        :expanded-dirs="props.expandedDirs"
        :depth="props.depth + 1"
        @select-file="emit('select-file', $event)"
        @toggle-dir="emit('toggle-dir', $event)"
      />
    </div>
  </div>
</template>
