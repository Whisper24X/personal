<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { goalsApi } from '@/api/goals'
import type { Goal, GoalStatus } from '@/types/api/goals'
import { useMessage } from '@/hooks'
import { toErrorMessage } from '@/utils/http/to-error-message'

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

const statusLabel: Record<GoalStatus, string> = {
  draft: '草稿',
  prd_generated: 'PRD 已生成',
  prd_confirmed: 'PRD 已确认',
  planned: '计划已生成',
  in_progress: '执行中',
  done: '完成',
  archived: '归档',
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
  <div class="flex h-full min-h-0 flex-col gap-4 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-lg font-semibold">Goal 目标</h1>
      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="titleSearch"
          type="search"
          placeholder="搜索标题"
          class="border-input bg-background h-9 rounded-md border px-3 text-sm"
          @keydown.enter="load"
        />
        <select
          v-model="statusFilter"
          class="border-input bg-background h-9 rounded-md border px-2 text-sm"
          @change="load"
        >
          <option value="">全部状态</option>
          <option v-for="(label, key) in statusLabel" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
        <button
          type="button"
          class="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-4 text-sm font-medium"
          @click="goCreateGoal"
        >
          新建 Goal
        </button>
      </div>
    </div>

    <div
      v-if="loading"
      class="text-muted-foreground flex flex-1 items-center justify-center text-sm"
    >
      加载中...
    </div>
    <div v-else class="min-h-0 flex-1 overflow-auto rounded-lg border">
      <table class="w-full text-left text-sm">
        <thead class="bg-muted/50 border-b">
          <tr>
            <th class="p-3">标题</th>
            <th class="p-3">状态</th>
            <th class="p-3">更新时间</th>
            <th class="w-[88px] p-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="g in goals"
            :key="g.id"
            class="border-border/60 hover:bg-muted/30 cursor-pointer border-b"
            @click="goDetail(g)"
          >
            <td class="p-3 font-medium">{{ g.title }}</td>
            <td class="text-muted-foreground p-3">{{ statusLabel[g.status] }}</td>
            <td class="text-muted-foreground p-3">{{ g.updatedAt }}</td>
            <td class="p-3 text-right" @click.stop>
              <button
                type="button"
                class="text-destructive hover:text-destructive/90 text-xs font-medium underline-offset-2 hover:underline disabled:opacity-50"
                :disabled="deletingId === g.id"
                @click="removeGoal(g, $event)"
              >
                {{ deletingId === g.id ? '删除中…' : '删除' }}
              </button>
            </td>
          </tr>
          <tr v-if="goals.length === 0">
            <td colspan="4" class="text-muted-foreground p-6 text-center">暂无 Goal</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
