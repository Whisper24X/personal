<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import { BookOpen, Building2, LayoutDashboard, ListTodo, Target, Settings2 } from 'lucide-vue-next'
import type { ProjectItem } from '@/hooks/core/useLayout'
import {
  formatTaskShortTime,
  taskStatusLabel,
  useSidebarRecentTasks,
} from '@/hooks/useSidebarRecentTasks'
import logoImage from '@/assets/images/logo.svg'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'

defineOptions({
  name: 'AppWorkspaceSidebar',
})

const props = defineProps<{
  currentBusinessLineName: string
  selectedProjectId: string
  projectItems: ProjectItem[]
  hasSelectedProject: boolean
  sidebarCoreTasksKnowledge: {
    tasks: { label: string; to: string } | undefined
    goals: { label: string; to: string } | undefined
    knowledge: { label: string; to: string } | undefined
  }
  projectNavigationTo: (projectId: string) => RouteLocationRaw
  isNavActive: (to: string) => boolean
  workbenchNavTo: RouteLocationRaw
  isWorkbenchNavActive: () => boolean
  isBusinessLineManageActive: boolean
  isSettingsActive: boolean
}>()

const route = useRoute()
const { setOpenMobile } = useSidebar()

const recentSearchQuery = ref('')
const { tasks: recentTasks, loading: recentTasksLoading } = useSidebarRecentTasks(
  () => props.selectedProjectId,
)

const filteredRecentTasks = computed(() => {
  const q = recentSearchQuery.value.trim().toLowerCase()
  if (!q) {
    return recentTasks.value
  }

  return recentTasks.value.filter((t) => t.title.toLowerCase().includes(q))
})

const activeRecentTaskId = computed(() => {
  if (route.name !== 'task-detail') {
    return ''
  }

  const routeTaskId = route.params.id
  if (typeof routeTaskId === 'string') {
    return routeTaskId
  }

  return Array.isArray(routeTaskId) ? routeTaskId[0] ?? '' : ''
})

const isRecentTaskActive = (taskId: string) => {
  return activeRecentTaskId.value === taskId
}
</script>

