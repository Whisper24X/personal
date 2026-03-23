<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import { Building2, BookOpen, LayoutDashboard, ListTodo, Plus } from 'lucide-vue-next'
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
    knowledge: { label: string; to: string } | undefined
  }
  projectNavigationTo: (projectId: string) => RouteLocationRaw
  isNavActive: (to: string) => boolean
  workbenchNavTo: RouteLocationRaw
  isWorkbenchNavActive: () => boolean
  openBusinessLineModal: () => void
  canCreateProject: boolean
  isBusinessLineManageActive: boolean
}>()

const { setOpenMobile } = useSidebar()

const onCreateProject = () => {
  setOpenMobile(false)
  props.openBusinessLineModal()
}

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
      <!-- 原型：sidebar-section — 工作台 / 任务 / 知识库 -->
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
            <SidebarMenuItem>
              <SidebarMenuButton
                :disabled="!props.canCreateProject"
                :title="props.canCreateProject ? '新建项目' : '暂无新建项目权限'"
                tooltip="新建项目"
                @click="onCreateProject"
              >
                <Plus class="size-4 shrink-0" />
                <span>新建项目</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem v-for="item in props.projectItems" :key="item.id">
              <SidebarMenuButton
                as-child
                :is-active="props.selectedProjectId === item.id"
                :tooltip="item.name"
              >
                <RouterLink :to="props.projectNavigationTo(item.id)">
                  <span
                    class="flex size-6 shrink-0 items-center justify-center rounded-md border border-sidebar-border/70 bg-sidebar-accent/40 text-[10px] font-bold tracking-wide"
                  >
                    {{ item.short.slice(0, 4).toUpperCase() }}
                  </span>
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
                class="block max-w-full rounded-md px-1.5 py-1.5 text-left transition hover:bg-sidebar-accent"
                @click="setOpenMobile(false)"
              >
                <p
                  class="line-clamp-2 break-words text-[11px] font-medium leading-snug text-sidebar-foreground"
                >
                  {{ task.title }}
                </p>
                <p class="mt-0.5 break-words text-[10px] text-muted-foreground">
                  {{ taskStatusLabel(task.status) }} · {{ formatTaskShortTime(task.updatedAt ?? task.createdAt) }}
                </p>
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </SidebarContent>

    <!-- 设置已移至顶栏头像下拉；底部仅保留业务线 -->
    <SidebarFooter class="border-t border-sidebar-border p-2">
      <SidebarMenu>
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
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
