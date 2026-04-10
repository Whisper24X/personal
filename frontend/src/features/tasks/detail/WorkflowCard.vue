<script setup lang="ts">
import { nextTick } from 'vue'
import type { TaskNode } from '@/types/api/tasks'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'

defineOptions({
  name: 'TaskDetailWorkflowCard',
})

const props = defineProps<{
  nodes: TaskNode[]
  selectedNodeId: string | null
}>()

const emit = defineEmits<{
  selectNode: [nodeId: string]
}>()

const nodeButtonRefs = new Map<string, HTMLButtonElement>()

const setNodeButtonRef = (nodeId: string, element: HTMLButtonElement | null) => {
  if (element) {
    nodeButtonRefs.set(nodeId, element)
    return
  }

  nodeButtonRefs.delete(nodeId)
}

const resolveLoopDisplay = (node: TaskNode) => {
  const lj = node.loopJson
  if (!lj || lj.maxLoops <= 1) return null
  const max = lj.maxLoops
  const count = typeof lj.loopCount === 'number' ? lj.loopCount : 0
  let current = count
  if (node.status === 'in_progress' || node.status === 'todo') {
    if (count < max) current = count + 1
  }
  if (node.status === 'done' || node.status === 'in_review') {
    current = Math.max(count, 1)
  }
  const earlyExit = (node.status === 'done' || node.status === 'in_review') && count > 0 && count < max
  return { badge: `<${current}/${max}>`, earlyExit }
}

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

const scrollToNode = async (nodeId: string) => {
  await nextTick()
  const button = nodeButtonRefs.get(nodeId)
  button?.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'center',
  })
}

defineExpose({
  scrollToNode,
})
</script>

<template>
  <section v-if="props.nodes.length > 0" class="border-border/50 bg-background/95 w-full rounded-none border shadow-sm">
    <div class="border-border/50 flex items-center justify-between gap-2 border-b px-3 py-2">
      <span class="text-muted-foreground text-xs font-semibold">工作流</span>
    </div>

    <div class="space-y-2 px-3 py-2">
      <div class="-mx-1 overflow-x-auto overflow-y-visible px-1 py-1 scrollbar-hide">
        <div class="flex min-w-max items-center gap-1 py-0.5 pr-2">
          <template v-for="(node, index) in props.nodes" :key="node.id">
            <div class="flex items-center gap-0.5">
              <button
                class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition"
                :class="[
                  nodeChipClass(node),
                  props.selectedNodeId === node.id ? 'ring-primary/50 ring-2' : '',
                ]"
                type="button"
                :title="node.name"
                :ref="(element) => setNodeButtonRef(node.id, element as HTMLButtonElement | null)"
                @click="emit('selectNode', node.id)"
              >
                <span class="h-2 w-2 rounded-full shrink-0" :class="nodeDotClass(node)" />
                <span class="whitespace-nowrap">{{ node.name || `节点 ${index + 1}` }}</span>
                <template v-if="resolveLoopDisplay(node)">
                  <Tooltip v-if="resolveLoopDisplay(node)!.earlyExit">
                    <TooltipTrigger as-child>
                      <span
                        class="shrink-0 font-mono text-[10px] opacity-90 text-amber-600 dark:text-amber-400 cursor-default"
                      >
                        {{ resolveLoopDisplay(node)!.badge }} ✓
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span>已提前完成，未达最大循环次数</span>
                    </TooltipContent>
                  </Tooltip>
                  <span
                    v-else
                    class="text-muted-foreground shrink-0 font-mono text-[10px] opacity-90"
                  >
                    {{ resolveLoopDisplay(node)!.badge }}
                  </span>
                </template>
              </button>
            </div>
            <div
              v-if="index < props.nodes.length - 1"
              class="mx-0.5 h-px w-3"
              :class="node.status === 'done' ? 'bg-emerald-500/40' : 'bg-muted-foreground/20'"
            />
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
