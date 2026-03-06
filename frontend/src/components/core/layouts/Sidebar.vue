<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import type { MenuItem, ProjectItem } from '@/hooks/core/useLayout'
import logoImage from '@/assets/images/logo.svg'

defineOptions({
  name: 'AppSidebar',
})

const props = defineProps<{
  mobileNavOpen: boolean
  sidebarCollapsed: boolean
  currentBusinessLineName: string
  projectItems: ProjectItem[]
  menuItems: MenuItem[]
  showProjectMenuColumn: boolean
  projectNavigationTo: (projectId: string) => RouteLocationRaw
  projectItemClass: (projectId: string) => string
  menuItemClass: (to: string) => string
  projectShortLabel: (short: string) => string
  menuIconFor: (menuId: MenuItem['id']) => string[]
  setMobileNavOpen: (open: boolean) => void
  toggleMenuCollapsed: () => void
  showProjectTooltip: (event: MouseEvent | FocusEvent, name: string) => void
  showMenuTooltip: (event: MouseEvent | FocusEvent, label: string) => void
  hideProjectTooltip: () => void
  openBusinessLineModal: () => void
  openSettings: () => void
}>()
</script>

<template>
  <aside
    id="workspace-nav"
    class="fixed inset-y-0 left-0 z-50 flex border-r border-sidebar-border bg-sidebar/95 backdrop-blur transition-[width,transform] duration-200 2xl:static 2xl:h-full 2xl:translate-x-0"
    :class="[
      props.mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
      props.showProjectMenuColumn ? (props.sidebarCollapsed ? 'w-[9.25rem]' : 'w-[19rem]') : 'w-[5.25rem]',
    ]"
  >
    <div class="relative z-20 flex h-full min-h-0 w-[5.25rem] flex-col items-center border-r border-sidebar-border px-1">
      <div class="flex h-16 w-full items-center justify-center border-b border-sidebar-border">
        <RouterLink
          to="/home"
          class="group inline-flex h-11 w-[3.75rem] items-center justify-center rounded-lg transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/55"
          aria-label="打开首页"
        >
          <img
            :src="logoImage"
            alt="AINative Logo"
            class="h-10 w-10 rounded-xl object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
          />
        </RouterLink>
      </div>

      <div class="w-full flex-1 overflow-y-auto overflow-x-hidden py-2">
        <div class="flex flex-col items-center gap-1">
          <RouterLink
            v-for="item in props.projectItems"
            :key="item.id"
            :to="props.projectNavigationTo(item.id)"
            class="flex h-11 w-[3.75rem] items-center justify-center rounded-lg border text-[11px] font-bold tracking-wider transition-all"
            :class="props.projectItemClass(item.id)"
            :aria-label="item.name"
            :title="item.name"
            @mouseenter="props.showProjectTooltip($event, item.name)"
            @mouseleave="props.hideProjectTooltip"
            @focus="props.showProjectTooltip($event, item.name)"
            @blur="props.hideProjectTooltip"
          >
            {{ props.projectShortLabel(item.short) }}
          </RouterLink>
        </div>
      </div>

      <div class="w-full space-y-2 border-t border-sidebar-border py-2">
        <button
          type="button"
          class="flex w-full items-center justify-center rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 px-1 py-1.5 text-[10px] font-semibold leading-tight text-sidebar-foreground/80 transition hover:bg-sidebar-accent"
          :title="`当前业务线：${props.currentBusinessLineName}`"
          @mouseenter="props.showProjectTooltip($event, props.currentBusinessLineName)"
          @mouseleave="props.hideProjectTooltip"
          @focus="props.showProjectTooltip($event, props.currentBusinessLineName)"
          @blur="props.hideProjectTooltip"
          @click="props.openBusinessLineModal"
        >
          <span class="block text-center">{{ props.currentBusinessLineName }}</span>
        </button>
        <button
          type="button"
          class="flex h-9 w-full items-center justify-center rounded-lg border border-transparent px-2 text-[11px] font-semibold text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
          @click="props.openSettings"
        >
          设置
        </button>
      </div>
    </div>

    <div
      v-if="props.showProjectMenuColumn"
      class="relative z-10 flex min-h-0 flex-col transition-[width] duration-200"
      :class="props.sidebarCollapsed ? 'w-16' : 'w-[13.75rem]'"
    >
      <div class="relative flex h-16 items-center border-b border-sidebar-border px-2" :class="props.sidebarCollapsed ? 'justify-center' : 'justify-center px-3'">
        <div
          class="inline-flex h-11 cursor-pointer items-center rounded-xl text-sidebar-foreground transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          :class="props.sidebarCollapsed ? 'w-11 justify-center' : 'w-full justify-center px-2'"
          role="button"
          tabindex="0"
          :aria-label="props.sidebarCollapsed ? '展开菜单栏' : '折叠菜单栏'"
          @click="props.toggleMenuCollapsed"
          @keydown.enter.prevent="props.toggleMenuCollapsed"
          @keydown.space.prevent="props.toggleMenuCollapsed"
        >
          <span
            class="font-semibold text-sidebar-foreground"
            :class="props.sidebarCollapsed ? 'text-base tracking-[0.16em]' : 'text-sm tracking-[0.08em]'"
          >
            {{ props.sidebarCollapsed ? 'A' : 'AINATIVE' }}
          </span>
        </div>
        <button
          class="absolute right-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-foreground 2xl:hidden"
          type="button"
          aria-label="关闭菜单"
          @click="props.setMobileNavOpen(false)"
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

      <nav class="flex-1 overflow-y-auto overflow-x-hidden p-2">
        <div class="space-y-1">
          <RouterLink
            v-for="item in props.menuItems"
            :key="item.id"
            :to="item.to"
            class="group relative flex min-h-11 items-center rounded-xl text-sm font-medium transition"
            :class="[props.menuItemClass(item.to), props.sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3']"
            :title="props.sidebarCollapsed ? item.label : undefined"
            @mouseenter="props.showMenuTooltip($event, item.label)"
            @mouseleave="props.hideProjectTooltip"
            @focus="props.showMenuTooltip($event, item.label)"
            @blur="props.hideProjectTooltip"
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
                <path v-for="iconPath in props.menuIconFor(item.id)" :key="iconPath" :d="iconPath" />
              </svg>
            </span>
            <span v-if="!props.sidebarCollapsed">{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>
    </div>
  </aside>
</template>
