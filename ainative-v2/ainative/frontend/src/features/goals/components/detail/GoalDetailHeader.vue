<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { goalStatusLabel } from '@shared/constants/goal-status-labels'
import { Button } from '@shared/ui/button'
import { Card } from '@shared/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui/sheet'
import GoalPlanDependenciesDialog from '@features/goals/components/detail/GoalPlanDependenciesDialog.vue'
import type { GoalDetail, PlanGranularity } from '@/types/api/goals'

/** 需求详情头部标题展示上限（字），与摘要分开可调 */
const GOAL_DETAIL_TITLE_MAX_CHARS = 50
/** 需求详情头部摘要正文展示上限（字），不含「· 状态」后缀 */
const GOAL_DETAIL_SUMMARY_MAX_CHARS = 150

function truncateByGraphemes(text: string, max: number): { display: string; truncated: boolean } {
  const chars = Array.from(text)
  if (chars.length <= max) {
    return { display: text, truncated: false }
  }
  return { display: `${chars.slice(0, max).join('')}…`, truncated: true }
}

defineOptions({
  name: 'GoalDetailHeader',
})

const props = defineProps<{
  detail: GoalDetail
  goalHasPrd: boolean
  goalHasPlanItems: boolean
  generatingPrd: boolean
  generatingPlan: boolean
  planProgressDone: number
  planProgressTotal: number
  planProgressPercent: number
  planDependencyEdgeCount: number
  planDepsHasCycle: boolean
  planDepsGraphKey: string
  planDepsMarkdown: string
}>()

const emit = defineEmits<{
  back: []
  generatePrd: []
  generatePlan: [granularity: PlanGranularity]
}>()

const planDependenciesDialogOpen = ref(false)

const titlePresentation = computed(() => {
  const full = props.detail.goal.title ?? ''
  const { display, truncated } = truncateByGraphemes(full, GOAL_DETAIL_TITLE_MAX_CHARS)
  return { display, truncated, full }
})

const summaryPresentation = computed(() => {
  const raw = props.detail.goal.summary?.trim()
  if (!raw) {
    return { display: '无摘要', truncated: false, full: '', hasContent: false as const }
  }
  const { display, truncated } = truncateByGraphemes(raw, GOAL_DETAIL_SUMMARY_MAX_CHARS)
  return { display, truncated, full: raw, hasContent: true as const }
})

/** 与后端 goal-plan-prompt granularityHint 语义对齐 */
const PLAN_GRANULARITY_OPTIONS: {
  value: PlanGranularity
  title: string
  hint: string
}[] = [
  {
    value: 'coarse',
    title: '粗',
    hint: '粗粒度：顶层功能组数量与子任务总数尽量接近，倾向每组约一条子任务，整体划分更粗。',
  },
  {
    value: 'conservative',
    title: '保守',
    hint: '拆解偏保守：顶层功能组较少，每组内子任务可略多以覆盖较大范围。',
  },
  {
    value: 'standard',
    title: '标准',
    hint: '标准粒度：功能组数量与子任务密度平衡。',
  },
  {
    value: 'fine',
    title: '较细',
    hint: '拆解偏细：顶层功能组偏多或每组内子任务更细（实现步骤更碎）。',
  },
]

const planGenerateSheetOpen = ref(false)
const selectedPlanGranularity = ref<PlanGranularity>('standard')

watch(planGenerateSheetOpen, (open) => {
  if (open) {
    selectedPlanGranularity.value = 'standard'
  }
})

function openPlanGenerateSheet() {
  planGenerateSheetOpen.value = true
}

function confirmGeneratePlan() {
  emit('generatePlan', selectedPlanGranularity.value)
  planGenerateSheetOpen.value = false
}
</script>

