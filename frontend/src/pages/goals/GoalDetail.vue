<script setup lang="ts">
import GoalDetailHeader from '@features/goals/components/detail/GoalDetailHeader.vue'
import GoalDetailPlanPanel from '@features/goals/components/detail/GoalDetailPlanPanel.vue'
import GoalDetailPrdPanel from '@features/goals/components/detail/GoalDetailPrdPanel.vue'
import GoalDetailTabs from '@features/goals/components/detail/GoalDetailTabs.vue'
import GoalPlanItemSheet from '@features/goals/components/detail/GoalPlanItemSheet.vue'
import GoalPrdEditorSheet from '@features/goals/components/detail/GoalPrdEditorSheet.vue'
import { useGoalDetail } from '@features/goals/composables/useGoalDetail'
import { Loader2 } from 'lucide-vue-next'

defineOptions({
  name: 'GoalDetailView',
})

const {
  GOAL_SELECT_PANEL_PLACEMENT,
  GOAL_SELECT_PANEL_Z_INDEX,
  confirmPlanItemFromSheet,
  detail,
  generatingPlan,
  generatingPrd,
  goBack,
  goTaskFromSheet,
  goalHasPlanItems,
  goalHasPrd,
  loading,
  loadingWorkflowTemplates,
  materializeSingleSubTask,
  materializing,
  mergingPlanGroupId,
  markingBranchMergedId,
  markBranchMergedSubTask,
  mergePlanGroupIntoGoal,
  onPlanItemSheetOpen,
  onPrdEditorOpen,
  openPlanItemDetail,
  selectedPlanGroupTitle,
  openPrdEditor,
  planDependencyEdgeCount,
  planDepsGraphKey,
  planDepsHasCycle,
  planDepsMarkdown,
  planItemApproveBlockedReason,
  planItemDetailOpen,
  planItemEditAcceptance,
  planItemEditSuggestedPrompt,
  planItemEditSummary,
  planItemStatusLabel,
  planProgressDone,
  planProgressPercent,
  planProgressTotal,
  prdEditorContent,
  prdEditorLoading,
  prdEditorOpen,
  prdEditorSaving,
  prdPreviewContent,
  prdPreviewError,
  prdPreviewLoading,
  resetPlanItemTextDraft,
  runGeneratePlan,
  runGeneratePrd,
  savePrdEditor,
  savingPlanItemText,
  savingPlanItemWorkflowId,
  selectedPlanItem,
  selectedPlanItemDependencyTitles,
  selectedPlanItemWorkflowName,
  setPlanItemWorkflow,
  tab,
  workflowOptionsForPlanItem,
  workflowTemplates,
} = useGoalDetail()
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 p-4">
    <div
      v-if="loading"
      class="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-sm"
    >
      <template v-if="generatingPrd || generatingPlan">
        <Loader2 class="text-muted-foreground size-9 shrink-0 animate-spin" aria-hidden="true" />
        <p class="text-foreground text-center text-sm font-medium">
          {{ generatingPlan ? '正在生成任务计划…' : '正在生成 PRD…' }}
        </p>
        <p class="text-muted-foreground max-w-sm text-center text-xs">
          预计需要数十秒；刷新页面不会中断后台生成，本页会自动检测生成结果
        </p>
      </template>
      <template v-else>加载中…</template>
    </div>
    <template v-else-if="detail">
      <GoalDetailHeader
        :detail="detail"
        :goal-has-prd="goalHasPrd"
        :goal-has-plan-items="goalHasPlanItems"
        :generating-prd="generatingPrd"
        :generating-plan="generatingPlan"
        :plan-progress-done="planProgressDone"
        :plan-progress-total="planProgressTotal"
        :plan-progress-percent="planProgressPercent"
        :plan-dependency-edge-count="planDependencyEdgeCount"
        :plan-deps-has-cycle="planDepsHasCycle"
        :plan-deps-graph-key="planDepsGraphKey"
        :plan-deps-markdown="planDepsMarkdown"
        @back="goBack"
        @generate-prd="runGeneratePrd"
        @generate-plan="runGeneratePlan"
      />

      <GoalDetailTabs v-model="tab" />

      <GoalDetailPrdPanel
        v-if="tab === 'prd'"
        :generating-prd="generatingPrd"
        :prd-doc-path="detail.goal.prdDocPath"
        :prd-preview-loading="prdPreviewLoading"
        :prd-editor-saving="prdEditorSaving"
        :prd-preview-error="prdPreviewError"
        :prd-preview-content="prdPreviewContent"
        @edit="openPrdEditor"
      />

      <GoalDetailPlanPanel
        v-else-if="tab === 'plan'"
        :generating-plan="generatingPlan"
        :detail="detail"
        :loading-workflow-templates="loadingWorkflowTemplates"
        :workflow-templates="workflowTemplates"
        :merging-plan-group-id="mergingPlanGroupId"
        :materializing="materializing"
        :marking-branch-merged-id="markingBranchMergedId"
        :plan-item-status-label="planItemStatusLabel"
        :plan-item-approve-blocked-reason="planItemApproveBlockedReason"
        @open-plan-item-detail="(sub, title) => openPlanItemDetail(sub, title)"
        @materialize-plan-item="materializeSingleSubTask"
        @merge-plan-group-into-goal="mergePlanGroupIntoGoal"
        @mark-branch-merged="markBranchMergedSubTask"
      />

      <GoalPlanItemSheet
        :open="planItemDetailOpen"
        :selected-plan-group-title="selectedPlanGroupTitle"
        :selected-plan-item="selectedPlanItem"
        :plan-item-status-label="planItemStatusLabel"
        :plan-item-edit-summary="planItemEditSummary"
        :plan-item-edit-acceptance="planItemEditAcceptance"
        :plan-item-edit-suggested-prompt="planItemEditSuggestedPrompt"
        :dependency-titles="selectedPlanItemDependencyTitles"
        :workflow-name="selectedPlanItemWorkflowName"
        :loading-workflow-templates="loadingWorkflowTemplates"
        :workflow-templates="workflowTemplates"
        :workflow-options-for-plan-item="workflowOptionsForPlanItem"
        :saving-plan-item-workflow-id="savingPlanItemWorkflowId"
        :select-panel-z-index="GOAL_SELECT_PANEL_Z_INDEX"
        :select-panel-placement="GOAL_SELECT_PANEL_PLACEMENT"
        :saving-plan-item-text="savingPlanItemText"
        @update:open="onPlanItemSheetOpen"
        @update:plan-item-edit-summary="planItemEditSummary = $event"
        @update:plan-item-edit-acceptance="planItemEditAcceptance = $event"
        @update:plan-item-edit-suggested-prompt="planItemEditSuggestedPrompt = $event"
        @reset="resetPlanItemTextDraft"
        @confirm="confirmPlanItemFromSheet"
        @go-task="goTaskFromSheet"
        @set-plan-item-workflow="setPlanItemWorkflow($event.item, $event.workflowTemplateId)"
      />

      <GoalPrdEditorSheet
        :open="prdEditorOpen"
        :prd-editor-loading="prdEditorLoading"
        :prd-editor-saving="prdEditorSaving"
        :prd-editor-content="prdEditorContent"
        :project-id="detail.goal.projectId"
        :prd-doc-path="detail.goal.prdDocPath"
        @update:open="onPrdEditorOpen"
        @update:prd-editor-content="prdEditorContent = $event"
        @save="savePrdEditor"
      />
    </template>
  </div>
</template>
