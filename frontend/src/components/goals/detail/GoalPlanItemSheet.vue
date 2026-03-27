<script setup lang="ts">
import { computed } from 'vue'
import AppSelect from '@/components/core/select'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { GoalPlanSubTask } from '@/types/api/goals'
import type { WorkflowTemplate } from '@/types/api/workflow'

defineOptions({
  name: 'GoalPlanItemSheet',
})

type SelectOption = {
  label: string
  value: string
}

const props = defineProps<{
  open: boolean
  selectedPlanGroupTitle: string
  selectedPlanItem: GoalPlanSubTask | null
  planItemStatusLabel: Record<GoalPlanSubTask['status'], string>
  planItemEditSummary: string
  planItemEditAcceptance: string
  planItemEditSuggestedPrompt: string
  dependencyTitles: string[]
  workflowName: string
  loadingWorkflowTemplates: boolean
  workflowTemplates: WorkflowTemplate[]
  workflowOptionsForPlanItem: (workflowTemplateId: string | null | undefined) => SelectOption[]
  savingPlanItemWorkflowId: string | null
  selectPanelZIndex: number
  selectPanelPlacement: 'top'
  savingPlanItemText: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  'update:planItemEditSummary': [value: string]
  'update:planItemEditAcceptance': [value: string]
  'update:planItemEditSuggestedPrompt': [value: string]
  reset: []
  confirm: []
  goTask: [taskId: string]
  setPlanItemWorkflow: [payload: { item: GoalPlanSubTask; workflowTemplateId: string }]
}>()

const summaryModel = computed({
  get: () => props.planItemEditSummary,
  set: (value: string) => emit('update:planItemEditSummary', value),
})

const acceptanceModel = computed({
  get: () => props.planItemEditAcceptance,
  set: (value: string) => emit('update:planItemEditAcceptance', value),
})

const suggestedPromptModel = computed({
  get: () => props.planItemEditSuggestedPrompt,
  set: (value: string) => emit('update:planItemEditSuggestedPrompt', value),
})

const planItemReadonly = computed(() => props.selectedPlanItem?.status !== 'draft')

/** 待确认 / 已确认未物化：仅在侧栏配置工作流 */
const showWorkflowPicker = computed(
  () =>
    props.selectedPlanItem &&
    (props.selectedPlanItem.status === 'draft' ||
      props.selectedPlanItem.status === 'approved') &&
    !props.selectedPlanItem.taskId,
)
</script>

