<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const sidebarOpen = ref(false)
const isDesktop = ref(false)
const isDark = ref(false)

const pageTitle = computed(() => (route.meta.title as string | undefined) ?? 'AI Native')

const breadcrumbs = computed(() => {
  if (route.name === 'project-detail') return ['Projects', 'Project']
  if (route.name === 'task-detail') return ['Tasks', 'Task']
  if (route.name === 'settings') return ['Settings']
  if (route.name === 'tasks') return ['Tasks']
  return ['Projects']
})

const applyTheme = (nextIsDark: boolean) => {
  isDark.value = nextIsDark
  document.documentElement.classList.toggle('dark', nextIsDark)
  localStorage.setItem('ainative-theme', nextIsDark ? 'dark' : 'light')
}

const toggleTheme = () => applyTheme(!isDark.value)

const onKeydown = (event: KeyboardEvent) => {
  if (!sidebarOpen.value) return
  if (event.key !== 'Escape') return
  sidebarOpen.value = false
}

watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false
  },
)

let previousBodyOverflow = ''
watch(sidebarOpen, (open) => {
  if (open && !isDesktop.value) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = previousBodyOverflow
  }
})

let desktopMediaQuery: MediaQueryList | null = null
const syncDesktop = () => {
  isDesktop.value = desktopMediaQuery?.matches ?? false
}

watch(isDesktop, (desktop) => {
  if (!desktop) return
  sidebarOpen.value = false
})

onMounted(() => {
  const saved = localStorage.getItem('ainative-theme')
  applyTheme(saved ? saved === 'dark' : false)

  desktopMediaQuery = window.matchMedia('(min-width: 768px)')
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
  <div class="min-h-screen bg-background text-foreground">
    <a
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      href="#main-content"
    >
      Skip to content
    </a>

    <div class="flex min-h-screen">
      <div
        v-if="sidebarOpen"
        aria-hidden="true"
        class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
        @click="sidebarOpen = false"
      />

      <aside
        id="app-sidebar"
        class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform duration-200 md:static md:translate-x-0"
        :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <div class="flex items-center gap-3 px-5 py-6">
          <div
            class="grid h-10 w-10 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
          >
            AI
          </div>
          <div>
            <div class="text-sm font-semibold">AI Native</div>
            <div class="text-xs text-muted-foreground">Workspace</div>
          </div>
        </div>

        <nav class="flex flex-1 flex-col gap-4 px-4">
          <div class="space-y-1">
            <p class="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Build
            </p>
            <RouterLink
              to="/projects"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              exact-active-class="bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            >
              Projects
            </RouterLink>
            <button
              class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/50"
              type="button"
              disabled
            >
              <span>Workflows</span>
              <span
                class="rounded-full border border-sidebar-border bg-sidebar-accent/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
              >
                Soon
              </span>
            </button>
          </div>

          <div class="space-y-1">
            <p class="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Run
            </p>
            <RouterLink
              to="/tasks"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              exact-active-class="bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            >
              Tasks
            </RouterLink>
          </div>

          <div class="space-y-1">
            <p class="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Workspace
            </p>
            <RouterLink
              to="/settings"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              exact-active-class="bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            >
              Settings
            </RouterLink>
          </div>

          <div class="space-y-1">
            <p class="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Admin
            </p>
            <button
              class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/50"
              type="button"
              disabled
            >
              <span>Users</span>
              <span
                class="rounded-full border border-sidebar-border bg-sidebar-accent/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
              >
                Role
              </span>
            </button>
            <button
              class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/50"
              type="button"
              disabled
            >
              <span>Business Lines</span>
              <span
                class="rounded-full border border-sidebar-border bg-sidebar-accent/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
              >
                Role
              </span>
            </button>
          </div>

          <RouterLink
            to="/login"
            class="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            Sign out
          </RouterLink>
        </nav>

        <div class="px-4 pb-6">
          <div
            class="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4 text-xs text-muted-foreground"
          >
            Syncing your design system with motion, tokens, and UI primitives.
          </div>
        </div>
      </aside>

      <div class="flex min-h-screen flex-1 flex-col">
        <header
          class="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur"
        >
          <div class="flex h-16 items-center justify-between px-6">
            <div class="flex items-center gap-3">
              <button
                class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm transition hover:shadow-md md:hidden"
                type="button"
                aria-controls="app-sidebar"
                :aria-expanded="sidebarOpen"
                :aria-label="sidebarOpen ? 'Close sidebar' : 'Open sidebar'"
                @click="sidebarOpen = !sidebarOpen"
              >
                <svg
                  v-if="!sidebarOpen"
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
              <div
                class="grid h-9 w-9 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground"
              >
                WS
              </div>
              <div>
                <div class="text-sm font-semibold">{{ pageTitle }}</div>
                <div class="text-xs text-muted-foreground">
                  {{ breadcrumbs.join(' / ') }}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:shadow-md"
                type="button"
                @click="toggleTheme"
              >
                {{ isDark ? 'Light' : 'Dark' }}
              </button>
              <button
                class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
                type="button"
              >
                Create
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" class="flex-1">
          <div class="container py-8">
            <slot />
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
