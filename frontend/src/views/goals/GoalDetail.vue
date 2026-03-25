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
  approveItem,
  branchOptionsForPlanItem,
  detail,
  generatingPlan,
  generatingPrd,
  goBack,
  goTaskFromSheet,
  goalHasPlanItems,
  goalHasPrd,
  loading,
  loadingBranches,
  loadingWorkflowTemplates,
  materializeSelected,
  materializing,
  onPlanItemSheetOpen,
  onPrdEditorOpen,
  openPlanItemDetail,
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
  savePlanItemText,
  savePrdEditor,
  savingPlanItemGitBaseBranchId,
  savingPlanItemText,
  savingPlanItemWorkflowId,
  selectedPlanItem,
  selectedPlanItemDependencyTitles,
  selectedPlanItemWorkflowName,
  setPlanItemGitBaseBranch,
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
        :materializing="materializing"
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
        @materialize-selected="materializeSelected"
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
        :loading-branches="loadingBranches"
        :saving-plan-item-workflow-id="savingPlanItemWorkflowId"
        :saving-plan-item-git-base-branch-id="savingPlanItemGitBaseBranchId"
        :plan-item-status-label="planItemStatusLabel"
        :workflow-options-for-plan-item="workflowOptionsForPlanItem"
        :branch-options-for-plan-item="branchOptionsForPlanItem"
        :plan-item-approve-blocked-reason="planItemApproveBlockedReason"
        :select-panel-z-index="GOAL_SELECT_PANEL_Z_INDEX"
        :select-panel-placement="GOAL_SELECT_PANEL_PLACEMENT"
        @open-plan-item-detail="openPlanItemDetail"
        @set-plan-item-workflow="setPlanItemWorkflow($event.item, $event.workflowTemplateId)"
        @set-plan-item-git-base-branch="setPlanItemGitBaseBranch($event.item, $event.gitBaseBranch)"
        @approve-item="approveItem"
      />

      <GoalPlanItemSheet
        :open="planItemDetailOpen"
        :selected-plan-item="selectedPlanItem"
        :plan-item-status-label="planItemStatusLabel"
        :plan-item-edit-summary="planItemEditSummary"
        :plan-item-edit-acceptance="planItemEditAcceptance"
        :plan-item-edit-suggested-prompt="planItemEditSuggestedPrompt"
        :dependency-titles="selectedPlanItemDependencyTitles"
        :workflow-name="selectedPlanItemWorkflowName"
        :saving-plan-item-text="savingPlanItemText"
        @update:open="onPlanItemSheetOpen"
        @update:plan-item-edit-summary="planItemEditSummary = $event"
        @update:plan-item-edit-acceptance="planItemEditAcceptance = $event"
        @update:plan-item-edit-suggested-prompt="planItemEditSuggestedPrompt = $event"
        @reset="resetPlanItemTextDraft"
        @save="savePlanItemText"
        @go-task="goTaskFromSheet"
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
