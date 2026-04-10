<script setup lang="ts">
import { WorkflowTemplateEditorModal } from '@features/workflow'

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailWorkflowCreateModal' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
  <WorkflowTemplateEditorModal
    v-model:form="ctx.workflowCreateForm"
    v-model:workflow-editor-active-node-index="ctx.workflowEditorActiveNodeIndex"
    :open="ctx.workflowCreateModalOpen"
    :title="ctx.workflowTemplateModalTitle"
    title-id="project-workflow-create-modal-title"
    :validation-message="ctx.workflowValidationMessage"
    :loading-workflow-configured-cli-tools="ctx.loadingWorkflowConfiguredCliTools"
    :workflow-configured-cli-tools="ctx.workflowConfiguredCliTools"
    :workflow-cli-tool-select-options="ctx.workflowCliToolSelectOptions"
    :submitting-workflow-template="ctx.submittingWorkflowTemplate"
    :submit-disabled="!ctx.projectId"
    :submit-loading-text="ctx.workflowTemplateSubmitLoadingText"
    :submit-idle-text="ctx.workflowTemplateSubmitIdleText"
    :get-workflow-node-config-select-options="ctx.getWorkflowNodeConfigSelectOptions"
    :is-workflow-node-config-loading="ctx.isWorkflowNodeConfigLoading"
    :format-workflow-node-tab-label="ctx.formatWorkflowNodeTabLabel"
    :select-panel-z-index="ctx.PROJECT_WORKFLOW_SELECT_PANEL_Z_INDEX"
    tab-key-prefix="project-workflow-create-node-tab"
    @close="ctx.closeWorkflowCreateModal"
    @submit="ctx.submitWorkflowTemplate"
    @add-node="ctx.addWorkflowCreateNode"
    @remove-node="ctx.removeWorkflowCreateNode"
    @node-cli-change="void ctx.handleWorkflowNodeCliToolChange($event)"
  />
</template>
