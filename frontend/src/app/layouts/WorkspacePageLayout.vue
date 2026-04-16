<script setup lang="ts">
import { provide } from 'vue'
import { RouterView } from 'vue-router'
import { useBrowserNotification } from '@app/composables/useBrowserNotification'
import { useLayout } from '@features/layout/composables/useLayout'
import { layoutWorkspaceKey } from '@features/layout/model/workspace.context'

defineOptions({
  name: 'WorkspacePageLayout',
})

useBrowserNotification()

const {
  hasAnyBusinessLine,
  layoutDataLoading,
  canCreateBusinessLine,
  openBusinessLineModal,
  businessLineItems,
  activeBusinessLineId,
  selectedProjectId,
  selectBusinessLine,
  selectProject,
  refreshLayoutData,
  projectItems,
} = useLayout()

provide(layoutWorkspaceKey, {
  hasAnyBusinessLine,
  layoutDataLoading,
  canCreateBusinessLine,
  openBusinessLineModal,
  businessLineItems,
  activeBusinessLineId,
  selectedProjectId,
  selectBusinessLine,
  selectProject,
  refreshLayoutData,
  projectItems,
})
</script>

<template>
  <div
    class="relative h-[var(--app-viewport-height)] overflow-hidden bg-muted/35 text-foreground dark:bg-muted/15"
  >
    <div id="main-content" class="h-full min-h-0 overflow-hidden">
      <RouterView />
    </div>
  </div>
</template>
