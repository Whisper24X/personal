<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import SettingsModal from '@/components/settings/SettingsModal.vue'

type ProjectItem = {
  id: string
  name: string
  to: string
  short: string
}

type MenuItem = {
  id: 'dashboard' | 'tasks' | 'kanban' | 'automations' | 'skills' | 'mcp'
  label: string
  to: string
}

const route = useRoute()

const mobileNavOpen = ref(false)
const isDesktop = ref(false)
const settingsModalOpen = ref(false)
const menuCollapsed = ref(false)

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

const toggleMenuCollapsed = () => {
  menuCollapsed.value = !menuCollapsed.value
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

watch(
  () => route.fullPath,
  () => {
    mobileNavOpen.value = false
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
  const savedTheme = localStorage.getItem('ainative-theme')
  document.documentElement.classList.toggle('dark', savedTheme === 'dark')

  desktopMediaQuery = window.matchMedia('(min-width: 1100px)')
  syncDesktop()
  desktopMediaQuery.addEventListener('change', syncDesktop)

  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  desktopMediaQuery?.removeEventListener('change', syncDesktop)
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-sidebar text-foreground">
    <a
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      href="#main-content"
    >
      跳到主内容
    </a>

    <div aria-hidden="true" class="pointer-events-none absolute inset-0">
      <div class="absolute -left-20 -top-28 h-80 w-80 rounded-full bg-primary/12 blur-3xl" />
      <div class="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-secondary/14 blur-3xl" />
    </div>

    <div class="relative z-10 flex min-h-screen">
      <div
        v-if="mobileNavOpen"
        aria-hidden="true"
        class="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm 2xl:hidden"
        @click="mobileNavOpen = false"
      />

      <aside
        id="workspace-nav"
        class="fixed inset-y-0 left-0 z-50 flex border-r border-sidebar-border bg-sidebar/95 backdrop-blur transition-[width,transform] duration-200 2xl:static 2xl:translate-x-0"
        :class="[mobileNavOpen ? 'translate-x-0' : '-translate-x-full', sidebarCollapsed ? 'w-[9.25rem]' : 'w-[19rem]']"
      >
        <div class="flex h-full min-h-0 w-[5.25rem] flex-col items-center border-r border-sidebar-border px-2">
          <div class="flex h-16 items-center justify-center border-b border-sidebar-border">
            <RouterLink
              to="/dashboard"
              class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm"
              aria-label="打开仪表盘"
            >
              AI
            </RouterLink>
          </div>

          <div class="w-full flex-1 overflow-y-auto overflow-x-visible py-3">
            <div class="flex flex-col items-center gap-2.5">
              <div
                v-for="item in projectItems"
                :key="item.id"
                class="group relative"
              >
                <RouterLink
                :to="item.to"
                class="flex h-12 w-12 items-center justify-center rounded-2xl border text-[11px] font-bold tracking-wider transition-all"
                :class="projectItemClass(item.to)"
                :aria-label="item.name"
                :title="item.name"
              >
                {{ projectShortLabel(item.short) }}
              </RouterLink>

                <span
                  class="pointer-events-none absolute left-[calc(100%+0.55rem)] top-1/2 z-40 -translate-y-1/2 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-[11px] font-medium text-sidebar-foreground opacity-0 shadow-sm transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  {{ item.name }}
                </span>
              </div>
            </div>
          </div>

          <div class="w-full space-y-2 border-t border-sidebar-border py-2">
            <RouterLink
              to="/projects"
              class="flex h-9 w-full items-center justify-center rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 px-2 text-[11px] font-semibold text-sidebar-foreground/80 transition hover:bg-sidebar-accent"
            >
              项目
            </RouterLink>
            <button
              type="button"
              class="flex h-9 w-full items-center justify-center rounded-lg border border-transparent px-2 text-[11px] font-semibold text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
              @click="openSettingsModal"
            >
              设置
            </button>
          </div>
        </div>

        <div class="flex min-h-0 flex-col transition-[width] duration-200" :class="sidebarCollapsed ? 'w-16' : 'w-[13.75rem]'">
          <div class="relative flex h-16 items-center border-b border-sidebar-border px-2" :class="sidebarCollapsed ? 'justify-center' : 'justify-center px-3'">
            <div
              class="inline-flex h-11 cursor-pointer items-center rounded-xl text-sidebar-foreground transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              :class="sidebarCollapsed ? 'w-11 justify-center' : 'w-full justify-center px-2'"
              role="button"
              tabindex="0"
              :aria-label="sidebarCollapsed ? '展开菜单栏' : '折叠菜单栏'"
              @click="toggleMenuCollapsed"
              @keydown.enter.prevent="toggleMenuCollapsed"
              @keydown.space.prevent="toggleMenuCollapsed"
            >
              <span
                class="font-semibold text-sidebar-foreground"
                :class="sidebarCollapsed ? 'text-base tracking-[0.16em]' : 'text-sm tracking-[0.08em]'"
              >
                {{ sidebarCollapsed ? 'A' : 'AINATIVE' }}
              </span>
            </div>
            <button
              class="absolute right-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-foreground 2xl:hidden"
              type="button"
              aria-label="关闭菜单"
              @click="mobileNavOpen = false"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav class="flex-1 overflow-y-auto overflow-x-visible p-2">
            <div class="space-y-1">
              <RouterLink
                v-for="item in menuItems"
                :key="item.id"
                :to="item.to"
                class="group relative flex min-h-11 items-center rounded-xl text-sm font-medium transition"
                :class="[menuItemClass(item.to), sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3']"
                :title="sidebarCollapsed ? item.label : undefined"
              >
                <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sidebar-border/70 bg-sidebar-accent/35">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path v-for="iconPath in menuIconFor(item.id)" :key="iconPath" :d="iconPath" />
                  </svg>
                </span>
                <span v-if="!sidebarCollapsed">{{ item.label }}</span>

                <span
                  v-if="sidebarCollapsed"
                  class="pointer-events-none absolute left-[calc(100%+0.55rem)] top-1/2 z-40 -translate-y-1/2 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-[11px] font-medium text-sidebar-foreground opacity-0 shadow-sm transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  {{ item.label }}
                </span>
              </RouterLink>
            </div>
          </nav>
        </div>
      </aside>

      <div class="flex min-h-screen min-w-0 flex-1 p-2 xl:p-3">
        <div
          class="app-surface flex min-h-[calc(100vh-1rem)] flex-1 flex-col overflow-hidden xl:min-h-[calc(100vh-1.5rem)]"
        >
          <header class="border-b border-border bg-background/85 backdrop-blur">
            <div class="flex h-16 items-center justify-between px-4 md:px-6">
              <div class="flex items-center gap-3">
                <button
                  class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:shadow-sm 2xl:hidden"
                  type="button"
                  aria-controls="workspace-nav"
                  :aria-expanded="mobileNavOpen"
                  :aria-label="mobileNavOpen ? '收起导航' : '展开导航'"
                  @click="mobileNavOpen = !mobileNavOpen"
                >
                  <svg
                    v-if="!mobileNavOpen"
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h16" />
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>

                <div class="hidden h-9 items-center justify-center rounded-lg bg-muted px-3 text-xs font-semibold text-muted-foreground sm:inline-flex">
                  工作台
                </div>

                <div>
                  <p class="text-sm font-semibold leading-none">{{ pageTitle }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ breadcrumbs.join(' / ') }}</p>
                </div>
              </div>
            </div>
          </header>

          <main id="main-content" class="flex-1 overflow-auto">
            <div class="container py-6 md:py-8">
              <slot />
            </div>
          </main>
        </div>
      </div>
    </div>

    <SettingsModal v-model:open="settingsModalOpen" />
  </div>
</template>
