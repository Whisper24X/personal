<script setup lang="ts">
import { computed } from 'vue'
import type { TaskNode } from '@/types/api/tasks'

defineOptions({
  name: 'TaskDetailReviewCard',
})

const props = defineProps<{
  node: TaskNode | null
  statusLabelMap: Record<TaskNode['status'], string>
  canManageReview: boolean
}>()

const emit = defineEmits<{
  approveNode: [node: TaskNode]
}>()

const isFailed = computed(() => props.node?.status === 'failed')
const cardClass = computed(() => {
  return isFailed.value
    ? 'border-destructive/30 bg-destructive/5'
    : 'border-amber-500/30 bg-amber-50/30'
})
const titleClass = computed(() => {
  return isFailed.value ? 'text-destructive' : 'text-amber-700'
})
const titleText = computed(() => {
  return isFailed.value ? '节点执行失败' : '节点待审批'
})
const helperText = computed(() => {
  return isFailed.value ? '请先重试或重置后再继续执行。' : '请确认节点结果后再继续。'
})
</script>

<template>
  <section
    v-if="props.node"
    class="w-full rounded-none border shadow-sm"
    :class="cardClass"
  >
    <div class="flex items-center justify-between gap-3 px-4 py-3">
      <div class="min-w-0">
        <p class="text-xs font-medium" :class="titleClass">{{ titleText }}</p>
        <p class="truncate text-xs text-muted-foreground">
          #{{ props.node.nodeOrder }} {{ props.node.name }} · {{ props.statusLabelMap[props.node.status] }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">{{ helperText }}</p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          v-if="props.canManageReview && props.node.status === 'in_review'"
          class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
          type="button"
          @click="emit('approveNode', props.node)"
        >
          审批通过
        </button>
      </div>
    </div>
  </section>
</template>
