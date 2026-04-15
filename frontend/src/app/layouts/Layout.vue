<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import HeaderBar from '@features/layout/components/Header.vue'
import SideNav from '@features/layout/components/Sidebar.vue'
import SidebarRouteSync from '@features/layout/components/SidebarRouteSync.vue'
import { SidebarInset, SidebarProvider } from '@shared/ui/sidebar'
import { useLayout } from '@features/layout/composables/useLayout'
import { layoutWorkspaceKey } from '@features/layout/model/workspace.context'
import { useUserStore } from '@app/stores/modules/user'
import { useBrowserNotification } from '@app/composables/useBrowserNotification'
import { gitApi } from '@/api/git'

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
  const profile = userStore.profile
  const label = profile?.name?.trim() || profile?.username?.trim()
  if (!label) {
    return '用'
  }

  return label.slice(0, 1).toUpperCase()
})

const userDisplayName = computed(() => {
  const profile = userStore.profile
  return profile?.name?.trim() || profile?.username?.trim() || '用户'
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

const gitSyncInfo = ref<{ branch: string; ahead: number; behind: number } | null>(null)

const refreshGitSyncInfo = async () => {
  const projectId = selectedProjectId.value
  if (!projectId) {
    gitSyncInfo.value = null
    return
  }
  try {
    const data = await gitApi.branchesDetail(projectId)
    const branch = data.branches.find(b => b.isCurrent)
      ?? data.branches.find(b => b.name === 'main' || b.name === 'master')
    if (branch && (branch.ahead > 0 || branch.behind > 0)) {
      gitSyncInfo.value = { branch: branch.name, ahead: branch.ahead, behind: branch.behind }
    } else {
      gitSyncInfo.value = null
    }
  } catch {
    // silent
  }
}

watch(selectedProjectId, refreshGitSyncInfo, { immediate: true })

const onGitSyncUpdated = () => void refreshGitSyncInfo()
window.addEventListener('git-sync-updated', onGitSyncUpdated)
onBeforeUnmount(() => window.removeEventListener('git-sync-updated', onGitSyncUpdated))

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
          :git-sync-info="gitSyncInfo"
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
