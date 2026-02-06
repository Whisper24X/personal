import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { STORAGE_KEYS } from '@/types/common/storage'

export type ProjectItem = {
  id: string
  name: string
  to: string
  short: string
}

export type BusinessLineItem = {
  id: string
  name: string
  owner: string
  projectCount: number
}

type BusinessLine = {
  id: string
  name: string
  owner: string
  projects: ProjectItem[]
}

export type MenuItem = {
  id: 'dashboard' | 'tasks' | 'kanban' | 'automations' | 'skills' | 'mcp'
  label: string
  to: string
}

export const useLayout = () => {
  const route = useRoute()

  const mobileNavOpen = ref(false)
  const isDesktop = ref(false)
  const settingsModalOpen = ref(false)
  const businessLineModalOpen = ref(false)
  const menuCollapsed = ref(false)
  const projectTooltipVisible = ref(false)
  const projectTooltipText = ref('')
  const projectTooltipStyle = ref({
    left: '0px',
    top: '0px',
  })

  const businessLines = ref<BusinessLine[]>([
    {
      id: 'bl-platform',
      name: '平台研发线',
      owner: '张敏',
      projects: [
        { id: 'demo-ainative', name: 'AI Native', to: '/projects/demo-ainative', short: 'AIN' },
        { id: 'studio-core', name: 'Studio Core', to: '/projects/studio-core', short: 'STD' },
      ],
    },
    {
      id: 'bl-growth',
      name: '增长业务线',
      owner: '李博',
      projects: [{ id: 'runner-sandbox', name: 'Runner Sandbox', to: '/projects/runner-sandbox', short: 'RUN' }],
    },
  ])

  const activeBusinessLineId = ref(businessLines.value[0]?.id ?? '')

  const currentBusinessLine = computed(() => {
    return businessLines.value.find((line) => line.id === activeBusinessLineId.value) ?? businessLines.value[0]
  })

  const businessLineItems = computed<BusinessLineItem[]>(() => {
    return businessLines.value.map((line) => ({
      id: line.id,
      name: line.name,
      owner: line.owner,
      projectCount: line.projects.length,
    }))
  })

  const currentBusinessLineName = computed(() => {
    return currentBusinessLine.value?.name ?? '未分组业务线'
  })

  const projectItems = computed<ProjectItem[]>(() => {
    return currentBusinessLine.value?.projects ?? []
  })

  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: '仪表盘', to: '/dashboard' },
    { id: 'tasks', label: '任务', to: '/tasks' },
    { id: 'kanban', label: '看板', to: '/kanban' },
    { id: 'automations', label: '自动化', to: '/automations' },
    { id: 'skills', label: 'Skills', to: '/skills' },
    { id: 'mcp', label: 'MCP', to: '/mcp' },
  ]

  const menuIconPaths: Record<MenuItem['id'], string[]> = {
    dashboard: ['M3 3h8v8H3z', 'M13 3h8v5h-8z', 'M13 10h8v11h-8z', 'M3 13h8v8H3z'],
    tasks: ['m9 11 2 2 4-4', 'M5 11h.01', 'M5 18h.01', 'm9 18 2 2 4-4', 'M14 11h5', 'M14 18h5', 'M3 6h18'],
    kanban: ['M4 5h6v14H4z', 'M14 5h6v8h-6z', 'M14 15h6v4h-6z'],
    automations: ['M12 7v5l3 3', 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z'],
    skills: ['M12 3v4', 'M12 17v4', 'M4.93 4.93l2.83 2.83', 'M16.24 16.24l2.83 2.83', 'M3 12h4', 'M17 12h4', 'M4.93 19.07l2.83-2.83', 'M16.24 7.76l2.83-2.83'],
    mcp: ['M5 3h14a2 2 0 0 1 2 2v3H3V5a2 2 0 0 1 2-2z', 'M3 10h18v4H3z', 'M3 16h18v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M7 6h.01', 'M7 12h.01', 'M7 18h.01'],
  }

  const pageTitle = computed(() => (route.meta.title as string | undefined) ?? '仪表盘')

  const breadcrumbs = computed(() => {
    if (route.name === 'dashboard') return ['项目菜单', '仪表盘']
    if (route.name === 'kanban') return ['项目菜单', '看板']
    if (route.name === 'workflow') return ['项目菜单', '工作流']
    if (route.name === 'skills') return ['项目菜单', 'Skills']
    if (route.name === 'mcp') return ['项目菜单', 'MCP']
    if (route.name === 'automations') return ['项目菜单', '自动化']
    if (route.name === 'tasks') return ['项目菜单', '任务']
    if (route.name === 'task-detail') return ['项目菜单', '任务', '任务详情']
    if (route.name === 'projects') return ['项目管理', '项目列表']
    if (route.name === 'project-detail') return ['项目管理', '项目详情']
    if (route.name === 'settings') return ['工作区', '设置']
    return ['项目菜单']
  })

  const isRouteActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)

  const menuItemClass = (to: string) => {
    if (isRouteActive(to)) {
      return 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
    }

    return 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
  }

  const projectItemClass = (to: string) => {
    if (isRouteActive(to)) {
      return 'border-primary/45 bg-primary text-primary-foreground shadow-md ring-2 ring-primary/35'
    }

    return 'border-sidebar-border/60 bg-sidebar-accent/30 text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
  }

  const projectShortLabel = (short: string) => short.trim().slice(0, 4).toUpperCase()
  const menuIconFor = (menuId: MenuItem['id']) => menuIconPaths[menuId]
  const sidebarCollapsed = computed(() => isDesktop.value && menuCollapsed.value)

  const setMobileNavOpen = (open: boolean) => {
    mobileNavOpen.value = open
  }

  const setBusinessLineModalOpen = (open: boolean) => {
    businessLineModalOpen.value = open
  }

  const toggleMobileNav = () => {
    mobileNavOpen.value = !mobileNavOpen.value
  }

  const toggleMenuCollapsed = () => {
    menuCollapsed.value = !menuCollapsed.value
  }

  const showProjectTooltip = (event: MouseEvent | FocusEvent, name: string) => {
    const target = event.currentTarget as HTMLElement | null
    if (!target) return

    const rect = target.getBoundingClientRect()
    projectTooltipText.value = name
    projectTooltipStyle.value = {
      left: `${rect.right + 10}px`,
      top: `${rect.top + rect.height / 2}px`,
    }
    projectTooltipVisible.value = true
  }

  const hideProjectTooltip = () => {
    projectTooltipVisible.value = false
  }

  const showMenuTooltip = (event: MouseEvent | FocusEvent, label: string) => {
    if (!sidebarCollapsed.value) return
    showProjectTooltip(event, label)
  }

  const findBusinessLineByProjectId = (projectId: string) => {
    return businessLines.value.find((line) => line.projects.some((project) => project.id === projectId))
  }

  const getProjectIdFromRoute = () => {
    if (route.name !== 'project-detail') return ''

    const routeProjectId = route.params.id
    if (typeof routeProjectId === 'string') return routeProjectId
    if (Array.isArray(routeProjectId)) return routeProjectId[0] ?? ''

    return ''
  }

  const syncBusinessLineFromRoute = () => {
    const projectId = getProjectIdFromRoute()
    if (!projectId) return

    const matchedBusinessLine = findBusinessLineByProjectId(projectId)
    if (!matchedBusinessLine) return
    activeBusinessLineId.value = matchedBusinessLine.id
  }

  const normalizeProjectShort = (short: string, projectName: string) => {
    const source = short.trim() || projectName.trim()
    return source.slice(0, 4).toUpperCase()
  }

  const normalizeProjectId = (name: string) => {
    const normalized = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')

    if (normalized) return normalized
    return `project-${Date.now().toString(36)}`
  }

  const ensureUniqueProjectId = (candidateId: string) => {
    let uniqueId = candidateId
    let suffix = 1

    while (businessLines.value.some((line) => line.projects.some((project) => project.id === uniqueId))) {
      uniqueId = `${candidateId}-${suffix}`
      suffix += 1
    }

    return uniqueId
  }

  const openBusinessLineModal = () => {
    businessLineModalOpen.value = true
    mobileNavOpen.value = false
    hideProjectTooltip()
  }

  const selectBusinessLine = (businessLineId: string) => {
    const matchedBusinessLine = businessLines.value.find((line) => line.id === businessLineId)
    if (!matchedBusinessLine) return

    activeBusinessLineId.value = matchedBusinessLine.id
    hideProjectTooltip()
  }

  const createProject = (payload: { businessLineId: string; name: string; short: string }) => {
    const targetLine = businessLines.value.find((line) => line.id === payload.businessLineId)
    if (!targetLine) return

    const projectName = payload.name.trim()
    if (!projectName) return

    const projectId = ensureUniqueProjectId(normalizeProjectId(projectName))
    const projectShort = normalizeProjectShort(payload.short, projectName)

    targetLine.projects.push({
      id: projectId,
      name: projectName,
      to: `/projects/${projectId}`,
      short: projectShort,
    })
  }

  const updateProject = (payload: { businessLineId: string; projectId: string; name: string; short: string }) => {
    const targetLine = businessLines.value.find((line) => line.id === payload.businessLineId)
    if (!targetLine) return

    const targetProject = targetLine.projects.find((project) => project.id === payload.projectId)
    if (!targetProject) return

    const projectName = payload.name.trim()
    if (!projectName) return

    targetProject.name = projectName
    targetProject.short = normalizeProjectShort(payload.short, projectName)
  }

  const deleteProject = (payload: { businessLineId: string; projectId: string }) => {
    const targetLine = businessLines.value.find((line) => line.id === payload.businessLineId)
    if (!targetLine) return

    targetLine.projects = targetLine.projects.filter((project) => project.id !== payload.projectId)
  }

  const openSettingsModal = () => {
    settingsModalOpen.value = true
    mobileNavOpen.value = false
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (!mobileNavOpen.value) return
    if (event.key !== 'Escape') return
    mobileNavOpen.value = false
  }

  const onWindowGeometryChange = () => {
    hideProjectTooltip()
  }

  watch(
    () => route.fullPath,
    () => {
      mobileNavOpen.value = false
      hideProjectTooltip()
      syncBusinessLineFromRoute()
    },
  )

  let previousBodyOverflow = ''
  watch(mobileNavOpen, (open) => {
    if (open && !isDesktop.value) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return
    }

    document.body.style.overflow = previousBodyOverflow
  })

  let desktopMediaQuery: MediaQueryList | null = null
  const syncDesktop = () => {
    isDesktop.value = desktopMediaQuery?.matches ?? false
  }

  watch(isDesktop, (desktop) => {
    if (!desktop) return
    mobileNavOpen.value = false
  })

  onMounted(() => {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme)
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')

    syncBusinessLineFromRoute()

    desktopMediaQuery = window.matchMedia('(min-width: 1100px)')
    syncDesktop()
    desktopMediaQuery.addEventListener('change', syncDesktop)

    window.addEventListener('keydown', onKeydown)
    window.addEventListener('scroll', onWindowGeometryChange, true)
    window.addEventListener('resize', onWindowGeometryChange)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('scroll', onWindowGeometryChange, true)
    window.removeEventListener('resize', onWindowGeometryChange)
    desktopMediaQuery?.removeEventListener('change', syncDesktop)
    document.body.style.overflow = previousBodyOverflow
  })

  return {
    mobileNavOpen,
    sidebarCollapsed,
    settingsModalOpen,
    businessLineModalOpen,
    businessLineItems,
    activeBusinessLineId,
    currentBusinessLineName,
    projectTooltipVisible,
    projectTooltipText,
    projectTooltipStyle,
    projectItems,
    menuItems,
    pageTitle,
    breadcrumbs,
    menuItemClass,
    projectItemClass,
    projectShortLabel,
    menuIconFor,
    setMobileNavOpen,
    setBusinessLineModalOpen,
    toggleMobileNav,
    toggleMenuCollapsed,
    showProjectTooltip,
    hideProjectTooltip,
    showMenuTooltip,
    openBusinessLineModal,
    selectBusinessLine,
    createProject,
    updateProject,
    deleteProject,
    openSettingsModal,
  }
}
