import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { STORAGE_KEYS } from '@/types/common/storage'

export type ProjectItem = {
  id: string
  name: string
  to: string
  short: string
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
  const menuCollapsed = ref(false)
  const projectTooltipVisible = ref(false)
  const projectTooltipText = ref('')
  const projectTooltipStyle = ref({
    left: '0px',
    top: '0px',
  })

  const projectItems: ProjectItem[] = [
    { id: 'demo-ainative', name: 'AI Native', to: '/projects/demo-ainative', short: 'AIN' },
    { id: 'runner-sandbox', name: 'Runner Sandbox', to: '/projects/runner-sandbox', short: 'RUN' },
    { id: 'studio-core', name: 'Studio Core', to: '/projects/studio-core', short: 'STD' },
  ]

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
    toggleMobileNav,
    toggleMenuCollapsed,
    showProjectTooltip,
    hideProjectTooltip,
    showMenuTooltip,
    openSettingsModal,
  }
}
