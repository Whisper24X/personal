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
  actionLoading: boolean
  showApproveConfirmation: boolean
}>()

const emit = defineEmits<{
  approveNode: [node: TaskNode]
  confirmApproveNode: [node: TaskNode]
  cancelApproveConfirmation: []
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
const nodeCanContinue = computed(() => {
  return Boolean(props.node?.agentCliSessionId?.trim())
})
const helperText = computed(() => {
  if (!isFailed.value) {
    return nodeCanContinue.value
      ? '请确认节点结果后再继续。'
      : '当前节点无法继续对话，请先确认节点结果。'
  }

  return nodeCanContinue.value
    ? '可补充回复继续执行，也可以从更多操作重置节点。'
    : '当前失败节点无法继续对话，请重置后重新执行。'
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
        <p
          v-if="!(props.showApproveConfirmation && props.node.status === 'in_review')"
          class="mt-1 text-xs text-muted-foreground"
        >
          {{ helperText }}
        </p>
        <p
          v-if="props.showApproveConfirmation && props.node.status === 'in_review'"
          class="mt-1 text-xs font-medium text-destructive"
        >
          该节点要求产物，但当前未检测到任何产物。确认仍要审批通过吗？
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <template v-if="props.canManageReview && props.node.status === 'in_review'">
          <template v-if="props.showApproveConfirmation">
            <button
              class="h-8 rounded-md bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.actionLoading"
              type="button"
              @click="emit('confirmApproveNode', props.node)"
            >
              确认通过
            </button>
            <button
              class="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.actionLoading"
              type="button"
              @click="emit('cancelApproveConfirmation')"
            >
              取消
            </button>
          </template>
          <button
            v-else
            class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="props.actionLoading"
            type="button"
            @click="emit('approveNode', props.node)"
          >
            审批通过
          </button>
        </template>
      </div>
    </div>
  </section>
</template>
