import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { businessLinesApi } from '@/api/business-lines'
import { projectsApi } from '@/api/projects'
import { useAccessStore } from '@/stores/modules/access'
import { useUserStore } from '@/stores/modules/user'
import {
  getAvailableSettingsSections,
  SETTINGS_QUERY_KEY,
  SETTINGS_SECTION_LABELS,
  type SettingsSection,
  resolveAuthorizedSettingsSection,
} from '@/types/common/settings'
import { STORAGE_KEYS } from '@/types/common/storage'
import type { Project } from '@/types/api/projects'
import {
  BUTTON_ACCESS_CONFIG,
  PROJECT_MENU_ACCESS_CONFIG,
  hasSomeAccess,
  type ProjectMenuId,
} from '@/constants/access-control'
import { applyStoredUiPreferences } from '@/utils/ui-preferences'
import { fetchAllPages } from '@/utils/pagination'

export type ProjectItem = {
  id: string
  name: string
  to: string
  short: string
  businessLineId: string
  description?: string | null
  gitUrl: string
  defaultBranch: string
}

export type BusinessLineItem = {
  id: string
  name: string
  owner: string
  projectCount: number
  description?: string | null
}

type BusinessLine = {
  id: string
  name: string
  description?: string | null
  owner: string
  projects: ProjectItem[]
}

export type MenuItem = {
  id: ProjectMenuId
  label: string
  to: string
  capabilities?: readonly string[]
}

const normalizeQueryValue = (queryValue: unknown) => {
  if (typeof queryValue === 'string') return queryValue
  if (Array.isArray(queryValue)) return queryValue[0] ?? ''
  return ''
}

const normalizeProjectShort = (projectName: string) => {
  const normalizedName = projectName
    .trim()
    .replace(/\s+/g, '')
  const short = normalizedName.slice(0, 4).toUpperCase()
  return short || 'PRJ'
}

const buildDisambiguatedProjectShort = (baseShort: string, index: number) => {
  const base36Index = index.toString(36).toUpperCase()

  if (base36Index.length === 1) {
    return `${baseShort.slice(0, 3).padEnd(3, 'X')}${base36Index}`
  }

  if (base36Index.length === 2) {
    return `${baseShort.slice(0, 2).padEnd(2, 'X')}${base36Index}`
  }

  return `${baseShort.slice(0, 1).padEnd(1, 'X')}${base36Index.slice(-3)}`
}

const assignUniqueProjectShorts = (projects: ProjectItem[]) => {
  const shortGroups = new Map<string, ProjectItem[]>()

  for (const project of projects) {
    const baseShort = normalizeProjectShort(project.name)
    const groupedProjects = shortGroups.get(baseShort) ?? []
    groupedProjects.push(project)
    shortGroups.set(baseShort, groupedProjects)
  }

  for (const [baseShort, groupedProjects] of shortGroups) {
    if (groupedProjects.length <= 1) {
      groupedProjects[0]!.short = baseShort
      continue
    }

    const sortedProjects = [...groupedProjects].sort((left, right) => {
      const compareByName = left.name.localeCompare(right.name)
      if (compareByName !== 0) {
        return compareByName
      }

      return left.id.localeCompare(right.id)
    })

    sortedProjects.forEach((project, index) => {
      project.short = buildDisambiguatedProjectShort(baseShort, index + 1)
    })
  }

  return projects
}

const loadStoredSelectedProjectId = () => {
  return localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? ''
}

const loadStoredSelectedMenuPath = () => {
  return localStorage.getItem(STORAGE_KEYS.lastSelectedMenuPath) ?? ''
}

const loadStoredActiveBusinessLineId = () => {
  return localStorage.getItem(STORAGE_KEYS.lastActiveBusinessLineId)?.trim() ?? ''
}

const persistActiveBusinessLineId = (businessLineId: string) => {
  if (businessLineId.trim()) {
    localStorage.setItem(STORAGE_KEYS.lastActiveBusinessLineId, businessLineId.trim())
  } else {
    localStorage.removeItem(STORAGE_KEYS.lastActiveBusinessLineId)
  }
}