<template>
  <Sheet :open="props.open" @update:open="emit('update:open', $event)">
    <SheetContent
      side="right"
      class="flex w-full max-h-[100vh] flex-col gap-0 overflow-hidden sm:max-w-[720px]"
    >
      <template v-if="props.selectedPlanItem">
        <SheetHeader class="border-border bg-background px-6 py-5 text-left border-b">
          <div class="space-y-4 pr-8">
            <p
              v-if="props.selectedPlanGroupTitle"
              class="text-muted-foreground text-xs font-normal"
            >
              {{ props.selectedPlanGroupTitle }}
            </p>
            <SheetTitle class="text-xl leading-8 font-semibold tracking-tight">
              {{ props.selectedPlanItem.title }}
            </SheetTitle>
            <dl class="grid gap-3 sm:grid-cols-2">
              <div class="bg-muted/40 rounded-xl border border-border/70 px-4 py-3">
                <dt class="text-muted-foreground text-[11px] font-medium tracking-[0.08em]">
                  状态
                </dt>
                <dd class="mt-2 text-sm font-medium">
                  {{ props.planItemStatusLabel[props.selectedPlanItem.status] }}
                </dd>
              </div>
              <div class="bg-muted/40 rounded-xl border border-border/70 px-4 py-3">
                <dt class="text-muted-foreground text-[11px] font-medium tracking-[0.08em]">
                  顺序
                </dt>
                <dd class="mt-2 text-sm font-medium">
                  第 {{ props.selectedPlanItem.itemOrder + 1 }} 项
                </dd>
              </div>
            </dl>
          </div>
        </SheetHeader>
        <div class="bg-muted/20 flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 text-sm">
          <div class="space-y-6">
            <section class="bg-background rounded-2xl border border-border/70 p-5 shadow-sm">
              <div class="mb-4">
                <h3 class="text-sm font-semibold">基本信息</h3>
              </div>
              <dl class="grid gap-3 sm:grid-cols-2">
                <div
                  v-if="showWorkflowPicker"
                  class="bg-muted/35 rounded-xl border border-border/60 px-4 py-3 sm:col-span-2"
                >
                  <dt class="text-muted-foreground text-[11px] font-medium tracking-[0.08em]">
                    配置工作流
                  </dt>
                  <dd class="mt-2">
                    <AppSelect
                      :model-value="props.selectedPlanItem.workflowTemplateId ?? ''"
                      aria-label="子任务配置工作流"
                      :block="true"
                      :match-trigger-width="false"
                      :trigger-label-truncate="false"
                      :option-label-truncate="false"
                      :options="
                        props.workflowOptionsForPlanItem(
                          props.selectedPlanItem.workflowTemplateId,
                        )
                      "
                      :disabled="
                        props.loadingWorkflowTemplates ||
                        props.workflowTemplates.length === 0 ||
                        props.savingPlanItemWorkflowId === props.selectedPlanItem.id
                      "
                      :panel-z-index="props.selectPanelZIndex"
                      :panel-placement="props.selectPanelPlacement"
                      size="sm"
                      trigger-class="min-w-0 w-full rounded-md border border-border bg-background px-2 py-1.5 text-left text-sm"
                      @update:model-value="
                        (value) =>
                          emit('setPlanItemWorkflow', {
                            item: props.selectedPlanItem!,
                            workflowTemplateId: String(value ?? ''),
                          })
                      "
                    />
                  </dd>
                </div>
                <div v-else class="bg-muted/35 rounded-xl border border-border/60 px-4 py-3">
                  <dt class="text-muted-foreground text-[11px] font-medium tracking-[0.08em]">
                    配置工作流
                  </dt>
                  <dd class="mt-2 break-words text-sm font-medium">
                    {{ props.workflowName || '未配置' }}
                  </dd>
                </div>
                <div class="bg-muted/35 rounded-xl border border-border/60 px-4 py-3">
                  <dt class="text-muted-foreground text-[11px] font-medium tracking-[0.08em]">
                    关联任务
                  </dt>
                  <dd class="mt-2 text-sm font-medium">
                    {{ props.selectedPlanItem.taskId ? '已关联任务' : '未关联' }}
                  </dd>
                  <Button
                    v-if="props.selectedPlanItem.taskId"
                    type="button"
                    variant="link"
                    size="sm"
                    class="text-muted-foreground mt-1 h-auto px-0 text-xs"
                    @click="
                      props.selectedPlanItem?.taskId && emit('goTask', props.selectedPlanItem.taskId)
                    "
                  >
                    查看任务
                  </Button>
                </div>
              </dl>
            </section>

            <section class="bg-background rounded-2xl border border-border/70 p-5 shadow-sm">
              <div class="mb-4">
                <h3 class="text-sm font-semibold">编辑内容</h3>
              </div>
              <div
                v-if="planItemReadonly"
                class="text-muted-foreground bg-muted/25 mb-4 rounded-xl border border-dashed border-border/70 px-4 py-3 text-sm"
              >
                当前子任务已非待确认状态，内容已锁定，不能再编辑。
              </div>
              <div class="space-y-4">
                <div class="space-y-2">
                  <label class="text-sm font-medium" for="goal-plan-item-summary">摘要</label>
                  <textarea
                    id="goal-plan-item-summary"
                    v-model="summaryModel"
                    rows="4"
                    :disabled="planItemReadonly"
                    class="border-input bg-muted/15 focus-visible:ring-ring focus-visible:border-ring w-full resize-y rounded-xl border px-3.5 py-3 text-sm leading-6 shadow-sm transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2"
                    :class="planItemReadonly ? 'cursor-not-allowed opacity-70' : ''"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-sm font-medium" for="goal-plan-item-acceptance">
                    验收标准
                  </label>
                  <textarea
                    id="goal-plan-item-acceptance"
                    v-model="acceptanceModel"
                    rows="6"
                    :disabled="planItemReadonly"
                    class="border-input bg-muted/15 focus-visible:ring-ring focus-visible:border-ring w-full resize-y rounded-xl border px-3.5 py-3 text-sm leading-6 shadow-sm transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2"
                    :class="planItemReadonly ? 'cursor-not-allowed opacity-70' : ''"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-sm font-medium" for="goal-plan-item-prompt">
                    建议提示词
                  </label>
                  <textarea
                    id="goal-plan-item-prompt"
                    v-model="suggestedPromptModel"
                    rows="6"
                    :disabled="planItemReadonly"
                    class="border-input bg-muted/15 focus-visible:ring-ring focus-visible:border-ring w-full resize-y rounded-xl border px-3.5 py-3 text-sm leading-6 shadow-sm transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2"
                    :class="planItemReadonly ? 'cursor-not-allowed opacity-70' : ''"
                  />
                </div>
              </div>
            </section>

            <section class="bg-background rounded-2xl border border-border/70 p-5 shadow-sm">
              <div class="mb-4">
                <h3 class="text-sm font-semibold">关联信息</h3>
              </div>
              <div
                v-if="props.dependencyTitles.length > 0"
                class="space-y-2"
              >
                <div
                  v-for="(title, idx) in props.dependencyTitles"
                  :key="idx"
                  class="bg-muted/35 flex items-start gap-3 rounded-xl border border-border/60 px-4 py-3"
                >
                  <span class="text-muted-foreground mt-0.5 text-xs tabular-nums">
                    {{ idx + 1 }}
                  </span>
                  <span class="min-w-0 flex-1 break-words leading-6">{{ title }}</span>
                </div>
              </div>
              <div
                v-else
                class="text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm"
              >
                无前置子任务依赖
              </div>
            </section>
          </div>
        </div>
        <SheetFooter
          v-if="!planItemReadonly"
          class="border-border bg-background/95 flex flex-row justify-end gap-2 border-t px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
          <Button
            type="button"
            variant="outline"
            :disabled="props.savingPlanItemText"
            @click="emit('reset')"
          >
            取消
          </Button>
          <Button type="button" :disabled="props.savingPlanItemText" @click="emit('confirm')">
            {{ props.savingPlanItemText ? '确认中…' : '确认' }}
          </Button>
        </SheetFooter>
      </template>
    </SheetContent>
  </Sheet>
</template>
