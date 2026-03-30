<script setup lang="ts">
import GoalDetailHeader from '@/components/goals/detail/GoalDetailHeader.vue'
import GoalDetailPlanPanel from '@/components/goals/detail/GoalDetailPlanPanel.vue'
import GoalDetailPrdPanel from '@/components/goals/detail/GoalDetailPrdPanel.vue'
import GoalDetailTabs from '@/components/goals/detail/GoalDetailTabs.vue'
import GoalPlanItemSheet from '@/components/goals/detail/GoalPlanItemSheet.vue'
import GoalPrdEditorSheet from '@/components/goals/detail/GoalPrdEditorSheet.vue'
import { useGoalDetail } from '@/hooks'

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
  creatingPrGroupId,
  onCreateGroupPr,
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
    <div v-if="loading" class="text-muted-foreground flex flex-1 items-center justify-center text-sm">
      加载中...
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
        :prd-doc-path="detail.goal.prdDocPath"
        :prd-preview-loading="prdPreviewLoading"
        :prd-editor-saving="prdEditorSaving"
        :prd-preview-error="prdPreviewError"
        :prd-preview-content="prdPreviewContent"
        @edit="openPrdEditor"
      />

      <GoalDetailPlanPanel
        v-else-if="tab === 'plan'"
        :detail="detail"
        :loading-workflow-templates="loadingWorkflowTemplates"
        :workflow-templates="workflowTemplates"
        :creating-pr-group-id="creatingPrGroupId"
        :materializing="materializing"
        :plan-item-status-label="planItemStatusLabel"
        :plan-item-approve-blocked-reason="planItemApproveBlockedReason"
        @open-plan-item-detail="(sub, title) => openPlanItemDetail(sub, title)"
        @materialize-plan-item="materializeSingleSubTask"
        @create-group-pr="onCreateGroupPr"
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
        @update:open="onPrdEditorOpen"
        @update:prd-editor-content="prdEditorContent = $event"
        @save="savePrdEditor"
      />
    </template>
  </div>
</template>
