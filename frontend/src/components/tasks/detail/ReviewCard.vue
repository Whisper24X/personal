<script setup lang="ts">
import type { Task, TaskNode } from '@/types/api/tasks'

defineOptions({
  name: 'TaskDetailReviewCard',
})

const props = defineProps<{
  node: TaskNode | null
  statusLabelMap: Record<Task['status'], string>
  canManageReview: boolean
}>()

const emit = defineEmits<{
  approveNode: [node: TaskNode]
}>()
</script>

<template>
  <section
    v-if="props.node"
    class="w-full rounded-xl border border-amber-500/30 bg-amber-50/30 shadow-sm"
  >
    <div class="flex items-center justify-between gap-3 px-4 py-3">
      <div class="min-w-0">
        <p class="text-xs font-medium text-amber-700">节点待审批</p>
        <p class="truncate text-xs text-muted-foreground">
          #{{ props.node.nodeOrder }} {{ props.node.name }} · {{ props.statusLabelMap[props.node.status] }}
        </p>
      </div>

      <button
        v-if="props.canManageReview"
        class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
        type="button"
        @click="emit('approveNode', props.node)"
      >
        审批通过
      </button>
    </div>
  </section>
</template>
