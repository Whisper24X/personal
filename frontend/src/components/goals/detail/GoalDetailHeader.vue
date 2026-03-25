<script setup lang="ts">
import { goalStatusLabel } from '@/constants/goal-status-labels'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { GoalDetail } from '@/types/api/goals'

defineOptions({
  name: 'GoalDetailHeader',
})

const props = defineProps<{
  detail: GoalDetail
  goalHasPrd: boolean
  goalHasPlanItems: boolean
  generatingPrd: boolean
  generatingPlan: boolean
  materializing: boolean
  planProgressDone: number
  planProgressTotal: number
  planProgressPercent: number
  planDependencyEdgeCount: number
}>()

const emit = defineEmits<{
  back: []
  generatePrd: []
  generatePlan: []
  materializeSelected: []
}>()
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
        <h1 class="text-lg font-semibold">{{ props.detail.goal.title }}</h1>
        <p class="text-muted-foreground max-w-3xl text-sm">
          {{ props.detail.goal.summary || '无摘要' }} · 状态：{{
            goalStatusLabel[props.detail.goal.status]
          }}
        </p>
        <p
          class="text-muted-foreground mt-1 flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 text-xs"
        >
          <span>进度：{{ props.planProgressDone }} / {{ props.planProgressTotal }} 已完成</span>
          <span aria-hidden="true">·</span>
          <span>
            关联资料 {{ props.detail.sourceDocs.length }} 条 · 计划项 {{ props.detail.planItems.length }} 条
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
            :aria-label="`已完成任务 ${props.planProgressDone} / 拆解计划 ${props.planProgressTotal}，约 ${Math.round(props.planProgressPercent)}%`"
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
        <p class="max-w-md text-right text-xs text-muted-foreground">
          物化前请在「拆解计划」中为每条已确认项配置工作流。
        </p>
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
            @click="emit('generatePlan')"
          >
            {{ props.generatingPlan ? '拆解计划生成中…' : '生成拆解计划' }}
          </Button>
          <Button
            v-else
            type="button"
            variant="default"
            size="default"
            :disabled="props.materializing || props.generatingPrd || props.generatingPlan"
            @click="emit('materializeSelected')"
          >
            {{ props.materializing ? '物化中…' : '物化已确认项' }}
          </Button>
        </div>
      </div>
    </div>
  </Card>
</template>
