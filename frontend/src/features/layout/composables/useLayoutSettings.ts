import { computed, ref } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import {
  SETTINGS_QUERY_KEY,
  type SettingsSection,
  getAvailableSettingsSections,
  resolveAuthorizedSettingsSection,
} from '@shared/types/common/settings'
import { computeLayoutBreadcrumbs } from './layout-breadcrumbs'
import { normalizeQueryValue } from './use-layout-types'

export function useLayoutSettings(options: { route: RouteLocationNormalizedLoaded; router: Router }) {
  const { route, router } = options

  const settingsModalOpen = ref(false)
  const settingsSection = ref<SettingsSection>('account')

  const availableSettingsSections = computed<SettingsSection[]>(() => {
    return getAvailableSettingsSections()
  })

  const defaultSettingsSection = computed<SettingsSection>(() => {
    return availableSettingsSections.value[0] ?? 'account'
  })

  const resolveSettingsSection = (candidate: unknown) => {
    return resolveAuthorizedSettingsSection(normalizeQueryValue(candidate))
  }

  const routeSettingsSection = computed(() => {
    return normalizeQueryValue(route.query[SETTINGS_QUERY_KEY])
  })

  const pageTitle = computed(() => {
    if (routeSettingsSection.value) {
      return '设置'
    }

    return (route.meta.title as string | undefined) ?? '仪表盘'
  })

  const breadcrumbs = computed(() => {
    const rawSection = routeSettingsSection.value
    const section = rawSection ? resolveSettingsSection(rawSection) : null
    return computeLayoutBreadcrumbs(route, section, Boolean(rawSection))
  })

  const updateSettingsQuery = (section: SettingsSection) => {
    const currentSection = normalizeQueryValue(route.query[SETTINGS_QUERY_KEY])
    if (currentSection === section) {
      return
    }

    void router.replace({
      path: route.path,
      query: {
        ...route.query,
        [SETTINGS_QUERY_KEY]: section,
      },
    })
  }

  const openSettings = (section?: SettingsSection) => {
    settingsSection.value = resolveSettingsSection(section ?? route.query[SETTINGS_QUERY_KEY])
    settingsModalOpen.value = true
    updateSettingsQuery(settingsSection.value)
  }

  const closeSettings = () => {
    settingsModalOpen.value = false
    const nextQuery = { ...route.query }
    delete nextQuery[SETTINGS_QUERY_KEY]
    void router.replace({
      path: route.path,
      query: nextQuery,
    })
  }

  const setSettingsSection = (section: SettingsSection) => {
    const nextSection = resolveSettingsSection(section)
    settingsSection.value = nextSection
    settingsModalOpen.value = true
    updateSettingsQuery(nextSection)
  }

  return {
    settingsModalOpen,
    settingsSection,
    availableSettingsSections,
    defaultSettingsSection,
    resolveSettingsSection,
    routeSettingsSection,
    pageTitle,
    breadcrumbs,
    updateSettingsQuery,
    openSettings,
    closeSettings,
    setSettingsSection,
  }
}
