<script setup lang="ts">
import { computed } from 'vue'
import type { Task, TaskNode } from '@/types/api/tasks'

defineOptions({
  name: 'TaskDetailWorkflowCard',
})

const props = defineProps<{
  nodes: TaskNode[]
  selectedNodeId: string | null
  statusLabelMap: Record<Task['status'], string>
  canManageReview: boolean
}>()

const emit = defineEmits<{
  selectNode: [nodeId: string]
  approveNode: [node: TaskNode]
}>()

const currentReviewNode = computed(() => {
  return props.nodes.find((node) => node.status === 'in_review') ?? null
})

const nodeChipClass = (node: TaskNode) => {
  if (node.status === 'done') {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  }
  if (node.status === 'in_progress') {
    return 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
  }
  if (node.status === 'in_review') {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  }
  return 'bg-muted/40 text-muted-foreground'
}

const nodeDotClass = (node: TaskNode) => {
  if (node.status === 'done') {
    return 'bg-emerald-500'
  }
  if (node.status === 'in_progress') {
    return 'bg-sky-500'
  }
  if (node.status === 'in_review') {
    return 'bg-amber-500'
  }
  return 'bg-muted-foreground/40'
}
</script>

<template>
  <section v-if="props.nodes.length > 0" class="border-border/50 bg-background/95 rounded-xl border shadow-sm">
    <div class="border-border/50 flex items-center gap-2 border-b px-3 py-2">
      <span class="text-muted-foreground text-xs font-semibold">Workflow</span>
    </div>

    <div class="space-y-2 px-3 py-2">
      <div class="-mx-1 overflow-x-auto overflow-y-visible px-1 py-1 scrollbar-hide">
        <div class="flex min-w-max items-center gap-1 py-0.5 pr-2">
          <template v-for="(node, index) in props.nodes" :key="node.id">
            <button
              class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition"
              :class="[
                nodeChipClass(node),
                props.selectedNodeId === node.id ? 'ring-primary/50 ring-2' : '',
              ]"
              type="button"
              :title="node.name"
              @click="emit('selectNode', node.id)"
            >
              <span class="h-2 w-2 rounded-full" :class="nodeDotClass(node)" />
              <span class="max-w-[96px] truncate">{{ node.name || `节点 ${index + 1}` }}</span>
            </button>
            <div
              v-if="index < props.nodes.length - 1"
              class="mx-0.5 h-px w-3"
              :class="node.status === 'done' ? 'bg-emerald-500/40' : 'bg-muted-foreground/20'"
            />
          </template>
        </div>
      </div>

      <div v-if="currentReviewNode" class="rounded-md border border-amber-500/30 bg-amber-50/30 px-2 py-2">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="text-xs font-medium text-amber-700">节点待审批</p>
            <p class="truncate text-xs text-muted-foreground">
              #{{ currentReviewNode.nodeOrder }} {{ currentReviewNode.name }} · {{ props.statusLabelMap[currentReviewNode.status] }}
            </p>
          </div>
          <button
            v-if="props.canManageReview"
            class="h-7 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground"
            type="button"
            @click="emit('approveNode', currentReviewNode)"
          >
            审批通过
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
