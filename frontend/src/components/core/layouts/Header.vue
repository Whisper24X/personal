<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ChevronDown, GitBranch, Puzzle, Server, Settings2, Workflow, Zap } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import type { MenuItem } from '@/hooks/core/useLayout'
import { SETTINGS_SECTION_LABELS, type SettingsSection } from '@/types/common/settings'

defineOptions({
  name: 'AppHeaderBar',
})

const props = defineProps<{
  pageTitle: string
  breadcrumbs: string[]
  headerToolMenuItems: MenuItem[]
  hasSelectedProject: boolean
  selectedProjectId: string
  isNavActive: (to: string) => boolean
  userAvatarInitial: string
  /** 下拉菜单标题（与 Layout 中用户资料一致） */
  userDisplayName: string
  availableSettingsSections: SettingsSection[]
  openSettings: (section?: SettingsSection) => void
}>()

const headerToolIcon = (id: MenuItem['id']) => {
  if (id === 'git') return GitBranch
  if (id === 'workflow') return Workflow
  if (id === 'skills') return Puzzle
  if (id === 'automations') return Zap
  return Server
}

const onOpenSettingsSection = (section: SettingsSection) => {
  props.openSettings(section)
}
</script>

<template>
  <header
    class="sticky top-0 z-30 shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75"
  >
    <div class="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
      <div class="flex items-center gap-3">
        <SidebarTrigger
          class="md:hidden h-9 w-9 rounded-md border border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground [&_svg]:size-[18px]"
        />

        <div class="min-w-0">
          <p class="truncate text-sm font-semibold leading-tight tracking-tight">{{ props.pageTitle }}</p>
        </div>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        <div
          v-if="props.headerToolMenuItems.length > 0"
          class="hidden items-center gap-0.5 md:flex"
        >
          <template v-for="item in props.headerToolMenuItems" :key="item.id">
            <RouterLink
              v-if="props.hasSelectedProject"
              :to="{
                path: item.to,
                query: { projectId: props.selectedProjectId },
              }"
              :class="
                cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  props.isNavActive(item.to) && 'bg-primary/10 text-primary',
                )
              "
            >
              <component :is="headerToolIcon(item.id)" class="size-3.5 shrink-0" />
              <span>{{ item.label }}</span>
            </RouterLink>
            <span
              v-else
              class="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground/50"
              :title="'请先选择项目'"
            >
              <component :is="headerToolIcon(item.id)" class="size-3.5 shrink-0 opacity-50" />
              <span>{{ item.label }}</span>
            </span>
          </template>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            class="inline-flex h-9 max-w-[min(100%,14rem)] shrink-0 items-center gap-1 rounded-full border border-border bg-background pl-1 pr-1.5 text-left outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="账号与设置"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-semibold text-primary"
              :title="props.userDisplayName"
            >
              {{ props.userAvatarInitial }}
            </div>
            <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" :side-offset="6" class="min-w-[12rem]">
            <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
              {{ props.userDisplayName }}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              v-for="section in props.availableSettingsSections"
              :key="section"
              @select="onOpenSettingsSection(section)"
            >
              <Settings2 class="size-3.5 shrink-0 text-muted-foreground" />
              <span>{{ SETTINGS_SECTION_LABELS[section] }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
</template>