<template>
  <Card class="gap-4 p-4 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <div class="mb-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="text-muted-foreground -ml-1 h-auto px-1 text-xs"
            @click="emit('back')"
          >
            返回
          </Button>
        </div>
        <h1
          class="text-lg font-semibold min-w-0 max-w-full break-words"
          :title="titlePresentation.truncated ? titlePresentation.full : undefined"
        >
          {{ titlePresentation.display }}
        </h1>
        <p class="text-muted-foreground max-w-3xl min-w-0 text-sm break-words">
          <span
            :title="
              summaryPresentation.hasContent && summaryPresentation.truncated
                ? summaryPresentation.full
                : undefined
            "
          >
            {{ summaryPresentation.display }}
          </span>
          <span> · 状态：{{ goalStatusLabel[props.detail.goal.status] }}</span>
        </p>
        <p class="text-muted-foreground mt-1 max-w-3xl font-mono text-xs">
          需求分支 {{ props.detail.goal.gitBranch }} · 基准 {{ props.detail.goal.gitBaseBranch }}
        </p>
        <p
          class="text-muted-foreground mt-1 flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 text-xs"
        >
          <span>进度：{{ props.planProgressDone }} / {{ props.planProgressTotal }} 子任务已完成</span>
          <span aria-hidden="true">·</span>
          <span>
            关联资料 {{ props.detail.sourceDocs.length }} 条 · 功能组
            {{ props.detail.planItems.length }} · 子任务
            {{
              props.detail.planItems.reduce((n, g) => n + (g.subTasks?.length ?? 0), 0)
            }}
            条
          </span>
          <span aria-hidden="true">·</span>
          <span>计划依赖边数 {{ props.planDependencyEdgeCount }}</span>
        </p>
        <div v-if="props.planProgressTotal > 0" class="mt-2 max-w-md">
          <div
            class="bg-muted h-1.5 w-full overflow-hidden rounded-full"
            role="progressbar"
            :aria-valuenow="Math.round(props.planProgressPercent)"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`已完成子任务 ${props.planProgressDone} / 子任务 ${props.planProgressTotal}，约 ${Math.round(props.planProgressPercent)}%`"
          >
            <div
              class="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
              :style="{
                width: `${Math.min(100, Math.max(0, props.planProgressPercent))}%`,
              }"
            />
          </div>
        </div>
      </div>
      <div class="flex max-w-xl flex-col items-end gap-2">
        <div class="flex flex-wrap justify-end gap-2">
          <Button
            v-if="!props.goalHasPrd"
            type="button"
            variant="outline"
            size="default"
            :disabled="props.generatingPrd || props.generatingPlan"
            @click="emit('generatePrd')"
          >
            {{ props.generatingPrd ? 'PRD 生成中…' : '生成 PRD' }}
          </Button>
          <Button
            v-else-if="props.goalHasPrd && !props.goalHasPlanItems"
            type="button"
            variant="outline"
            size="default"
            :disabled="props.generatingPrd || props.generatingPlan"
            @click="openPlanGenerateSheet"
          >
            {{ props.generatingPlan ? '任务计划生成中…' : '生成任务计划' }}
          </Button>
        </div>
        <Button
          v-if="props.goalHasPlanItems"
          type="button"
          variant="outline"
          size="sm"
          class="text-xs"
          @click="planDependenciesDialogOpen = true"
        >
          计划依赖图
        </Button>
        <GoalPlanDependenciesDialog
          :open="planDependenciesDialogOpen"
          :plan-deps-has-cycle="props.planDepsHasCycle"
          :plan-deps-graph-key="props.planDepsGraphKey"
          :plan-deps-markdown="props.planDepsMarkdown"
          @update:open="planDependenciesDialogOpen = $event"
        />
      </div>
    </div>
  </Card>

  <Sheet :open="planGenerateSheetOpen" @update:open="planGenerateSheetOpen = $event">
    <SheetContent side="right" class="flex w-full flex-col gap-0 sm:max-w-md">
      <SheetHeader class="text-left">
        <SheetTitle class="pr-8 text-base">生成任务计划</SheetTitle>
        <SheetDescription>请选择拆解粒度，将影响功能组与子任务的划分疏密。</SheetDescription>
      </SheetHeader>

      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
        <fieldset class="space-y-2">
          <legend class="sr-only">拆解粒度</legend>
          <label
            v-for="opt in PLAN_GRANULARITY_OPTIONS"
            :key="opt.value"
            class="border-border hover:bg-muted/40 flex cursor-pointer gap-3 rounded-md border p-3 transition-colors"
            :class="
              selectedPlanGranularity === opt.value ? 'border-primary bg-muted/30' : ''
            "
          >
            <input
              v-model="selectedPlanGranularity"
              type="radio"
              class="text-primary mt-1 size-4 shrink-0"
              :value="opt.value"
            />
            <span class="min-w-0">
              <span class="font-medium">{{ opt.title }}</span>
              <span class="text-muted-foreground mt-0.5 block text-xs leading-snug">{{
                opt.hint
              }}</span>
            </span>
          </label>
        </fieldset>
      </div>

      <SheetFooter class="gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          :disabled="props.generatingPlan"
          @click="planGenerateSheetOpen = false"
        >
          取消
        </Button>
        <Button
          type="button"
          :disabled="props.generatingPrd || props.generatingPlan"
          @click="confirmGeneratePlan"
        >
          开始生成
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