<template>
  <Sidebar collapsible="icon">
    <!-- 原型：sidebar-logo — 仅品牌，业务线名放在下方「项目」区 -->
    <!-- 与顶栏 Header h-14（56px）同高，避免侧栏品牌区约 65px 与主区顶栏错位 -->
    <SidebarHeader
      class="h-14 min-h-14 shrink-0 flex-row items-center border-b border-sidebar-border px-2 py-0"
    >
      <SidebarMenu class="w-full min-w-0">
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <RouterLink to="/home" class="flex items-center gap-2 overflow-hidden">
              <div
                class="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
              >
                <img :src="logoImage" alt="" class="size-6 object-contain" />
              </div>
              <span class="truncate font-semibold">AINative</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <SidebarContent>
      <!-- 原型：sidebar-section — 工作台 / 需求 / 任务 / 知识库 -->
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                as-child
                :is-active="props.isWorkbenchNavActive()"
                tooltip="工作台（项目仪表盘）"
              >
                <RouterLink :to="props.workbenchNavTo">
                  <LayoutDashboard class="size-4 shrink-0" />
                  <span>工作台</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem v-if="props.sidebarCoreTasksKnowledge.goals">
              <SidebarMenuButton
                as-child
                :is-active="isNavActive(props.sidebarCoreTasksKnowledge.goals.to)"
                :tooltip="props.sidebarCoreTasksKnowledge.goals.label"
              >
                <RouterLink :to="props.sidebarCoreTasksKnowledge.goals.to">
                  <Target class="size-4 shrink-0" />
                  <span>{{ props.sidebarCoreTasksKnowledge.goals.label }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem v-if="props.sidebarCoreTasksKnowledge.tasks">
              <SidebarMenuButton
                as-child
                :is-active="isNavActive(props.sidebarCoreTasksKnowledge.tasks.to)"
                :tooltip="props.sidebarCoreTasksKnowledge.tasks.label"
              >
                <RouterLink :to="props.sidebarCoreTasksKnowledge.tasks.to">
                  <ListTodo class="size-4 shrink-0" />
                  <span>{{ props.sidebarCoreTasksKnowledge.tasks.label }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem v-if="props.sidebarCoreTasksKnowledge.knowledge">
              <SidebarMenuButton
                as-child
                :is-active="isNavActive(props.sidebarCoreTasksKnowledge.knowledge.to)"
                :tooltip="props.sidebarCoreTasksKnowledge.knowledge.label"
              >
                <RouterLink :to="props.sidebarCoreTasksKnowledge.knowledge.to">
                  <BookOpen class="size-4 shrink-0" />
                  <span>{{ props.sidebarCoreTasksKnowledge.knowledge.label }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator />

      <!-- 原型：sidebar-biz-proj — 「项目 · 业务线名」+ 项目列表 -->
      <SidebarGroup>
        <SidebarGroupLabel class="flex flex-wrap items-baseline gap-1">
          <span>项目</span>
          <span class="font-normal text-muted-foreground">· {{ props.currentBusinessLineName }}</span>
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in props.projectItems" :key="item.id">
              <SidebarMenuButton
                as-child
                :is-active="props.selectedProjectId === item.id"
                :tooltip="item.name"
              >
                <RouterLink :to="props.projectNavigationTo(item.id)">
                  <span class="truncate">{{ item.name }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <!-- 最近任务：与当前项目同步，可搜索并跳转详情 -->
      <div
        class="group-data-[collapsible=icon]:hidden flex min-h-[7rem] w-full min-w-0 flex-1 flex-col gap-2 border-t border-sidebar-border px-2 py-2"
      >
        <div class="flex items-center justify-between px-1 pt-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">最近任务</span>
        </div>
        <Input
          v-model="recentSearchQuery"
          type="search"
          placeholder="搜索任务…"
          class="h-8 border-sidebar-border/80 bg-sidebar-accent/30 text-xs shadow-none md:text-xs"
          :disabled="!props.hasSelectedProject"
        />
        <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <p
            v-if="!props.hasSelectedProject"
            class="px-1 text-[11px] leading-relaxed text-muted-foreground"
          >
            请先选择项目
          </p>
          <p
            v-else-if="recentTasksLoading"
            class="px-1 text-[11px] text-muted-foreground"
          >
            加载中…
          </p>
          <p
            v-else-if="filteredRecentTasks.length === 0"
            class="px-1 text-[11px] leading-relaxed text-muted-foreground"
          >
            {{ recentTasks.length === 0 ? '暂无任务' : '无匹配任务' }}
          </p>
          <ul v-else class="flex flex-col gap-0.5">
            <li v-for="task in filteredRecentTasks" :key="task.id" class="min-w-0">
              <RouterLink
                :to="{
                  name: 'task-detail',
                  params: { id: task.id },
                  query: { projectId: task.projectId },
                }"
                class="block max-w-full rounded-md px-1.5 py-1.5 text-left transition"
                :class="
                  isRecentTaskActive(task.id)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'hover:bg-sidebar-accent/60'
                "
                :aria-current="isRecentTaskActive(task.id) ? 'page' : undefined"
                @click="setOpenMobile(false)"
              >
                <p
                  class="line-clamp-2 break-words text-[11px] leading-snug"
                  :class="
                    isRecentTaskActive(task.id)
                      ? 'font-medium text-sidebar-accent-foreground'
                      : 'font-medium text-sidebar-foreground'
                  "
                >
                  {{ task.title }}
                </p>
                <p
                  class="mt-0.5 break-words text-[10px]"
                  :class="
                    isRecentTaskActive(task.id)
                      ? 'text-sidebar-accent-foreground'
                      : 'text-muted-foreground'
                  "
                >
                  {{ taskStatusLabel(task.status) }} · {{ formatTaskShortTime(task.updatedAt ?? task.createdAt) }}
                </p>
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </SidebarContent>

    <SidebarFooter class="border-t border-sidebar-border p-2">
      <SidebarMenu class="grid grid-cols-2 gap-1">
        <SidebarMenuItem>
          <SidebarMenuButton
            as-child
            class="h-9 w-full justify-center gap-1.5 text-xs"
            :is-active="props.isBusinessLineManageActive"
          >
            <RouterLink to="/business-lines" @click="setOpenMobile(false)">
              <Building2 class="size-3.5 shrink-0" />
              <span>业务线</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            as-child
            class="h-9 w-full justify-center gap-1.5 text-xs"
            :is-active="props.isSettingsActive"
          >
            <RouterLink to="/settings" @click="setOpenMobile(false)">
              <Settings2 class="size-3.5 shrink-0" />
              <span>设置</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
