<script setup lang="ts">
import type { SkillTreeNode as SkillTreeFileNode } from '@/types/api/skills'
import SkillTreeItem from './SkillTreeItem.vue'

defineOptions({
  name: 'SkillTree',
})

const props = defineProps<{
  nodes: SkillTreeFileNode[]
  selectedPath: string
  expandedDirs: Set<string>
}>()

const emit = defineEmits<{
  (event: 'select-file', path: string): void
  (event: 'toggle-dir', path: string): void
}>()
</script>

<template>
  <div role="tree" class="space-y-0.5">
    <SkillTreeItem
      v-for="node in props.nodes"
      :key="node.path"
      :node="node"
      :selected-path="props.selectedPath"
      :expanded-dirs="props.expandedDirs"
      @select-file="emit('select-file', $event)"
      @toggle-dir="emit('toggle-dir', $event)"
    />
  </div>
</template>
