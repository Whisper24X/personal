<script setup lang="ts">
import { inject } from 'vue'
import BusinessLineFormModal from './modals/BusinessLineFormModal.vue'
import ConfirmActionModal from './modals/ConfirmActionModal.vue'
import MemberPermissionModal from './modals/MemberPermissionModal.vue'
import { CustomRoleModal } from '@features/access'
import ProjectFormModal from './modals/ProjectFormModal.vue'
import ProjectRuntimeSettingsModal from './modals/ProjectRuntimeSettingsModal.vue'
import DatabaseIsolationSettingsModal from './modals/DatabaseIsolationSettingsModal.vue'
import AgentToolConfigModal from './modals/AgentToolConfigModal.vue'
import SkillUploadModal from './modals/SkillUploadModal.vue'
import McpJsonImportModal from './modals/McpJsonImportModal.vue'
import { WorkflowTemplateEditorModal } from '@features/workflow'
import BlmSkillPreviewModal from './BlmSkillPreviewModal.vue'
import BlmMcpJsonPreviewModal from './BlmMcpJsonPreviewModal.vue'
import BlmProjectsTab from './tabs/BlmProjectsTab.vue'
import BlmMembersTab from './tabs/BlmMembersTab.vue'
import BlmPermissionsTab from './tabs/BlmPermissionsTab.vue'
import BlmAgentCliTab from './tabs/BlmAgentCliTab.vue'
import BlmWorkflowTab from './tabs/BlmWorkflowTab.vue'
import BlmSkillsTab from './tabs/BlmSkillsTab.vue'
import BlmMcpTab from './tabs/BlmMcpTab.vue'
import BlmLineSettingsTab from './tabs/BlmLineSettingsTab.vue'
import {
  businessLineManagementPanelInjectionKey,
  type BusinessLineManagementPanelContext,
} from './use-business-line-management-panel'
import { SUPPORTED_CLI_TOOLS } from './blm-agent-cli.constants'
import {
  formatBlmDate as formatDate,
  summarizeProjectRuntimeConfig,
} from './blmProjectDisplayUtils'
import {
  BUSINESS_LINE_CAPABILITY_DEPENDENCIES,
  BUSINESS_LINE_CAPABILITY_TREE,
  PROJECT_CAPABILITY_TREE,
} from '@shared/constants/access'

