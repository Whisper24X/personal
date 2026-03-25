<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { goalsApi } from '@/api/goals'
import AppSelect from '@/components/core/select'
import type { SelectOption } from '@/components/core/select/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { goalStatusLabel } from '@/constants/goal-status-labels'
import { formatTaskShortTime } from '@/hooks/useSidebarRecentTasks'
import type { Goal, GoalStatus } from '@/types/api/goals'
import { useMessage } from '@/hooks'
import { toErrorMessage } from '@/utils/http/to-error-message'

const GOAL_LIST_SELECT_Z = 130
/** 在触发器下方展开，避免向上弹出显得突兀 */
const GOAL_LIST_SELECT_PLACEMENT = 'bottom' as const

defineOptions({
  name: 'ProjectGoalsListView',
})

const route = useRoute()
const router = useRouter()
const message = useMessage()

const projectId = computed(() => String(route.params.projectId ?? ''))
const loading = ref(false)
const goals = ref<Goal[]>([])
const statusFilter = ref<GoalStatus | ''>('')
const titleSearch = ref('')
const deletingId = ref<string | null>(null)

const statusFilterOptions = computed<SelectOption[]>(() => [
  { label: '全部状态', value: '' },
  ...(Object.keys(goalStatusLabel) as GoalStatus[]).map((key) => ({
    label: goalStatusLabel[key],
    value: key,
  })),
])

function formatUpdatedAt(value: string) {
  return formatTaskShortTime(value) || value
}

async function load() {
  if (!projectId.value) return
  loading.value = true
  try {
    const res = await goalsApi.list({
      projectId: projectId.value,
      page: 1,
      limit: 100,
      status: statusFilter.value || undefined,
      title: titleSearch.value.trim() || undefined,
    })
    goals.value = res.data
  } catch (e) {
    message.error(toErrorMessage(e, '加载 Goal 列表失败'))
  } finally {
    loading.value = false
  }
}

onMounted(load)

function goDetail(g: Goal) {
  router.push({ name: 'goal-detail', params: { goalId: g.id } })
}

function goCreateGoal() {
  router.push({ name: 'goal-create', query: { projectId: projectId.value } })
}

function onStatusFilterChange(v: string | number | boolean | null) {
  statusFilter.value = String(v ?? '') as GoalStatus | ''
  void load()
}

async function removeGoal(g: Goal, e: MouseEvent) {
  e.stopPropagation()
  if (!window.confirm(`确定删除「${g.title}」吗？删除后无法从此列表恢复。`)) {
    return
  }
  deletingId.value = g.id
  try {
    await goalsApi.remove(g.id)
    message.success('已删除')
    await load()
  } catch (e) {
    message.error(toErrorMessage(e, '删除 Goal 失败'))
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-5 p-4 md:p-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold tracking-tight text-foreground">Goal 目标</h1>
    </header>

    <Card class="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0 shadow-sm">
      <div
        class="border-border flex flex-wrap items-center gap-2 border-b bg-muted/25 px-3 py-3 sm:gap-3 sm:px-4"
      >
        <Input
          v-model="titleSearch"
          type="search"
          placeholder="搜索标题"
          class="min-w-0 flex-1 sm:max-w-[16rem]"
          @keydown.enter="load"
        />
        <AppSelect
          :model-value="statusFilter"
          aria-label="按状态筛选"
          :block="false"
          :match-trigger-width="false"
          :clamp-panel-height="false"
          :trigger-label-truncate="false"
          :option-label-truncate="false"
          :options="statusFilterOptions"
          :panel-z-index="GOAL_LIST_SELECT_Z"
          :panel-placement="GOAL_LIST_SELECT_PLACEMENT"
          size="sm"
          wrapper-class="w-auto shrink-0 max-w-full"
          trigger-class="w-auto max-w-full whitespace-nowrap rounded-md border border-border bg-background px-2.5 text-left text-sm"
          @update:model-value="onStatusFilterChange"
        />
        <Button type="button" class="shrink-0 sm:ml-auto" @click="goCreateGoal">
          新建 Goal
        </Button>
      </div>

      <div
        v-if="loading"
        class="text-muted-foreground flex flex-1 items-center justify-center px-4 py-16 text-sm"
      >
        加载中...
      </div>
      <div v-else class="min-h-0 flex-1 overflow-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-muted/40 border-border sticky top-0 z-[1] border-b">
            <tr class="text-muted-foreground">
              <th class="px-4 py-3 font-medium">标题</th>
              <th class="w-[7.5rem] px-3 py-3 font-medium sm:w-[8.5rem]">状态</th>
              <th class="w-[8.5rem] whitespace-nowrap px-3 py-3 font-medium sm:w-[9.5rem]">
                更新时间
              </th>
              <th class="w-[5rem] px-3 py-3 text-right font-medium sm:w-[5.5rem]">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="g in goals"
              :key="g.id"
              class="border-border/60 hover:bg-muted/25 cursor-pointer border-b transition-colors"
              @click="goDetail(g)"
            >
              <td class="text-foreground max-w-[min(100vw-12rem,32rem)] px-4 py-3 font-medium">
                <span class="line-clamp-2 sm:line-clamp-1">{{ g.title }}</span>
              </td>
              <td class="px-3 py-3 align-middle">
                <span
                  class="bg-muted/80 text-foreground inline-flex max-w-full rounded-full px-2.5 py-0.5 text-xs font-medium"
                >
                  {{ goalStatusLabel[g.status] }}
                </span>
              </td>
              <td class="text-muted-foreground px-3 py-3 text-xs whitespace-nowrap sm:text-sm">
                {{ formatUpdatedAt(g.updatedAt) }}
              </td>
              <td class="px-3 py-3 text-right align-middle" @click.stop>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2"
                  :disabled="deletingId === g.id"
                  @click="removeGoal(g, $event)"
                >
                  {{ deletingId === g.id ? '删除中…' : '删除' }}
                </Button>
              </td>
            </tr>
            <tr v-if="goals.length === 0">
              <td colspan="4" class="px-4 py-14 text-center">
                <p class="text-muted-foreground text-sm">暂无 Goal</p>
                <p class="text-muted-foreground/80 mt-1 text-xs">点击上方「新建 Goal」开始</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </div>
</template>
