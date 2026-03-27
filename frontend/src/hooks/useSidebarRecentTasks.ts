import { onMounted, onUnmounted, ref, watch } from 'vue'
import { tasksApi } from '@/api/tasks'
import type { Task } from '@/types/api/tasks'
import { fetchAllPages } from '@/utils/pagination'
import {
  registerSidebarRecentTasksRefresh,
  unregisterSidebarRecentTasksRefresh,
} from '@/utils/sidebar-recent-tasks-refresh'

/** 侧栏列表高度有限，取最近更新前 N 条；与项目任务总数无必然相等 */
const RECENT_LIMIT = 20

/** 任务列表变更时递增，供侧栏「最近任务」重新拉取（与当前项目 id 解耦） */
const sidebarRecentTasksRefreshTick = ref(0)

/** 在项目内新建/物化任务后调用，使侧栏「最近任务」与后端一致 */
export function requestSidebarRecentTasksRefresh() {
  sidebarRecentTasksRefreshTick.value += 1
}

const uniqueById = <T extends { id: string }>(items: T[]) => {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

/**
 * 侧栏「最近任务」：按当前项目拉取任务，按更新时间倒序取前 N 条。
 */
export function useSidebarRecentTasks(selectedProjectId: () => string) {
  const tasks = ref<Task[]>([])
  const loading = ref(false)

  const load = async () => {
    const projectId = selectedProjectId()
    if (!projectId) {
      tasks.value = []
      return
    }

    loading.value = true
    try {
      const raw = await fetchAllPages((page, limit) =>
        tasksApi.list({ projectId, page, limit }),
      )
      const list = uniqueById(raw)
      list.sort((a, b) => {
        const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
        const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime()
        return tb - ta
      })
      tasks.value = list.slice(0, RECENT_LIMIT)
    } catch {
      tasks.value = []
    } finally {
      loading.value = false
    }
  }

  watch(
    () => [selectedProjectId(), sidebarRecentTasksRefreshTick.value] as const,
    () => {
      void load()
    },
    { immediate: true },
  )

  onMounted(() => {
    registerSidebarRecentTasksRefresh(load)
  })

  onUnmounted(() => {
    unregisterSidebarRecentTasksRefresh()
  })

  return { tasks, loading, refresh: load }
}

export function taskStatusLabel(status: Task['status']): string {
  const map: Record<Task['status'], string> = {
    todo: '待执行',
    in_progress: '执行中',
    in_review: '待处理',
    done: '已完成',
  }
  return map[status] ?? status
}

export function formatTaskShortTime(value?: string) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
