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
            'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed top-1/2 left-1/2 z-50 grid w-[min(92vw,960px)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-lg border p-6 shadow-lg duration-200 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            props.contentClass,
          )
        "
        v-bind="$attrs"
      >
        <div class="flex items-start justify-between gap-4 pr-8">
          <div>
            <DialogTitle class="text-base font-semibold">计划依赖图</DialogTitle>
            <p class="text-muted-foreground mt-1 text-sm">
              拆解计划项之间的依赖关系，黄色表示已确认，绿色表示已物化
            </p>
          </div>
        </div>

        <p v-if="props.planDepsHasCycle" class="text-destructive text-sm">
          检测到计划项依赖存在环，请修正后再物化。
        </p>

        <div
          class="bg-muted/20 min-h-0 flex-1 overflow-auto rounded-md border border-border p-3 [&_.markdown-preview]:text-sm"
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
