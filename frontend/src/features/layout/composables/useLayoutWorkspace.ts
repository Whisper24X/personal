import { computed, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteLocationRaw, Router } from 'vue-router'
import { businessLinesApi } from '@/api/business-lines'
import { projectsApi } from '@/api/projects'
import { useAccessStore } from '@app/stores/modules/access'
import { useUserStore } from '@app/stores/modules/user'
import type { Project } from '@/types/api/projects'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { fetchAllPages } from '@shared/utils/pagination'
import { getProjectIdFromRoute } from './layout-project-route'
import type { BusinessLine, BusinessLineItem, ProjectItem } from './use-layout-types'
import { loadStoredActiveBusinessLineId, normalizeQueryValue } from './use-layout-types'

type AccessStore = ReturnType<typeof useAccessStore>
type UserStore = ReturnType<typeof useUserStore>

export function useLayoutWorkspace(options: {
  route: RouteLocationNormalizedLoaded
  router: Router
  accessStore: AccessStore
  userStore: UserStore
  businessLines: Ref<BusinessLine[]>
  activeBusinessLineId: Ref<string>
  selectedProjectId: Ref<string>
  layoutDataLoading: Ref<boolean>
  ensureAccessibleRoute: (projectId?: string) => Promise<void>
  buildProjectNavigationTarget: (projectId: string, menuPath: string) => RouteLocationRaw
  resolveProjectMenuPath: () => string
  setSelectedMenuPath: (menuPath: string) => void
}) {
  const {
    route,
    router,
    accessStore,
    userStore,
    businessLines,
    activeBusinessLineId,
    selectedProjectId,
    layoutDataLoading,
    ensureAccessibleRoute,
    buildProjectNavigationTarget,
    resolveProjectMenuPath,
    setSelectedMenuPath,
  } = options

  const setSelectedProjectId = (projectId: string) => {
    selectedProjectId.value = projectId

    if (projectId) {
      localStorage.setItem(STORAGE_KEYS.lastSelectedProjectId, projectId)
      return
    }

    localStorage.removeItem(STORAGE_KEYS.lastSelectedProjectId)
  }

  const mapProjectItem = (project: Project): ProjectItem => ({
    id: project.id,
    name: project.name,
    to: `/dashboard?projectId=${encodeURIComponent(project.id)}`,
    businessLineId: project.businessLineId,
    description: project.description ?? null,
    gitUrl: project.gitUrl,
    defaultBranch: project.defaultBranch,
    configJson: project.configJson ?? null,
  })

  const findBusinessLineByProjectId = (projectId: string) => {
    return businessLines.value.find((line) => line.projects.some((project) => project.id === projectId))
  }

  const syncProjectSelection = ({ preserveCurrentBusinessLine = false }: { preserveCurrentBusinessLine?: boolean } = {}) => {
    const routeProjectId = getProjectIdFromRoute(route)
    if (routeProjectId) {
      const matchedBusinessLine = findBusinessLineByProjectId(routeProjectId)
      if (matchedBusinessLine) {
        setSelectedProjectId(routeProjectId)
        activeBusinessLineId.value = matchedBusinessLine.id
        return
      }

      const hasStoredSelectedProject = selectedProjectId.value
        ? findBusinessLineByProjectId(selectedProjectId.value)
        : undefined

      const fallbackProjectId = hasStoredSelectedProject ? selectedProjectId.value : ''

      setSelectedProjectId(fallbackProjectId)

      if (fallbackProjectId) {
        const fallbackBusinessLine = findBusinessLineByProjectId(fallbackProjectId)
        if (fallbackBusinessLine) {
          activeBusinessLineId.value = fallbackBusinessLine.id
        }
      } else {
        const firstLine = businessLines.value[0]
        activeBusinessLineId.value = firstLine?.id ?? ''
        if (firstLine?.projects?.length) {
          setSelectedProjectId(firstLine.projects[0]!.id)
        } else {
          setSelectedProjectId('')
        }
      }

      return
    }

    const currentProjects = currentBusinessLine.value?.projects ?? []
    const hasSelectedProject = currentProjects.some((project) => project.id === selectedProjectId.value)
    if (hasSelectedProject) {
      return
    }

    const selectedProjectBusinessLine = selectedProjectId.value
      ? businessLines.value.find((line) => line.projects.some((project) => project.id === selectedProjectId.value))
      : undefined
    if (selectedProjectBusinessLine && !preserveCurrentBusinessLine) {
      activeBusinessLineId.value = selectedProjectBusinessLine.id
      return
    }

    if (currentProjects.length > 0) {
      setSelectedProjectId(currentProjects[0]!.id)
    } else {
      setSelectedProjectId('')
    }
  }

  const syncBusinessLineFromRoute = () => {
    const projectId = getProjectIdFromRoute(route)
    if (!projectId) return

    const matchedBusinessLine = findBusinessLineByProjectId(projectId)
    if (!matchedBusinessLine) return

    activeBusinessLineId.value = matchedBusinessLine.id
  }

  const loadLayoutData = async () => {
    layoutDataLoading.value = true

    try {
      const access = await accessStore.loadContext(undefined, { force: true })
      const visibleBusinessLineIdSet = new Set(access?.visibility.visibleBusinessLineIds ?? [])
      const visibleProjectIdSet = new Set(access?.visibility.visibleProjectIds ?? [])

      const [businessLineResponse, projectResponse] = await Promise.all([
        visibleBusinessLineIdSet.size > 0
          ? fetchAllPages((page, limit) => businessLinesApi.list({ page, limit }))
          : Promise.resolve([]),
        visibleProjectIdSet.size > 0
          ? fetchAllPages((page, limit) => projectsApi.list({ page, limit }))
          : Promise.resolve([]),
      ])

      const lineMap = new Map<string, BusinessLine>()

      for (const line of businessLineResponse) {
        if (!visibleBusinessLineIdSet.has(line.id)) {
          continue
        }

        lineMap.set(line.id, {
          id: line.id,
          name: line.name,
          description: line.description ?? null,
          owner: '-',
          projects: [],
        })
      }

      for (const project of projectResponse) {
        if (!visibleProjectIdSet.has(project.id)) {
          continue
        }

        const line = lineMap.get(project.businessLineId)
        if (!line) {
          continue
        }

        line.projects.push(mapProjectItem(project))
      }

      const nextBusinessLines = Array.from(lineMap.values())
        .map((line) => ({
          ...line,
          projects: [...line.projects].sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name))

      businessLines.value = nextBusinessLines

      const routeProjectId = getProjectIdFromRoute(route)
      const routeMatchedBusinessLine = routeProjectId
        ? nextBusinessLines.find((line) => line.projects.some((project) => project.id === routeProjectId))
        : undefined

      if (routeMatchedBusinessLine) {
        activeBusinessLineId.value = routeMatchedBusinessLine.id
      } else {
        const storedId = loadStoredActiveBusinessLineId()
        const storedValid = storedId && nextBusinessLines.some((line) => line.id === storedId)
        if (storedValid) {
          activeBusinessLineId.value = storedId
        } else if (nextBusinessLines.length === 1) {
          activeBusinessLineId.value = nextBusinessLines[0]!.id
        } else if (nextBusinessLines.length > 1) {
          activeBusinessLineId.value = ''
        } else {
          activeBusinessLineId.value = ''
        }
      }

      syncProjectSelection()
      await refreshAccessContext()
    } catch (error) {
      businessLines.value = []
      activeBusinessLineId.value = ''
      setSelectedProjectId('')
      accessStore.clear()
      void error
    } finally {
      layoutDataLoading.value = false
    }
  }

  const currentBusinessLine = computed(() => {
    const id = activeBusinessLineId.value.trim()
    if (!id) {
      return undefined
    }

    return businessLines.value.find((line) => line.id === id)
  })

  const businessLineItems = computed<BusinessLineItem[]>(() => {
    return businessLines.value.map((line) => ({
      id: line.id,
      name: line.name,
      owner: line.owner,
      projectCount: line.projects.length,
      description: line.description ?? null,
    }))
  })

  const currentBusinessLineName = computed(() => {
    if (currentBusinessLine.value) {
      return currentBusinessLine.value.name
    }

    if (businessLines.value.length > 0) {
      return '请选择业务线'
    }

    return '未分组业务线'
  })

  const projectItems = computed<ProjectItem[]>(() => {
    return currentBusinessLine.value?.projects ?? []
  })

  const currentProjectName = computed(() => {
    const currentProjectId = selectedProjectId.value.trim()
    if (!currentProjectId) {
      return '未选择项目'
    }

    for (const line of businessLines.value) {
      const matchedProject = line.projects.find((project) => project.id === currentProjectId)
      if (matchedProject) {
        return matchedProject.name
      }
    }

    return '未选择项目'
  })

  const hasSelectedProject = computed(() => {
    return Boolean(selectedProjectId.value.trim())
  })

  const showCurrentProjectName = computed(() => {
    return !layoutDataLoading.value && hasSelectedProject.value
  })

  const hasAnyBusinessLine = computed(() => businessLines.value.length > 0)

  const refreshAccessContext = async (context?: { businessLineId?: string; projectId?: string }) => {
    if (!userStore.isLogin) {
      accessStore.clear()
      return null
    }

    const businessLineId = context?.businessLineId?.trim() || activeBusinessLineId.value.trim()
    const projectId = context?.projectId?.trim() || selectedProjectId.value.trim()

    try {
      const access = await accessStore.loadContext({
        ...(businessLineId ? { businessLineId } : {}),
        ...(projectId ? { projectId } : {}),
      })
      await ensureAccessibleRoute(projectId)
      return access
    } catch (error) {
      void error
      accessStore.clear()
      await ensureAccessibleRoute('')
      return null
    }
  }

  const refreshLayoutData = async () => {
    await loadLayoutData()
  }

  const openBusinessLineModal = () => {
    void router.push({ name: 'business-lines-manage' })
  }

  const selectBusinessLine = async (businessLineId: string) => {
    const matchedBusinessLine = businessLines.value.find((line) => line.id === businessLineId)
    if (!matchedBusinessLine) return

    activeBusinessLineId.value = matchedBusinessLine.id
    syncProjectSelection({ preserveCurrentBusinessLine: true })
    await refreshAccessContext({ businessLineId: matchedBusinessLine.id })
  }

  const selectProject = async (projectId: string) => {
    if (!projectId) {
      return
    }

    const matchedBusinessLine = findBusinessLineByProjectId(projectId)
    if (!matchedBusinessLine) {
      return
    }

    activeBusinessLineId.value = matchedBusinessLine.id
    setSelectedProjectId(projectId)
    await refreshAccessContext({
      businessLineId: matchedBusinessLine.id,
      projectId,
    })

    const targetMenuPath = resolveProjectMenuPath()
    setSelectedMenuPath(targetMenuPath)

    const currentProjectId = normalizeQueryValue(route.query.projectId)
    if (route.path !== targetMenuPath || currentProjectId !== projectId) {
      void router.push(buildProjectNavigationTarget(projectId, targetMenuPath))
    }
  }

  return {
    setSelectedProjectId,
    getProjectIdFromRoute: () => getProjectIdFromRoute(route),
    syncProjectSelection,
    syncBusinessLineFromRoute,
    loadLayoutData,
    currentBusinessLine,
    businessLineItems,
    currentBusinessLineName,
    projectItems,
    currentProjectName,
    hasSelectedProject,
    showCurrentProjectName,
    hasAnyBusinessLine,
    refreshAccessContext,
    refreshLayoutData,
    openBusinessLineModal,
    selectBusinessLine,
    selectProject,
    findBusinessLineByProjectId,
  }
}
