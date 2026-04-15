<script setup lang="ts">
import { toRef } from 'vue'
import { RouterLink } from 'vue-router'
import ExecutionPanel from '@features/tasks/detail/ExecutionPanel.vue'
import ReplyCard from '@features/tasks/detail/ReplyCard.vue'
import ReviewCard from '@features/tasks/detail/ReviewCard.vue'
import RightPanelSection from '@features/tasks/detail/RightPanelSection.vue'
import TaskDialogs from '@features/tasks/detail/TaskDialogs.vue'
import TaskEnvironmentGate from '@features/tasks/detail/TaskEnvironmentGate.vue'
import TaskExecutionContextBar from '@features/tasks/detail/TaskExecutionContextBar.vue'
import WorkflowCard from '@features/tasks/detail/WorkflowCard.vue'
import { nodeStatusLabelMap } from '@features/tasks/task-detail-ui.constants'
import { useTaskDetailPage } from './use-task-detail-page'

defineOptions({
  name: 'TaskDetailPage',
})

const vm = useTaskDetailPage()
/** Nested refs inside `reactive()` unwrap on access — use `toRef` for template refs. */
const containerRef = toRef(vm, 'containerRef')
const workflowCardRef = toRef(vm, 'workflowCardRef')
</script>

<template>
  <div class="fade-up flex h-full min-h-0 w-full">
    <TaskEnvironmentGate
      v-if="!vm.pageLoading && vm.shouldShowEnvironmentGate && vm.task"
      :title="vm.task.title"
      :environment="vm.environment"
      :action-loading="vm.actionLoading"
      :can-start="vm.canStartEnvironment"
      :can-remove="vm.canRemove"
      :remove-loading="vm.removingTask"
      :format-date="vm.formatDate"
      @start="vm.startEnvironment"
      @refresh="vm.loadInitialTaskData"
      @remove="vm.deleteOpen = true"
    />

    <section
      v-else-if="!vm.pageLoading"
      ref="containerRef"
      class="flex h-full w-full min-w-0 overflow-hidden"
    >
      <div
        class="bg-background flex min-w-0 flex-col overflow-hidden"
        :class="{ 'transition-all duration-200': !vm.isDragging }"
        :style="{
          flex: vm.isRightPanelVisible ? '0 0 auto' : '1 1 0%',
          width: vm.isRightPanelVisible ? `${vm.leftPanelWidth}%` : undefined,
          minWidth: vm.isRightPanelVisible ? '0' : '0',
          maxWidth: vm.isRightPanelVisible ? `${vm.leftPanelWidth}%` : undefined,
        }"
      >
        <div class="flex min-h-0 w-full flex-1 flex-col gap-2">
          <div
            v-if="vm.detail?.goalSummary"
            class="border-border/60 bg-muted/30 text-foreground flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2 text-xs"
          >
            <span class="text-muted-foreground">所属需求</span>
            <RouterLink
              :to="{ name: 'goal-detail', params: { goalId: vm.detail.goalSummary.id } }"
              class="text-primary font-medium hover:underline"
            >
              {{ vm.detail.goalSummary.title }}
            </RouterLink>
            <span class="text-muted-foreground">（{{ vm.detail.goalSummary.status }}）</span>
          </div>

          <div class="flex min-h-0 w-full flex-1 flex-col">
            <WorkflowCard
              v-if="vm.showWorkflowCard"
              ref="workflowCardRef"
              :nodes="vm.sortedNodes"
              :selected-node-id="vm.selectedWorkflowNodeId"
              @select-node="vm.handleSelectWorkflowNode"
            />

            <ReviewCard
              v-if="vm.showReviewCard"
              :node="vm.currentActionNode"
              :status-label-map="nodeStatusLabelMap"
              :can-manage-review="vm.canManageReview"
              @approve-node="vm.approveNode"
            />

            <TaskExecutionContextBar
              v-if="vm.task"
              :mode="vm.task.mode"
              :status="vm.task.status"
              :status-label="vm.taskStatusLabel"
              :status-class="vm.taskStatusClass"
              :mode-label="vm.taskModeLabel"
              :subtitle="vm.contextSubtitle"
              :environment-status="vm.environment?.status || null"
              :environment-status-label="vm.environmentStatusLabel"
              :environment-status-class="vm.environmentStatusClass"
              :environment-stage-label="vm.environment?.stageLabel || ''"
              :action-loading="vm.actionLoading"
              :can-start-environment="vm.canStartEnvironment"
              :can-execute="vm.canExecute"
              :can-complete-task="vm.canCompleteTask"
              :can-reset="vm.canResetSelectedWorkflowNode"
              :can-terminate="vm.canTerminateEnvironment"
              :can-remove="vm.canRemove"
              :right-panel-visible="vm.isRightPanelVisible"
              @start-environment="vm.startEnvironment"
              @execute="vm.executeTask"
              @complete-task="vm.completeTask"
              @reset="vm.resetSelectedWorkflowNode"
              @terminate="vm.terminateEnvironment"
              @refresh="vm.loadInitialTaskData"
              @remove="vm.deleteOpen = true"
              @toggle-right-panel="vm.isRightPanelVisible = !vm.isRightPanelVisible"
            />

            <ExecutionPanel
              :title="vm.executionPanelTitle"
              :loading="vm.pageLoading"
              :agent-cli-id="vm.executionCliId"
              :task-status="vm.task?.status || null"
              :task-status-label="vm.taskStatusLabel"
              :task-status-class="vm.taskStatusClass"
              :stream-connected="vm.streamConnected"
              :messages="vm.executionMessages"
              :format-date="vm.formatDate"
            />

            <ReplyCard
              :disabled="vm.replyDisabled"
              :placeholder="vm.replyPlaceholder"
              :running="vm.isCliRunning"
              :action-loading="vm.actionLoading"
              :can-interrupt="vm.canInterruptExecution"
              @submit="vm.handleReply"
              @interrupt="vm.interruptExecution"
            />
          </div>
        </div>
      </div>

      <div
        v-if="vm.isRightPanelVisible"
        class="group relative h-full w-1.5 min-w-1.5 shrink-0 cursor-col-resize"
        @mousedown.prevent="vm.startDrag"
      >
        <div
          class="bg-border/50 pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors group-hover:bg-primary/50"
          :class="{ 'bg-primary/50': vm.isDragging }"
        />
      </div>

      <RightPanelSection
        v-if="vm.isRightPanelVisible"
        :task-id="vm.taskId"
        :project-id="vm.activeProjectId"
        :branch-name="vm.task?.gitBranch || null"
        :base-branch="vm.task?.gitBaseBranch || null"
        :refresh-token="vm.rightPanelRefreshToken"
        :artifact-refresh-paths="vm.rightPanelArtifactRefreshPaths"
        :logs="vm.logs"
        default-right-tab="artifacts"
        :environment-status="vm.environment?.status || null"
        :environment-preview="vm.environment?.preview || null"
        :format-date="vm.formatDate"
        :artifact-file-path="vm.artifactFilePath"
        :artifact-open-nonce="vm.artifactOpenNonce"
        :artifact-node-id="vm.selectedWorkflowNodeId"
      />
    </section>

    <TaskDialogs
      v-model:edit-open="vm.editOpen"
      v-model:delete-open="vm.deleteOpen"
      :saving="vm.savingEdit"
      :removing="vm.removingTask"
      :edit-form="vm.editForm"
      @save="vm.saveEdit"
      @remove="vm.removeTask"
    />

    <Teleport to="body">
      <div
        v-if="vm.pageLoading"
        class="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-7 bg-black/5 backdrop-blur-md transition-opacity duration-300"
        role="status"
        aria-live="polite"
      >
        <svg
          class="size-9 animate-spin text-muted-foreground/50"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.15" />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <p class="text-sm font-medium text-muted-foreground">正在加载任务</p>
      </div>
    </Teleport>
  </div>
</template>
