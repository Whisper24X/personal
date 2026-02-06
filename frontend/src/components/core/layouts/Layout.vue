<script setup lang="ts">
import SettingsModal from '@/components/business/settings/SettingsModal.vue'
import HeaderBar from '@/components/core/layouts/Header.vue'
import SideNav from '@/components/core/layouts/Sidebar.vue'
import { useLayout } from '@/hooks/core/useLayout'

const {
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
} = useLayout()
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
        @click="setMobileNavOpen(false)"
      />

      <SideNav
        :mobile-nav-open="mobileNavOpen"
        :sidebar-collapsed="sidebarCollapsed"
        :project-items="projectItems"
        :menu-items="menuItems"
        :project-item-class="projectItemClass"
        :menu-item-class="menuItemClass"
        :project-short-label="projectShortLabel"
        :menu-icon-for="menuIconFor"
        :set-mobile-nav-open="setMobileNavOpen"
        :toggle-menu-collapsed="toggleMenuCollapsed"
        :show-project-tooltip="showProjectTooltip"
        :show-menu-tooltip="showMenuTooltip"
        :hide-project-tooltip="hideProjectTooltip"
        :open-settings-modal="openSettingsModal"
      />

      <div class="flex min-h-screen min-w-0 flex-1 p-2 xl:p-3">
        <div
          class="app-surface flex min-h-[calc(100vh-1rem)] flex-1 flex-col overflow-hidden xl:min-h-[calc(100vh-1.5rem)]"
        >
          <HeaderBar
            :mobile-nav-open="mobileNavOpen"
            :page-title="pageTitle"
            :breadcrumbs="breadcrumbs"
            :toggle-mobile-nav="toggleMobileNav"
          />

          <main id="main-content" class="flex-1 overflow-auto">
            <div class="container py-6 md:py-8">
              <slot />
            </div>
          </main>
        </div>
      </div>
    </div>

    <span
      v-show="projectTooltipVisible"
      class="pointer-events-none fixed z-[85] -translate-y-1/2 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-[11px] font-medium text-sidebar-foreground shadow-lg transition-opacity duration-150"
      :style="projectTooltipStyle"
    >
      {{ projectTooltipText }}
    </span>

    <SettingsModal v-model:open="settingsModalOpen" />
  </div>
</template>
