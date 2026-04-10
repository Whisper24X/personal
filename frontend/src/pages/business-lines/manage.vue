<script setup lang="ts">
import { inject } from 'vue'
import BusinessLineManagementPanel from '@features/business-lines/BusinessLineManagementPanel.vue'
import { layoutWorkspaceKey } from '@features/layout/model/workspace.context'

defineOptions({
  name: 'BusinessLineManageView',
})

const workspace = inject(layoutWorkspaceKey, null)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <BusinessLineManagementPanel
      v-if="workspace"
      mode="page"
      :lines="workspace.businessLineItems.value"
      :projects="workspace.projectItems.value"
      :active-business-line-id="workspace.activeBusinessLineId.value"
      :selected-project-id="workspace.selectedProjectId.value"
      :can-create-business-line="workspace.canCreateBusinessLine.value"
      @select-line="workspace.selectBusinessLine"
      @select-project="workspace.selectProject"
      @request-refresh="workspace.refreshLayoutData"
    />
  </div>
</template>
