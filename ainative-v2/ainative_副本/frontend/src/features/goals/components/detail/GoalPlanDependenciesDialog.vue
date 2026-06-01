<script setup lang="ts">
import type { DialogContentEmits, DialogRootEmits, DialogRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { reactiveOmit, useResizeObserver } from '@vueuse/core'
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-vue-next'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  useForwardPropsEmits,
} from 'reka-ui'
import { MarkdownPreview } from '@features/knowledge-base'
import { cn } from '@shared/lib/utils'
import { Button } from '@shared/ui/button'

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

const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_STEP = 1.1

const graphZoom = ref(1)

const zoomPercentLabel = computed(() => `${Math.round(graphZoom.value * 100)}%`)

const zoomOutDisabled = computed(() => graphZoom.value <= ZOOM_MIN + 1e-6)
const zoomInDisabled = computed(() => graphZoom.value >= ZOOM_MAX - 1e-6)

function zoomIn() {
  graphZoom.value = Math.min(ZOOM_MAX, Number((graphZoom.value * ZOOM_STEP).toFixed(3)))
}

function zoomOut() {
  graphZoom.value = Math.max(ZOOM_MIN, Number((graphZoom.value / ZOOM_STEP).toFixed(3)))
}

function resetZoom() {
  graphZoom.value = 1
}

watch(
  () => props.planDepsGraphKey,
  () => {
    graphZoom.value = 1
  },
)

function onGraphWheel(ev: WheelEvent) {
  if (!ev.ctrlKey && !ev.metaKey) {
    return
  }
  ev.preventDefault()
  if (ev.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

/** 滚动视口（含 p-2），用于得到可用内容宽度，避免缩放层与 100% 宽度循环依赖 */
const scrollViewportRef = ref<HTMLElement | null>(null)
const viewportContentWidth = ref(0)

function syncViewportContentWidth() {
  const el = scrollViewportRef.value
  if (!el) {
    return
  }
  const cs = getComputedStyle(el)
  const padX =
    parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0')
  viewportContentWidth.value = Math.max(0, el.clientWidth - padX)
}

useResizeObserver(scrollViewportRef, () => {
  syncViewportContentWidth()
})

const contentMeasureRef = ref<HTMLElement | null>(null)
const naturalW = ref(0)
const naturalH = ref(0)

useResizeObserver(contentMeasureRef, (entries) => {
  const entry = entries[0]
  if (!entry) {
    return
  }
  const { width, height } = entry.contentRect
  naturalW.value = width
  naturalH.value = height
})

const spacerStyle = computed(() => {
  const z = graphZoom.value
  const vw = viewportContentWidth.value
  /** 首次测量前避免占位 1px 把内容压扁，导致 natural 尺寸错误 */
  const baseW = naturalW.value > 0 ? naturalW.value : vw > 0 ? vw : 320
  const baseH = naturalH.value > 0 ? naturalH.value : 80
  return {
    width: `${Math.max(1, baseW * z)}px`,
    height: `${Math.max(1, baseH * z)}px`,
  }
})

const scaledLayerStyle = computed(() => ({
  transform: `scale(${graphZoom.value})`,
  transformOrigin: '0 0',
}))

const measureWrapperStyle = computed(() => {
  if (viewportContentWidth.value <= 0) {
    return undefined
  }
  return {
    minWidth: `${viewportContentWidth.value}px`,
    width: 'max-content',
  } as const
})

onMounted(() => {
  void nextTick(() => syncViewportContentWidth())
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void nextTick(() => syncViewportContentWidth())
    }
  },
)
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
                箭头方向表示「前置 → 后续」；前置子任务须「分支已合并」后，后置方可确认/物化。虚线框内为同一功能组下的子任务。子任务之间的实线来自 dependsOnSubTaskIds；跨功能组且仅配置在功能组上的依赖以虚线箭头标注「功能组依赖」。
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
                <span class="size-2.5 shrink-0 rounded-sm border border-sky-600 bg-sky-100 dark:border-sky-500 dark:bg-sky-950/80" />
                任务已完成
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="size-2.5 shrink-0 rounded-sm border border-teal-600 bg-teal-100 dark:border-teal-500 dark:bg-teal-950/80" />
                分支已合并
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

        <div class="flex min-h-0 w-full flex-1 flex-col gap-2">
          <div
            class="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <span class="min-w-0">按住 Ctrl（或 ⌘）并滚动可缩放</span>
            <div class="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                :disabled="zoomOutDisabled"
                aria-label="缩小依赖图"
                @click="zoomOut"
              >
                <ZoomOut class="size-4" />
              </Button>
              <span
                class="text-foreground tabular-nums"
                aria-live="polite"
                :title="`当前缩放 ${zoomPercentLabel}`"
              >
                {{ zoomPercentLabel }}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                :disabled="zoomInDisabled"
                aria-label="放大依赖图"
                @click="zoomIn"
              >
                <ZoomIn class="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="重置缩放为 100%"
                @click="resetZoom"
              >
                <RotateCcw class="size-4" />
              </Button>
            </div>
          </div>

          <div
            ref="scrollViewportRef"
            class="bg-muted/15 dark:bg-muted/25 from-muted/30 to-muted/5 max-h-[min(78vh,calc(85vh-9rem))] w-full min-h-0 flex-1 overflow-auto rounded-lg border border-border/80 bg-gradient-to-b p-2 shadow-inner [&_.markdown-preview]:text-sm [&_.markdown-preview_.mermaid]:flex [&_.markdown-preview_.mermaid]:justify-center [&_.markdown-preview_.mermaid]:py-0 [&_.markdown-preview_.mermaid_svg]:max-w-full [&_.markdown-preview_.mermaid_svg]:h-auto"
            @wheel="onGraphWheel"
          >
            <div class="relative" :style="spacerStyle">
              <div class="absolute top-0 left-0" :style="scaledLayerStyle">
                <div ref="contentMeasureRef" :style="measureWrapperStyle">
                  <MarkdownPreview :key="props.planDepsGraphKey" :content="props.planDepsMarkdown" />
                </div>
              </div>
            </div>
          </div>
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
