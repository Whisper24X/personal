import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAccessStore } from '@app/stores/modules/access'
import { useUserStore } from '@app/stores/modules/user'
import { SETTINGS_QUERY_KEY } from '@shared/types/common/settings'
import { applyStoredUiPreferences } from '@shared/utils/ui-preferences'
import { useLayoutSettings } from './useLayoutSettings'
import { useLayoutSidebarNav } from './useLayoutSidebarNav'
import { useLayoutWorkspace } from './useLayoutWorkspace'
import type { BusinessLine } from './use-layout-types'
import {
  loadStoredSelectedProjectId,
  normalizeQueryValue,
  persistActiveBusinessLineId,
} from './use-layout-types'

export type { BusinessLineItem, MenuItem, ProjectItem } from './use-layout-types'

export const useLayout = () => {
  const route = useRoute()
  const router = useRouter()
  const accessStore = useAccessStore()
  const userStore = useUserStore()

  const businessLines = ref<BusinessLine[]>([])
  const activeBusinessLineId = ref('')
  const selectedProjectId = ref(loadStoredSelectedProjectId())
  const layoutDataLoading = ref(false)

  const nav = useLayoutSidebarNav({
    route,
    router,
    accessStore,
    businessLines,
    activeBusinessLineId,
    selectedProjectId,
  })

  const workspace = useLayoutWorkspace({
    route,
    router,
    accessStore,
    userStore,
    businessLines,
    activeBusinessLineId,
    selectedProjectId,
    layoutDataLoading,
    ensureAccessibleRoute: nav.ensureAccessibleRoute,
    buildProjectNavigationTarget: nav.buildProjectNavigationTarget,
    resolveProjectMenuPath: nav.resolveProjectMenuPath,
    setSelectedMenuPath: nav.setSelectedMenuPath,
  })

  const settings = useLayoutSettings({ route, router })

  watch(
    () => route.fullPath,
    () => {
      nav.syncSelectedMenuPath()
      workspace.syncBusinessLineFromRoute()
      workspace.syncProjectSelection()
      void workspace.refreshAccessContext()
    },
  )

  watch(
    () =>
      [
        route.path,
        route.query.projectId,
        selectedProjectId.value,
        nav.menuItems.value.map((item) => item.to).join('|'),
      ] as const,
    ([path, queryProjectId, selected]) => {
      const routeMenuPath = nav.resolveMenuPathFromRoute()
      if (!routeMenuPath) {
        return
      }

      if (!selected) {
        return
      }

      const normalizedQueryProjectId = normalizeQueryValue(queryProjectId).trim()
      if (normalizedQueryProjectId === selected) {
        return
      }

      void router.replace({
        path,
        query: {
          ...route.query,
          projectId: selected,
        },
      })
    },
    { immediate: true },
  )

  watch(
    () => [userStore.isLogin, activeBusinessLineId.value, selectedProjectId.value] as const,
    () => {
      void workspace.refreshAccessContext()
    },
  )

  watch(
    () => route.query[SETTINGS_QUERY_KEY],
    (sectionQuery) => {
      const sectionName = normalizeQueryValue(sectionQuery)
      if (!sectionName) {
        settings.settingsModalOpen.value = false
        return
      }

      const nextSection = settings.resolveSettingsSection(sectionName)
      settings.settingsSection.value = nextSection
      settings.settingsModalOpen.value = true

      if (nextSection !== sectionName) {
        settings.updateSettingsQuery(nextSection)
      }
    },
    { immediate: true },
  )

  watch(settings.defaultSettingsSection, (nextSection) => {
    if (!settings.availableSettingsSections.value.includes(settings.settingsSection.value)) {
      settings.settingsSection.value = nextSection
    }
  })

  watch(activeBusinessLineId, (id) => {
    persistActiveBusinessLineId(id)
  })

  onMounted(() => {
    applyStoredUiPreferences()

    nav.syncSelectedMenuPath()
    void workspace.refreshLayoutData()
  })

  return {
    settingsModalOpen: settings.settingsModalOpen,
    settingsSection: settings.settingsSection,
    availableSettingsSections: settings.availableSettingsSections,
    businessLineItems: workspace.businessLineItems,
    activeBusinessLineId,
    selectedProjectId,
    currentProjectName: workspace.currentProjectName,
    hasSelectedProject: workspace.hasSelectedProject,
    showCurrentProjectName: workspace.showCurrentProjectName,
    currentBusinessLineName: workspace.currentBusinessLineName,
    canCreateBusinessLine: nav.canCreateBusinessLine,
    canCreateProject: nav.canCreateProject,
    projectItems: workspace.projectItems,
    menuItems: nav.menuItems,
    pageTitle: settings.pageTitle,
    breadcrumbs: settings.breadcrumbs,
    menuItemClass: nav.menuItemClass,
    projectNavigationTo: nav.projectNavigationTo,
    menuIconFor: nav.menuIconFor,
    isRouteActive: nav.isRouteActive,
    isNavActive: nav.isNavActive,
    workbenchNavTo: nav.workbenchNavTo,
    isWorkbenchNavActive: nav.isWorkbenchNavActive,
    headerToolMenuItems: nav.headerToolMenuItems,
    sidebarCoreTasksKnowledge: nav.sidebarCoreTasksKnowledge,
    refreshLayoutData: workspace.refreshLayoutData,
    openBusinessLineModal: workspace.openBusinessLineModal,
    openSettings: settings.openSettings,
    closeSettings: settings.closeSettings,
    setSettingsSection: settings.setSettingsSection,
    selectBusinessLine: workspace.selectBusinessLine,
    selectProject: workspace.selectProject,
    hasAnyBusinessLine: workspace.hasAnyBusinessLine,
    layoutDataLoading,
  }
}
