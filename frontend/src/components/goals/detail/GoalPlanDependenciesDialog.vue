<script setup lang="ts">
import type { DialogContentEmits, DialogRootEmits, DialogRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { X } from 'lucide-vue-next'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  useForwardPropsEmits,
} from 'reka-ui'
import MarkdownPreview from '@/components/knowledge-base/MarkdownPreview.vue'
import { cn } from '@/lib/utils'

interface GoalPlanDependenciesDialogProps extends DialogRootProps {
  contentClass?: HTMLAttributes['class']
  planDepsHasCycle: boolean
  planDepsGraphKey: string
  planDepsMarkdown: string
}

defineOptions({
  name: 'GoalPlanDependenciesDialog',
  inheritAttrs: false,
})

const props = defineProps<GoalPlanDependenciesDialogProps>()
const emit = defineEmits<DialogRootEmits & DialogContentEmits>()

const rootProps = reactiveOmit(props, 'contentClass', 'planDepsHasCycle', 'planDepsGraphKey', 'planDepsMarkdown')
const forwarded = useForwardPropsEmits(rootProps, emit)
</script>

<template>
  <DialogRoot v-bind="forwarded">
    <DialogPortal>
      <DialogOverlay
        class="data-[state=open]:animate-in data-[state=closed]:animate-out fixed inset-0 z-50 bg-black/50 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogContent
        :class="
          cn(
            'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(92vw,960px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-hidden rounded-lg border p-5 shadow-lg duration-200 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            props.contentClass,
          )
        "
        v-bind="$attrs"
      >
        <div class="flex items-start justify-between gap-4 pr-8">
          <div class="min-w-0 flex-1 space-y-2">
            <div>
              <DialogTitle class="text-base font-semibold">计划依赖图</DialogTitle>
              <p class="text-muted-foreground mt-0.5 text-sm leading-snug">
                箭头方向表示「前置 → 后续」；同一前置完成后方可开始后续项。虚线框内为同一功能组下的子任务。子任务之间的实线来自 dependsOnSubTaskIds；跨功能组且仅配置在功能组上的依赖以虚线箭头标注「功能组依赖」。
              </p>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1.5">
                <span class="size-2.5 shrink-0 rounded-sm border border-amber-600 bg-amber-100 dark:border-amber-500 dark:bg-amber-950/80" />
                已确认
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="size-2.5 shrink-0 rounded-sm border border-emerald-600 bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950/80" />
                已创建任务
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="size-2.5 shrink-0 rounded-sm border border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/60" />
                待确认
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="size-2.5 shrink-0 rounded-sm border border-dashed border-slate-400 bg-slate-100 dark:border-slate-500 dark:bg-slate-900/40" />
                已取消
              </span>
            </div>
          </div>
        </div>

        <p v-if="props.planDepsHasCycle" class="text-destructive text-sm">
          检测到计划项依赖存在环，请修正后再继续。
        </p>

        <div
          class="bg-muted/15 dark:bg-muted/25 from-muted/30 to-muted/5 max-h-[min(78vh,calc(85vh-9rem))] w-full min-h-0 overflow-auto rounded-lg border border-border/80 bg-gradient-to-b p-2 shadow-inner [&_.markdown-preview]:text-sm [&_.markdown-preview_.mermaid]:flex [&_.markdown-preview_.mermaid]:justify-center [&_.markdown-preview_.mermaid]:py-0 [&_.markdown-preview_.mermaid_svg]:max-w-full [&_.markdown-preview_.mermaid_svg]:h-auto"
        >
          <MarkdownPreview :key="props.planDepsGraphKey" :content="props.planDepsMarkdown" />
        </div>

        <DialogClose
          class="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
        >
          <X class="size-4" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