const vm = inject(businessLineManagementPanelInjectionKey) as BusinessLineManagementPanelContext
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col">
    <section
      :aria-modal="vm.isModalMode || undefined"
      :role="vm.isModalMode ? 'dialog' : 'region'"
      aria-labelledby="business-line-modal-title"
      class="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
    >
        <div class="grid min-h-0 flex-1 grid-cols-1 lg:h-full lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside
            class="flex min-h-0 flex-col border-b border-border bg-muted/30 lg:border-r lg:border-b-0"
          >
            <header class="flex h-16 items-center border-b border-border px-4">
              <h2 class="text-sm font-semibold">业务线</h2>
            </header>

            <div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              <button
                v-for="line in vm.props.lines"
                :key="line.id"
                type="button"
                class="w-full rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="
                  line.id === vm.activeLineId
                    ? 'border-primary/45 bg-primary/8 shadow-sm'
                    : 'border-border bg-background hover:bg-muted/40'
                "
                @click="vm.activeLineId = line.id"
              >
                <p class="text-sm font-semibold text-foreground">{{ line.name }}</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ line.description || '暂无描述' }}
                </p>
                <p class="mt-2 text-xs text-muted-foreground">项目 {{ line.projectCount }}</p>
              </button>

              <div
                v-if="vm.props.lines.length === 0"
                class="rounded-xl border border-dashed border-border bg-background/70 px-3 py-4 text-sm text-muted-foreground"
              >
                暂无业务线
              </div>
            </div>

            <footer v-if="vm.props.canCreateBusinessLine" class="border-t border-border p-3">
              <button
                type="button"
                class="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                @click="vm.openCreateLineModal"
              >
                创建业务线
              </button>
            </footer>
          </aside>

          <div class="flex min-h-0 flex-1 flex-col">
            <header class="flex h-16 items-center justify-between border-b border-border px-5">
              <div>
                <p class="text-xs font-semibold tracking-wide text-muted-foreground">业务线管理</p>
                <h2 id="business-line-modal-title" class="text-sm font-semibold">
                  {{ vm.selectedLineName }}
                </h2>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="!vm.isModalMode"
                  type="button"
                  aria-label="返回主页面"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
                  @click="vm.goToMainPage"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
                <button
                  v-if="vm.isModalMode"
                  type="button"
                  aria-label="关闭"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
                  @click="vm.closeModal"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </header>

            <div class="border-b border-border px-4 py-3">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tab in vm.availableMainTabs"
                  :key="tab.key"
                  class="rounded-xl px-4 py-2 text-sm font-semibold transition"
                  :class="vm.tabClass(tab.key)"
                  type="button"
                  @click="vm.activeTab = tab.key"
                >
                  {{ tab.label }}
                </button>
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto p-4">
              <section
                v-if="vm.activeLineId && vm.availableMainTabs.length === 0"
                class="panel-card rounded-2xl border border-dashed border-border bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground"
              >
                当前业务线暂无可访问功能。
              </section>

              <BlmProjectsTab
                v-if="vm.activeTab === 'projects'"
                v-model:project-query="vm.projectQuery"
                :active-line-id="vm.activeLineId"
                :loading-projects="vm.loadingProjects"
                :filtered-projects="vm.filteredProjects"
                :selected-project-id="vm.props.selectedProjectId"
                :can-view-project-list="vm.canViewProjectList"
                :can-create-project-item="vm.canCreateProjectItem"
                :can-update-project-item="vm.canUpdateProjectItem"
                :can-delete-project-item="vm.canDeleteProjectItem"
                :summarize-project-runtime="summarizeProjectRuntimeConfig"
                @refresh="vm.loadLineProjects(vm.activeLineId)"
                @create-project="vm.openCreateProjectModal"
                @select="vm.selectCurrentProject"
                @open-runtime="vm.openProjectRuntimeSettingsModal"
                @open-db-isolation="vm.openDbIsolationModal"
                @retry-provisioning="vm.retryProjectRepositoryProvisioning"
                @open-edit="vm.openEditProjectModal"
                @open-delete="vm.openProjectDeleteModal"
              />

              <BlmMembersTab
                v-else-if="vm.activeTab === 'members'"
                v-model:member-query="vm.memberQuery"
                :active-line-id="vm.activeLineId"
                :loading-members="vm.loadingMembers"
                :filtered-members="vm.filteredMembers"
                :can-view-member-list="vm.canViewMemberList"
                :can-invite-members="vm.canInviteMembers"
                :can-update-member-role="vm.canUpdateMemberRole"
                :can-remove-members="vm.canRemoveMembers"
                :display-user-label="vm.displayUserLabel"
                :display-user-meta="vm.displayUserMeta"
                :display-business-line-role-label="vm.displayBusinessLineRoleLabel"
                :format-date="formatDate"
                :role-badge-class="vm.roleBadgeClass"
                @refresh="vm.refreshMemberAccessSection"
                @invite-member="vm.openCreateMemberModal"
                @edit-member="vm.openEditMemberModal"
                @remove-member="vm.openRemoveMemberModal"
              />

              <BlmPermissionsTab
                v-else-if="vm.activeTab === 'permissions'"
                v-model:active-permission-role-tab="vm.activePermissionRoleTab"
                :active-line-id="vm.activeLineId"
                :loading-custom-roles="vm.loadingCustomRoles"
                :line-custom-roles="vm.lineCustomRoles"
                :can-view-business-line-role-list="vm.canViewBusinessLineRoleList"
                :can-create-business-line-role="vm.canCreateBusinessLineRole"
                :can-update-business-line-role="vm.canUpdateBusinessLineRole"
                :can-delete-business-line-role="vm.canDeleteBusinessLineRole"
                :deleting-custom-role-id="vm.deletingCustomRoleId"
                :loading-permission-project-role-library="vm.loadingPermissionProjectRoleLibrary"
                :permission-project-role-library="vm.permissionProjectRoleLibrary"
                :can-view-project-role-list="vm.canViewProjectRoleList"
                :can-create-project-role="vm.canCreatePermissionProjectRole"
                :can-update-project-role="vm.canUpdatePermissionProjectRole"
                :can-delete-project-role="vm.canDeletePermissionProjectRole"
                :can-manage-permission-project-roles="vm.canManagePermissionProjectRoles"
                :deleting-permission-project-role-id="vm.deletingPermissionProjectRoleId"
                @refresh-line-roles="vm.refreshLinePermissionSection()"
                @create-line-role="vm.openCreateCustomRoleModal"
                @edit-line-role="vm.openEditCustomRoleModal"
                @remove-line-role="vm.removeCustomRole"
                @refresh-project-roles="vm.activeLineId && vm.loadPermissionProjectCustomRoles(vm.activeLineId)"
                @create-project-role="vm.openCreatePermissionProjectRoleModal"
                @edit-project-role="vm.openEditPermissionProjectRoleModal"
                @remove-project-role="vm.removePermissionProjectRole"
              />

              <BlmAgentCliTab
                v-else-if="vm.activeTab === 'agent-cli'"
                v-model:active-agent-cli-tool-id="vm.activeAgentCliToolId"
                v-model:default-agent-cli-tool-draft="vm.defaultAgentCliToolDraft"
                :active-line-id="vm.activeLineId"
                :loading-agent-tool-configs="vm.loadingAgentToolConfigs"
                :agent-tool-configs="vm.agentToolConfigs"
                :active-agent-cli-tool-label="vm.activeAgentCliToolLabel"
                :default-agent-cli-tool-id="vm.currentDefaultAgentCliToolId"
                :default-agent-cli-tool-options="vm.defaultAgentCliToolOptions"
                :can-view-agent-tool-config-list="vm.canViewAgentToolConfigList"
                :can-create-agent-tool-config="vm.canCreateAgentToolConfig"
                :can-update-agent-tool-config="vm.canUpdateAgentToolConfig"
                :can-set-default-agent-tool-config="vm.canSetDefaultAgentToolConfig"
                :can-save-default-agent-cli-tool="vm.canSaveDefaultAgentCliTool"
                :can-delete-agent-tool-config="vm.canDeleteAgentToolConfig"
                :can-test-agent-tool-config="vm.canReadAgentToolConfigList"
                :submitting-agent-tool-config="vm.submittingAgentToolConfig"
                :saving-default-agent-cli-tool="vm.savingDefaultAgentCliTool"
                :deleting-agent-tool-config-id="vm.deletingAgentToolConfigId"
                :testing-agent-tool-config-id="vm.testingAgentToolConfigId"
                :supported-cli-tools="SUPPORTED_CLI_TOOLS"
                :format-date="formatDate"
                @refresh="vm.loadAgentToolConfigs(vm.activeLineId, vm.activeAgentCliToolId)"
                @save-default-tool="vm.saveDefaultAgentCliTool"
                @clear-default-tool="vm.clearDefaultAgentCliTool"
                @create-config="vm.openCreateAgentToolConfig"
                @edit-config="vm.openEditAgentToolConfig"
                @set-default="vm.setAgentToolConfigAsDefault"
                @remove-config="vm.removeAgentToolConfig"
                @test-config="vm.testAgentToolConfig"
              />

              <BlmWorkflowTab
                v-else-if="vm.activeTab === 'workflow'"
                :active-line-id="vm.activeLineId"
                :loading-workflow-templates="vm.loadingWorkflowTemplates"
                :workflow-templates="vm.workflowTemplates"
                :workflow-template-action-id="vm.workflowTemplateActionId"
                :can-view-workflow-template-list="vm.canViewWorkflowTemplateList"
                :can-create-workflow-template="vm.canCreateWorkflowTemplate"
                :can-update-workflow-template="vm.canUpdateWorkflowTemplate"
                :can-delete-workflow-template="vm.canDeleteWorkflowTemplate"
                @create-template="vm.openWorkflowCreateModal"
                @refresh="vm.loadWorkflowTemplates(vm.activeLineId)"
                @edit-template="vm.openWorkflowEditModal"
                @remove-template="vm.removeWorkflowTemplate"
              />

              <BlmSkillsTab
                v-else-if="vm.activeTab === 'skill'"
                v-model:skill-keyword="vm.skillKeyword"
                :active-line-id="vm.activeLineId"
                :loading-local-skills="vm.loadingLocalSkills"
                :local-skills="vm.localSkills"
                :can-view-skill-list="vm.canViewSkillList"
                :can-upload-local-skill="vm.canUploadLocalSkill"
                :uploading-local-skill="vm.uploadingLocalSkill"
                @refresh="vm.loadLocalSkills(vm.activeLineId)"
                @search="vm.loadLocalSkills(vm.activeLineId)"
                @open-upload="vm.openUploadSkillModal"
                @preview="vm.openSkillPreview"
              />

              <BlmMcpTab
                v-else-if="vm.activeTab === 'mcp'"
                :active-line-id="vm.activeLineId"
                :loading-local-mcps="vm.loadingLocalMcps"
                :local-mcps="vm.localMcps"
                :can-view-mcp-list="vm.canViewMcpList"
                :can-manage-local-mcp="vm.canManageLocalMcp"
                :importing-local-mcps="vm.importingLocalMcps"
                @refresh="vm.loadLocalMcps(vm.activeLineId)"
                @open-import="vm.openImportMcpJsonModal"
                @preview="vm.openMcpJsonPreview"
              />

              <BlmLineSettingsTab
                v-else
                :selected-line-name="vm.selectedLineName"
                :selected-line-description="vm.selectedLineDescription"
                :active-line-id="vm.activeLineId"
                :loading-line-detail="vm.loadingLineDetail"
                :can-manage-active-line="vm.canManageActiveLine"
                :can-delete-line="vm.canDeleteLine"
                @edit-line="vm.openEditLineModal"
                @delete-line="vm.openDeleteLineModal"
              />

            </div>
          </div>
        </div>
      </section>

      <WorkflowTemplateEditorModal
        v-if="vm.workflowCreateModalOpen"
        v-model:form="vm.workflowCreateForm"
        v-model:workflow-editor-active-node-index="vm.workflowEditorActiveNodeIndex"
        :open="vm.workflowCreateModalOpen"
        :title="vm.workflowTemplateModalTitle"
        title-id="business-line-workflow-create-modal-title"
        :template-info-hint="vm.workflowTemplateInfoHint"
        template-name-placeholder="例如：业务线默认代码修复流"
        :validation-message="vm.workflowValidationMessage"
        :loading-workflow-configured-cli-tools="vm.loadingWorkflowConfiguredCliTools"
        :workflow-configured-cli-tools="vm.workflowConfiguredCliTools"
        :workflow-cli-tool-select-options="vm.workflowCliToolSelectOptions"
        :submitting-workflow-template="vm.submittingWorkflowTemplate"
        :submit-disabled="!vm.activeLineId"
        :submit-loading-text="vm.workflowTemplateSubmitLoadingText"
        :submit-idle-text="vm.workflowTemplateSubmitIdleText"
        :get-workflow-node-config-select-options="vm.getWorkflowNodeConfigSelectOptions"
        :is-workflow-node-config-loading="vm.isWorkflowNodeConfigLoading"
        :format-workflow-node-tab-label="vm.formatWorkflowNodeTabLabel"
        :select-panel-z-index="vm.WORKFLOW_TEMPLATE_EDITOR_SELECT_PANEL_Z_INDEX"
        tab-key-prefix="blm-workflow-create-node-tab"
        @close="vm.closeWorkflowCreateModal"
        @submit="vm.submitWorkflowTemplate"
        @add-node="vm.addWorkflowCreateNode"
        @remove-node="vm.removeWorkflowCreateNode"
        @node-cli-change="void vm.handleWorkflowNodeCliToolChange($event)"
      />

      <BusinessLineFormModal
        :open="vm.lineFormModalOpen"
        :mode="vm.lineFormMode"
        size="large"
        :submitting="vm.lineFormSubmitting"
        :initial-name="vm.lineFormInitialName"
        :initial-description="vm.lineFormInitialDescription"
        :error-message="vm.lineFormError"
        @update:open="vm.lineFormModalOpen = $event"
        @submit="vm.submitLineForm"
      />

      <ProjectFormModal
        :open="vm.projectFormModalOpen"
        :mode="vm.projectFormMode"
        size="large"
        :business-line-id="vm.activeLineId"
        :submitting="vm.projectFormSubmitting"
        :initial-name="vm.projectFormInitialName"
        :initial-description="vm.projectFormInitialDescription"
        :initial-git-url="vm.projectFormInitialGitUrl"
        :initial-default-branch="vm.projectFormInitialDefaultBranch"
        :error-message="vm.projectFormError"
        @update:open="vm.projectFormModalOpen = $event"
        @submit="vm.submitProjectForm"
      />

      <ProjectRuntimeSettingsModal
        :open="vm.projectRuntimeSettingsModalOpen"
        :submitting="vm.projectRuntimeSettingsSubmitting"
        :project-name="vm.projectRuntimeSettingsProject?.name ?? ''"
        :project-git-url="vm.projectRuntimeSettingsProject?.gitUrl ?? ''"
        :initial-container-runtime="vm.projectRuntimeSettingsInitialContainerRuntime"
        :error-message="vm.projectRuntimeSettingsError"
        @update:open="vm.handleProjectRuntimeSettingsModalOpenChange"
        @submit="vm.submitProjectRuntimeSettings"
      />

      <DatabaseIsolationSettingsModal
        :open="vm.dbIsolationModalOpen"
        :submitting="vm.dbIsolationSubmitting"
        :project-id="vm.dbIsolationProject?.id ?? ''"
        :project-name="vm.dbIsolationProject?.name ?? ''"
        :initial-config-json="vm.dbIsolationInitialConfigJson"
        :error-message="vm.dbIsolationError"
        @update:open="vm.handleDbIsolationModalOpenChange"
        @submit="vm.submitDbIsolation"
      />

      <MemberPermissionModal
        :open="vm.memberPermissionModalOpen"
        :mode="vm.memberPermissionModalMode"
        size="large"
        :submitting="vm.memberPermissionModalSubmitting"
        :preparing="vm.memberPermissionModalPreparing"
        :users="vm.users"
        :projects="vm.lineProjects"
        :initial-user-id="vm.memberPermissionInitialUserId"
        :role-options="vm.businessLineRoleOptions"
        :initial-business-role="vm.memberPermissionInitialBusinessRole"
        :initial-project-roles="vm.memberPermissionInitialProjectRoles"
        :show-project-roles="vm.memberPermissionModalMode === 'edit'"
        :project-role-options="vm.memberPermissionProjectRoleOptions"
        :invite-link="vm.memberInvitationLink"
        :invite-expires-at="vm.memberInvitationExpiresAt"
        :error-message="vm.memberPermissionModalError"
        @update:open="vm.memberPermissionModalOpen = $event"
        @submit="vm.submitMemberPermission"
      />

      <CustomRoleModal
        :open="vm.customRoleModalOpen"
        :mode="vm.customRoleModalMode"
        size="large"
        scope-label="业务线"
        :submitting="vm.customRoleModalSubmitting"
        :capability-tree="BUSINESS_LINE_CAPABILITY_TREE"
        :capability-dependencies="BUSINESS_LINE_CAPABILITY_DEPENDENCIES"
        foundation-capability-code="businessLine.read"
        :initial-name="vm.customRoleInitialName"
        :initial-description="vm.customRoleInitialDescription"
        :initial-capabilities="vm.customRoleInitialCapabilities"
        :error-message="vm.customRoleModalError"
        @update:open="vm.customRoleModalOpen = $event"
        @submit="vm.submitCustomRole"
      />

      <CustomRoleModal
        :open="vm.permissionProjectRoleModalOpen"
        :mode="vm.permissionProjectRoleModalMode"
        size="large"
        scope-label="项目"
        :submitting="vm.permissionProjectRoleModalSubmitting"
        :capability-tree="PROJECT_CAPABILITY_TREE"
        :initial-name="vm.permissionProjectRoleInitialName"
        :initial-description="vm.permissionProjectRoleInitialDescription"
        :initial-capabilities="vm.permissionProjectRoleInitialCapabilities"
        :error-message="vm.permissionProjectRoleModalError"
        @update:open="vm.permissionProjectRoleModalOpen = $event"
        @submit="vm.submitPermissionProjectRole"
      />

      <AgentToolConfigModal
        :open="vm.agentToolConfigModalOpen"
        :mode="vm.agentToolConfigMode"
        size="large"
        :submitting="vm.submittingAgentToolConfig"
        :cli-tool-id="vm.activeAgentCliToolId"
        :cli-tool-label="vm.activeAgentCliToolLabel"
        :initial-name="vm.agentToolConfigForm.name"
        :initial-description="vm.agentToolConfigForm.description"
        :initial-is-default="vm.agentToolConfigForm.isDefault"
        :initial-config="vm.agentToolConfigForm.config"
        :error-message="vm.agentCliValidationMessage"
        @update:open="vm.agentToolConfigModalOpen = $event"
        @submit="vm.saveAgentToolConfig"
      />

      <SkillUploadModal
        :open="vm.uploadSkillModalOpen"
        size="large"
        :submitting="vm.uploadingLocalSkill"
        :error-message="vm.uploadSkillError"
        :show-target-selection="false"
        @update:open="vm.uploadSkillModalOpen = $event"
        @submit="vm.submitUploadSkill"
      />

      <McpJsonImportModal
        :open="vm.mcpJsonImportModalOpen"
        size="large"
        :submitting="vm.importingLocalMcps"
        :error-message="vm.mcpJsonImportError"
        @update:open="vm.mcpJsonImportModalOpen = $event"
        @submit="vm.submitImportMcpJson"
      />

      <BlmSkillPreviewModal
        v-if="vm.skillPreviewModalOpen"
        :title="vm.skillPreviewName"
        :path-subtitle="vm.skillPreviewSelectedPath"
        :item="vm.skillPreviewItem"
        :loading-tree="vm.loadingSkillPreview"
        :tree="vm.skillPreviewTree"
        :selected-path="vm.skillPreviewSelectedPath"
        :expanded-dirs="vm.skillPreviewExpandedDirs"
        :file-loading="vm.skillPreviewFileLoading"
        :content="vm.skillPreviewContent"
        :error="vm.skillPreviewError"
        :can-download-skill="vm.canViewSkillList"
        :can-remove-skill="vm.canDeleteLocalSkill"
        :downloading-local-skill-id="vm.downloadingLocalSkillId"
        :removing-local-skill-id="vm.removingLocalSkillId"
        @close="vm.closeSkillPreview"
        @download="vm.downloadLocalSkill"
        @remove="vm.removeLocalSkill"
        @select-file="vm.loadSkillPreviewFile(vm.skillPreviewId, $event)"
        @toggle-dir="vm.toggleSkillPreviewDir($event)"
      />

      <BlmMcpJsonPreviewModal
        v-if="vm.mcpJsonPreviewModalOpen"
        v-model="vm.mcpJsonPreviewDraft"
        :name="vm.mcpJsonPreviewName"
        :item="vm.mcpJsonPreviewItem"
        :loading="vm.loadingMcpJsonPreview"
        :saving="vm.savingMcpJsonPreview"
        :can-manage-local-mcp="vm.canManageLocalMcp"
        :removing-local-mcp-id="vm.removingLocalMcpId"
        :error="vm.mcpJsonPreviewError"
        @close="vm.closeMcpJsonPreview"
        @save="vm.saveMcpJsonPreview"
        @remove="vm.removeLocalMcp"
      />

      <ConfirmActionModal
        :open="vm.workflowTemplateDeleteModalOpen"
        :confirming="vm.workflowTemplateActionId === (vm.workflowTemplateDeleteTarget?.id ?? '')"
        title="删除工作流模板"
        :description="`确认删除模板「${vm.workflowTemplateDeleteTarget?.name ?? ''}」吗？`"
        confirm-text="删除"
        @update:open="vm.setWorkflowTemplateDeleteModalOpen"
        @confirm="vm.confirmRemoveWorkflowTemplate"
      />

      <ConfirmActionModal
        :open="vm.projectDeleteModalOpen"
        :confirming="vm.deletingProject"
        title="删除项目"
        :description="`确认删除项目「${vm.deletingProjectTarget?.name ?? ''}」吗？`"
        confirm-text="删除"
        @update:open="vm.projectDeleteModalOpen = $event"
        @confirm="vm.confirmDeleteProject"
      />

      <ConfirmActionModal
        :open="vm.memberRemoveModalOpen"
        :confirming="vm.removingMember"
        title="移除成员"
        :description="`确认移除成员「${vm.displayUserLabel(vm.removingMemberTarget?.userId ?? '')}」吗？`"
        confirm-text="移除"
        @update:open="vm.memberRemoveModalOpen = $event"
        @confirm="vm.confirmRemoveMember"
      />

      <ConfirmActionModal
        :open="vm.lineDeleteModalOpen"
        :confirming="false"
        title="删除业务线"
        :description="`确认删除业务线「${vm.selectedLineName}」吗？`"
        confirm-text="下一步"
        @update:open="vm.lineDeleteModalOpen = $event"
        @confirm="vm.confirmDeleteLine"
      />

        <ConfirmActionModal
        :open="vm.lineDeleteFinalModalOpen"
        :confirming="vm.deletingLine"
        title="再次确认删除"
        :description="`该操作不可恢复。请再次确认删除业务线「${vm.selectedLineName}」。`"
        confirm-text="确认删除"
        @update:open="vm.lineDeleteFinalModalOpen = $event"
        @confirm="vm.confirmDeleteLineFinal"
      />
  </div>
</template>