export const useLayout = () => {
  const route = useRoute()
  const router = useRouter()
  const accessStore = useAccessStore()
  const userStore = useUserStore()

  const settingsModalOpen = ref(false)
  const settingsSection = ref<SettingsSection>('account')

  const businessLines = ref<BusinessLine[]>([])
  const activeBusinessLineId = ref('')
  const selectedProjectId = ref(loadStoredSelectedProjectId())
  const layoutDataLoading = ref(false)

  const setSelectedProjectId = (projectId: string) => {
    selectedProjectId.value = projectId

    if (projectId) {
      localStorage.setItem(STORAGE_KEYS.lastSelectedProjectId, projectId)
      return
    }

    localStorage.removeItem(STORAGE_KEYS.lastSelectedProjectId)
  }

  const baseMenuItems: MenuItem[] = PROJECT_MENU_ACCESS_CONFIG.map((item) => ({
    id: item.id,
    label: item.label,
    to: item.to,
    capabilities: [...item.capabilities],
  }))

  const menuItems = computed<MenuItem[]>(() => {
    return baseMenuItems.filter((item) => {
      return hasSomeAccess(item.capabilities, (capability) => accessStore.hasCapability(capability))
    })
  })

  const resolveMenuPathFromPath = (path: string) => {
    const matchedMenu = menuItems.value.find((item) => path === item.to || path.startsWith(`${item.to}/`))
    return matchedMenu?.to ?? ''
  }

  const resolveMenuPathFromRoute = () => {
    if (route.name === 'task-detail') {
      const storedMenuPath = loadStoredSelectedMenuPath()
      const rememberedTaskMenuPath = menuItems.value.find((item) => {
        if (item.to !== storedMenuPath) {
          return false
        }

        return item.id === 'tasks' || item.id === 'kanban'
      })?.to

      if (rememberedTaskMenuPath) {
        return rememberedTaskMenuPath
      }

      const tasksMenuPath = menuItems.value.find((item) => item.id === 'tasks')?.to
      if (tasksMenuPath) {
        return tasksMenuPath
      }
    }

    if (route.name === 'goal-detail') {
      const storedMenuPath = loadStoredSelectedMenuPath()
      const rememberedGoalMenuPath = menuItems.value.find((item) => {
        if (item.to !== storedMenuPath) {
          return false
        }
        return item.id === 'goals' || item.id === 'tasks'
      })?.to

      if (rememberedGoalMenuPath) {
        return rememberedGoalMenuPath
      }

      const goalsMenuPath = menuItems.value.find((item) => item.id === 'goals')?.to
      if (goalsMenuPath) {
        return goalsMenuPath
      }
    }

    return resolveMenuPathFromPath(route.path)
  }

  const setSelectedMenuPath = (menuPath: string) => {
    if (menuPath) {
      localStorage.setItem(STORAGE_KEYS.lastSelectedMenuPath, menuPath)
      return
    }

    localStorage.removeItem(STORAGE_KEYS.lastSelectedMenuPath)
  }

  const syncSelectedMenuPath = () => {
    const menuPath = resolveMenuPathFromRoute()
    if (!menuPath) {
      return
    }

    setSelectedMenuPath(menuPath)
  }

  const resolveProjectMenuPath = () => {
    const routeMenuPath = resolveMenuPathFromRoute()
    if (routeMenuPath) {
      return routeMenuPath
    }

    const storedMenuPath = loadStoredSelectedMenuPath()
    if (storedMenuPath && menuItems.value.some((item) => item.to === storedMenuPath)) {
      return storedMenuPath
    }

    return menuItems.value[0]?.to ?? '/home'
  }

  const projectNavigationTo = (projectId: string): RouteLocationRaw => {
    return {
      path: resolveProjectMenuPath(),
      query: {
        projectId,
      },
    }
  }

  const availableSettingsSections = computed<SettingsSection[]>(() => {
    return getAvailableSettingsSections()
  })

  const defaultSettingsSection = computed<SettingsSection>(() => {
    return availableSettingsSections.value[0] ?? 'account'
  })

  const menuIconPaths: Record<MenuItem['id'], string[]> = {
    dashboard: ['M3 3h8v8H3z', 'M13 3h8v5h-8z', 'M13 10h8v11h-8z', 'M3 13h8v8H3z'],
    workflow: ['M5 6h14', 'M5 18h14', 'M12 6v12', 'm8 10 4-4 4 4', 'm8 14 4 4 4-4'],
    tasks: ['m9 11 2 2 4-4', 'M5 11h.01', 'M5 18h.01', 'm9 18 2 2 4-4', 'M14 11h5', 'M14 18h5', 'M3 6h18'],
    goals: ['M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2', 'M12 8v8', 'M8 12h8'],
    knowledge: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z', 'M8 7h8', 'M8 11h8'],
    kanban: ['M4 5h6v14H4z', 'M14 5h6v8h-6z', 'M14 15h6v4h-6z'],
    automations: ['M12 7v5l3 3', 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z'],
    skills: ['M12 3v4', 'M12 17v4', 'M4.93 4.93l2.83 2.83', 'M16.24 16.24l2.83 2.83', 'M3 12h4', 'M17 12h4', 'M4.93 19.07l2.83-2.83', 'M16.24 7.76l2.83-2.83'],
    mcp: ['M5 3h14a2 2 0 0 1 2 2v3H3V5a2 2 0 0 1 2-2z', 'M3 10h18v4H3z', 'M3 16h18v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M7 6h.01', 'M7 12h.01', 'M7 18h.01'],
    git: ['M4 12h9', 'M8 8l-4 4 4 4', 'M12 6h8', 'M16 2l4 4-4 4', 'M12 18h8', 'M16 14l4 4-4 4'],
  }

  const mapProjectItem = (project: Project): ProjectItem => ({
    id: project.id,
    name: project.name,
    to: `/projects/${project.id}`,
    short: normalizeProjectShort(project.name),
    businessLineId: project.businessLineId,
    description: project.description ?? null,
    gitUrl: project.gitUrl,
    defaultBranch: project.defaultBranch,
  })

  const findBusinessLineByProjectId = (projectId: string) => {
    return businessLines.value.find((line) => line.projects.some((project) => project.id === projectId))
  }

  const getProjectIdFromRoute = () => {
    const routeProjectId = route.params.id
    if (typeof routeProjectId === 'string') return routeProjectId
    if (Array.isArray(routeProjectId)) return routeProjectId[0] ?? ''

    const queryProjectId = normalizeQueryValue(route.query.projectId).trim()
    if (queryProjectId) {
      return queryProjectId
    }

    const projectPathMatch = route.path.match(/^\/projects\/([^/]+)/)
    if (projectPathMatch?.[1]) {
      return decodeURIComponent(projectPathMatch[1])
    }

    return ''
  }

  const syncProjectSelection = ({ preserveCurrentBusinessLine = false }: { preserveCurrentBusinessLine?: boolean } = {}) => {
    const routeProjectId = getProjectIdFromRoute()
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

      const fallbackProjectId = hasStoredSelectedProject
        ? selectedProjectId.value
        : ''

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
    const projectId = getProjectIdFromRoute()
    if (!projectId) return

    const matchedBusinessLine = findBusinessLineByProjectId(projectId)
    if (!matchedBusinessLine) return

    activeBusinessLineId.value = matchedBusinessLine.id
  }

  const loadLayoutData = async () => {
    layoutDataLoading.value = true

    try {
      const [businessLineResponse, projectResponse] = await Promise.all([
        fetchAllPages((page, limit) => businessLinesApi.list({ page, limit })),
        fetchAllPages((page, limit) => projectsApi.list({ page, limit })),
      ])

      const lineMap = new Map<string, BusinessLine>()

      for (const line of businessLineResponse) {
        lineMap.set(line.id, {
          id: line.id,
          name: line.name,
          description: line.description ?? null,
          owner: '-',
          projects: [],
        })
      }

      for (const project of projectResponse) {
        const line = lineMap.get(project.businessLineId)
        if (!line) {
          continue
        }

        line.projects.push(mapProjectItem(project))
      }

      const nextBusinessLines = Array.from(lineMap.values())
        .map((line) => ({
          ...line,
          projects: assignUniqueProjectShorts(
            [...line.projects].sort((left, right) => left.name.localeCompare(right.name)),
          ),
        }))
        .sort((left, right) => left.name.localeCompare(right.name))

      businessLines.value = nextBusinessLines

      const routeProjectId = getProjectIdFromRoute()
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

  const ensureAccessibleRoute = async (projectId?: string) => {
    const requiredCapabilities = (route.meta.capabilities as string[] | undefined) ?? []
    if (requiredCapabilities.length === 0) {
      return
    }

    const canAccessRoute = requiredCapabilities.some((capability) => accessStore.hasCapability(capability))
    if (canAccessRoute) {
      return
    }

    const normalizedProjectId = projectId?.trim() || ''
    const fallbackMenuPath = menuItems.value[0]?.to ?? '/home'

    if (fallbackMenuPath === '/home' || !normalizedProjectId) {
      const canDashboard = accessStore.hasCapability('project.dashboard.read')
      const targetPath =
        hasAnyBusinessLine.value && canDashboard ? '/dashboard' : '/home'
      if (route.path !== targetPath) {
        await router.replace(targetPath)
      }
      return
    }

    const currentProjectId = normalizeQueryValue(route.query.projectId).trim()
    if (route.path === fallbackMenuPath && currentProjectId === normalizedProjectId) {
      return
    }

    await router.replace({
      path: fallbackMenuPath,
      query: {
        projectId: normalizedProjectId,
      },
    })
  }

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

  const canCreateBusinessLine = computed(() => {
    return hasSomeAccess(
      BUTTON_ACCESS_CONFIG.createBusinessLine.capabilities,
      (capability) => accessStore.hasCapability(capability),
    )
  })

  const canCreateProject = computed(() => {
    return hasSomeAccess(
      BUTTON_ACCESS_CONFIG.createProjectItem.capabilities,
      (capability) => accessStore.hasCapability(capability),
    )
  })

  const refreshLayoutData = async () => {
    await loadLayoutData()
  }

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
    if (routeSettingsSection.value) {
      const section = resolveSettingsSection(routeSettingsSection.value)
      return ['工作区', '设置', SETTINGS_SECTION_LABELS[section]]
    }

    if (route.name === 'home') return ['工作区', '首页']
    if (route.name === 'business-lines-manage') return ['工作区', '业务线管理']
    if (route.name === 'dashboard') return ['项目菜单', '仪表盘']
    if (route.name === 'project-workflows') return ['项目菜单', '工作流']
    if (route.name === 'project-workflows-by-id') return ['项目菜单', '工作流']
    if (route.name === 'kanban') return ['项目菜单', '看板']
    if (route.name === 'knowledge-base') return ['项目菜单', '知识库']
    if (route.name === 'skills') return ['项目菜单', 'Skills']
    if (route.name === 'mcp') return ['项目菜单', 'MCP']
    if (route.name === 'automations') return ['项目菜单', '自动化']
    if (route.name === 'tasks') return ['项目菜单', '新建任务']
    if (route.name === 'task-detail') return ['项目菜单', '新建任务', '任务详情']
    if (route.name === 'goal-create') return ['项目菜单', '新建 Goal']
    if (route.name === 'goal-detail') return ['项目菜单', '新建 Goal', 'Goal 详情']
    return ['项目菜单']
  })

  const isRouteActive = (to: string) => {
    const routeMenuPath = resolveMenuPathFromRoute()
    if (routeMenuPath) {
      return routeMenuPath === to
    }

    return route.path === to || route.path.startsWith(`${to}/`)
  }

  /** 侧栏/顶栏链接高亮（项目内菜单路径与路由 path 对齐） */
  const isNavActive = (to: string) => {
    return isRouteActive(to)
  }

  /**
   * 侧栏「工作台」：有项目时进入项目仪表盘；无项目时，
   * 多业务线且尚未选择时进 `/home`；否则有业务线进 `/dashboard`，无业务线进 `/home`。
   */
  const workbenchNavTo = computed((): RouteLocationRaw => {
    const pid = selectedProjectId.value.trim()
    if (pid) {
      return { path: '/dashboard', query: { projectId: pid } }
    }

    if (hasAnyBusinessLine.value && !activeBusinessLineId.value.trim()) {
      return { path: '/home' }
    }

    if (hasAnyBusinessLine.value) {
      return { path: '/dashboard' }
    }

    return { path: '/home' }
  })

  const isWorkbenchNavActive = () => {
    const pid = selectedProjectId.value.trim()
    if (pid) {
      return route.name === 'dashboard'
    }

    if (hasAnyBusinessLine.value && !activeBusinessLineId.value.trim()) {
      return route.name === 'home' || route.path === '/home'
    }

    if (hasAnyBusinessLine.value) {
      return route.name === 'dashboard'
    }

    return route.name === 'home' || route.path === '/home'
  }

  /** 顶栏工具区：与侧栏解耦，固定为工作流 / Skills / 自动化 / MCP / Git（按权限过滤） */
  const HEADER_TOOL_MENU_ORDER: readonly ProjectMenuId[] = [
    'workflow',
    'skills',
    'automations',
    'mcp',
    'git',
  ]

  const headerToolMenuItems = computed(() => {
    const byId = new Map(menuItems.value.map((item) => [item.id, item]))
    return HEADER_TOOL_MENU_ORDER.map((id) => byId.get(id)).filter((item): item is MenuItem =>
      Boolean(item),
    )
  })

  const sidebarCoreTasksKnowledge = computed(() => {
    return {
      goals: menuItems.value.find((item) => item.id === 'goals'),
      tasks: menuItems.value.find((item) => item.id === 'tasks'),
      knowledge: menuItems.value.find((item) => item.id === 'knowledge'),
    }
  })

  const menuItemClass = (to: string) => {
    if (isRouteActive(to)) {
      return 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
    }

    return 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
  }

  const projectItemClass = (projectId: string) => {
    if (projectId === selectedProjectId.value) {
      return 'border-primary/45 bg-primary text-primary-foreground shadow-md ring-2 ring-primary/35'
    }

    return 'border-sidebar-border/60 bg-sidebar-accent/30 text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
  }

  const projectShortLabel = (short: string) => short.trim().slice(0, 4).toUpperCase()
  const menuIconFor = (menuId: MenuItem['id']) => menuIconPaths[menuId]

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
      void router.push({
        path: targetMenuPath,
        query: {
          projectId,
        },
      })
    }

  }

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

  watch(
    () => route.fullPath,
    () => {
      syncSelectedMenuPath()
      syncBusinessLineFromRoute()
      syncProjectSelection()
      void refreshAccessContext()
    },
  )

  watch(
    () =>
      [
        route.path,
        route.query.projectId,
        selectedProjectId.value,
        menuItems.value.map((item) => item.to).join('|'),
      ] as const,
    ([path, queryProjectId, selectedProjectId]) => {
      const routeMenuPath = resolveMenuPathFromRoute()
      if (!routeMenuPath) {
        return
      }

      if (!selectedProjectId) {
        return
      }

      const normalizedQueryProjectId = normalizeQueryValue(queryProjectId).trim()
      if (normalizedQueryProjectId === selectedProjectId) {
        return
      }

      void router.replace({
        path,
        query: {
          ...route.query,
          projectId: selectedProjectId,
        },
      })
    },
    { immediate: true },
  )

  watch(
    () => [userStore.isLogin, activeBusinessLineId.value, selectedProjectId.value] as const,
    () => {
      void refreshAccessContext()
    },
  )

  watch(
    () => route.query[SETTINGS_QUERY_KEY],
    (sectionQuery) => {
      const sectionName = normalizeQueryValue(sectionQuery)
      if (!sectionName) {
        settingsModalOpen.value = false
        return
      }

      const nextSection = resolveSettingsSection(sectionName)
      settingsSection.value = nextSection
      settingsModalOpen.value = true

      if (nextSection !== sectionName) {
        updateSettingsQuery(nextSection)
      }
    },
    { immediate: true },
  )

  watch(defaultSettingsSection, (nextSection) => {
    if (!availableSettingsSections.value.includes(settingsSection.value)) {
      settingsSection.value = nextSection
    }
  })

  watch(activeBusinessLineId, (id) => {
    persistActiveBusinessLineId(id)
  })

  onMounted(() => {
    applyStoredUiPreferences()

    syncSelectedMenuPath()
    void refreshLayoutData()
  })

  return {
    settingsModalOpen,
    settingsSection,
    availableSettingsSections,
    businessLineItems,
    activeBusinessLineId,
    selectedProjectId,
    currentProjectName,
    hasSelectedProject,
    showCurrentProjectName,
    currentBusinessLineName,
    canCreateBusinessLine,
    canCreateProject,
    projectItems,
    menuItems,
    pageTitle,
    breadcrumbs,
    menuItemClass,
    projectItemClass,
    projectNavigationTo,
    projectShortLabel,
    menuIconFor,
    isRouteActive,
    isNavActive,
    workbenchNavTo,
    isWorkbenchNavActive,
    headerToolMenuItems,
    sidebarCoreTasksKnowledge,
    refreshLayoutData,
    openBusinessLineModal,
    openSettings,
    closeSettings,
    setSettingsSection,
    selectBusinessLine,
    selectProject,
    hasAnyBusinessLine,
    layoutDataLoading,
  }
}
