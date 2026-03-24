<script setup lang="ts">
import { computed, provide } from 'vue'
import { useRoute } from 'vue-router'
import HeaderBar from '@/components/core/layouts/Header.vue'
import SideNav from '@/components/core/layouts/Sidebar.vue'
import SidebarRouteSync from '@/components/core/layouts/SidebarRouteSync.vue'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useLayout } from '@/hooks/core/useLayout'
import { layoutWorkspaceKey } from '@/keys/layout-workspace'
import { useUserStore } from '@/stores/modules/user'
import { useBrowserNotification } from '@/hooks/core/useBrowserNotification'

defineOptions({
  name: 'AppLayout',
})

useBrowserNotification()

const route = useRoute()
const userStore = useUserStore()
const useFullContentMode = computed(() => route.meta.contentMode === 'full')
const isBusinessLineManageActive = computed(() => route.name === 'business-lines-manage')
const isSettingsActive = computed(() => route.name === 'settings')

const userAvatarInitial = computed(() => {
  const name = userStore.profile?.name?.trim()
  if (!name) {
    return '?'
  }

  return name.slice(0, 1).toUpperCase()
})

const userDisplayName = computed(() => {
  const name = userStore.profile?.name?.trim()
  return name || '用户'
})

const {
  businessLineItems,
  activeBusinessLineId,
  selectedProjectId,
  currentBusinessLineName,
  hasSelectedProject,
  canCreateBusinessLine,
  projectItems,
  pageTitle,
  breadcrumbs,
  projectNavigationTo,
  isNavActive,
  workbenchNavTo,
  isWorkbenchNavActive,
  headerToolMenuItems,
  sidebarCoreTasksKnowledge,
  refreshLayoutData,
  openBusinessLineModal,
  selectBusinessLine,
  selectProject,
  hasAnyBusinessLine,
  layoutDataLoading,
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
    <a
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      href="#main-content"
    >
      跳到主内容
    </a>

    <SidebarProvider class="relative z-10 flex h-full min-h-0 w-full">
      <SidebarRouteSync />
      <SideNav
        :current-business-line-name="currentBusinessLineName"
        :selected-project-id="selectedProjectId"
        :project-items="projectItems"
        :has-selected-project="hasSelectedProject"
        :sidebar-core-tasks-knowledge="sidebarCoreTasksKnowledge"
        :project-navigation-to="projectNavigationTo"
        :is-nav-active="isNavActive"
        :workbench-nav-to="workbenchNavTo"
        :is-workbench-nav-active="isWorkbenchNavActive"
        :is-business-line-manage-active="isBusinessLineManageActive"
        :is-settings-active="isSettingsActive"
      />

      <SidebarInset
        class="app-surface flex h-[var(--app-viewport-height)] min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <HeaderBar
          :page-title="pageTitle"
          :breadcrumbs="breadcrumbs"
          :header-tool-menu-items="headerToolMenuItems"
          :has-selected-project="hasSelectedProject"
          :selected-project-id="selectedProjectId"
          :is-nav-active="isNavActive"
          :user-avatar-initial="userAvatarInitial"
          :user-display-name="userDisplayName"
        />

        <div id="main-content" class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div v-if="useFullContentMode" class="h-full min-h-0 w-full">
            <slot />
          </div>
          <div v-else class="container py-3 md:py-4">
            <slot />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>

  </div>
</template>
