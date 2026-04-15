<script setup lang="ts">
import { Card, CardContent } from '@shared/ui/card'

defineOptions({
  name: 'ProjectProgressCard',
})

const props = defineProps<{
  /** 如「42.5%」 */
  completionRateLabel: string
  /** SVG 圆周长（与 viewBox 中 r=42 一致时为 264） */
  ringCircumference: number
  /** 进度弧的 stroke-dashoffset */
  ringDashOffset: number
  doneCount: number
  runningCount: number
  todoCount: number
  reviewCount: number
}>()
</script>

<template>
  <Card>
    <CardContent class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div class="relative mx-auto size-[100px] shrink-0 sm:mx-0">
        <svg
          class="size-[100px] -rotate-90 text-primary"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle class="stroke-muted" cx="50" cy="50" r="42" fill="none" stroke-width="8" />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            stroke-width="8"
            stroke-linecap="round"
            :stroke-dasharray="props.ringCircumference"
            :stroke-dashoffset="props.ringDashOffset"
            class="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div
          class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          <span class="text-[22px] font-bold leading-none">{{ props.completionRateLabel }}</span>
          <span class="mt-0.5 text-[10px] text-muted-foreground">完成率</span>
        </div>
      </div>
      <div class="min-w-0 flex-1 space-y-2">
        <h4 class="text-sm font-semibold">项目进度</h4>
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>已完成</span>
          <span class="font-medium text-foreground">{{ props.doneCount }} 个</span>
        </div>
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>处理中</span>
          <span class="font-medium text-foreground">{{ props.runningCount }} 个</span>
        </div>
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>待执行</span>
          <span class="font-medium text-foreground">{{ props.todoCount }} 个</span>
        </div>
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>待完成</span>
          <span class="font-medium text-foreground">{{ props.reviewCount }} 个</span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
