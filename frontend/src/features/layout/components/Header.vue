<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { GitBranch, Puzzle, Server, Workflow, Zap } from 'lucide-vue-next'
import { SidebarTrigger } from '@shared/ui/sidebar'
import { cn } from '@shared/lib/utils'
import type { MenuItem } from '@features/layout/composables/useLayout'

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
  userDisplayName: string
}>()

const headerToolIcon = (id: MenuItem['id']) => {
  if (id === 'git') return GitBranch
  if (id === 'workflow') return Workflow
  if (id === 'skills') return Puzzle
  if (id === 'automations') return Zap
  return Server
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

        <div
          class="inline-flex h-10 shrink-0 items-center rounded-2xl border border-border/80 bg-card/85 px-1.5 shadow-sm backdrop-blur-sm"
          :title="props.userDisplayName"
          aria-label="账号头像"
        >
          <div
            class="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-gradient-to-br from-primary via-primary to-primary/75 text-[11px] font-bold text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_6px_16px_-10px_rgba(15,23,42,0.5)] dark:border-white/10"
          >
            {{ props.userAvatarInitial }}
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
