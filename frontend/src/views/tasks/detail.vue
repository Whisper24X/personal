<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

type TaskStatus = 'DRAFT' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED'
type LogLevel = 'INFO' | 'WARN' | 'ERROR'

type LogEntry = {
  ts: string
  level: LogLevel
  message: string
}

type ArtifactRow = {
  id: string
  name: string
  type: 'diff' | 'zip' | 'report'
  createdAt: string
  expiresAt?: string
}

const route = useRoute()
const taskId = computed(() => String(route.params.id ?? ''))

const title = computed(() => {
  if (taskId.value === 't-002') return '运行 Agent 生成 API 桩代码'
  if (taskId.value === 't-003') return '修复 SSE 流鉴权问题'
  if (taskId.value === 't-004') return '上传产物预览页面'
  return '任务详情'
})

const status = ref<TaskStatus>(
  taskId.value === 't-001'
    ? 'DRAFT'
    : taskId.value === 't-003'
      ? 'FAILED'
      : taskId.value === 't-004'
        ? 'SUCCESS'
        : 'RUNNING',
)

const followTail = ref(true)
const wrapLines = ref(false)
const query = ref('')

const logs = ref<LogEntry[]>([
  { ts: '17:31:02', level: 'INFO', message: 'Runner: 正在创建工作树...' },
  { ts: '17:31:04', level: 'INFO', message: 'Agent: 加载指令与验收标准...' },
  { ts: '17:31:07', level: 'INFO', message: 'Agent: 生成变更（dry-run）...' },
  { ts: '17:31:11', level: 'WARN', message: '仓库存在未提交文件，将在沙箱中继续执行。' },
  { ts: '17:31:18', level: 'INFO', message: '上传产物：diff.patch' },
])

const artifacts = ref<ArtifactRow[]>([
  { id: 'a-001', name: 'diff.patch', type: 'diff', createdAt: '2026-02-05 17:31' },
  {
    id: 'a-002',
    name: 'report.md',
    type: 'report',
    createdAt: '2026-02-05 17:32',
    expiresAt: '2026-03-06',
  },
])

const statusBadgeClass = (value: TaskStatus) => {
  if (value === 'SUCCESS') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (value === 'FAILED') return 'bg-red-500/10 text-red-700 dark:text-red-300'
  if (value === 'RUNNING') return 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
  if (value === 'QUEUED') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'bg-muted text-muted-foreground'
}

const statusLabel = (value: TaskStatus) => {
  if (value === 'DRAFT') return '草稿'
  if (value === 'QUEUED') return '排队中'
  if (value === 'RUNNING') return '运行中'
  if (value === 'SUCCESS') return '成功'
  return '失败'
}

const levelClass = (level: LogLevel) => {
  if (level === 'ERROR') return 'text-red-600 dark:text-red-300'
  if (level === 'WARN') return 'text-amber-600 dark:text-amber-300'
  return 'text-muted-foreground'
}

const levelLabel = (level: LogLevel) => {
  if (level === 'WARN') return '警告'
  if (level === 'ERROR') return '错误'
  return '信息'
}

const visibleLogs = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return logs.value
  return logs.value.filter((log) => {
    return log.message.toLowerCase().includes(q) || log.level.toLowerCase().includes(q)
  })
})

const logViewport = ref<HTMLDivElement | null>(null)

watch(
  () => visibleLogs.value.length,
  async () => {
    if (!followTail.value) return
    await nextTick()
    const el = logViewport.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  },
)

const runDemo = async () => {
  status.value = 'RUNNING'
  logs.value.push({ ts: '17:31:26', level: 'INFO', message: 'Agent: 正在应用变更...' })
  logs.value.push({ ts: '17:31:31', level: 'INFO', message: 'Agent: 正在执行类型检查...' })
  await nextTick()
}

const finishDemo = () => {
  status.value = 'SUCCESS'
  logs.value.push({ ts: '17:31:44', level: 'INFO', message: '执行完成，产物已上传。' })
}
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <RouterLink to="/tasks" class="hover:text-foreground hover:underline">任务列表</RouterLink>
        <span>/</span>
        <span class="font-mono">{{ taskId }}</span>
      </div>

      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="space-y-2">
          <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">{{ title }}</h1>
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold"
              :class="statusBadgeClass(status)"
            >
              {{ statusLabel(status) }}
            </span>
            <span class="text-xs text-muted-foreground">模板：Default</span>
            <span class="text-xs text-muted-foreground">•</span>
            <span class="text-xs text-muted-foreground">分支：main</span>
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            v-if="status === 'DRAFT' || status === 'FAILED' || status === 'SUCCESS'"
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
            type="button"
            @click="runDemo"
          >
            {{ status === 'FAILED' ? '重试' : '运行' }}
          </button>
          <button
            v-if="status === 'RUNNING'"
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:shadow-md"
            type="button"
            @click="finishDemo"
          >
            标记完成
          </button>
          <RouterLink
            to="/projects/demo-ainative"
            class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:shadow-md"
          >
            所属项目
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <div class="panel-card overflow-hidden">
        <div class="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm font-semibold">实时日志</p>
            <p class="text-xs text-muted-foreground">SSE 流式输出（MVP：演示数据）</p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              v-model="query"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring sm:w-56"
              placeholder="搜索日志"
              type="search"
            />
            <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input v-model="followTail" class="h-4 w-4" type="checkbox" />
              自动跟随
            </label>
            <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input v-model="wrapLines" class="h-4 w-4" type="checkbox" />
              自动换行
            </label>
          </div>
        </div>

        <div
          ref="logViewport"
          class="h-[420px] overflow-auto p-5 font-mono text-xs leading-relaxed"
          :class="wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre'"
        >
          <div
            v-for="(log, idx) in visibleLogs"
            :key="idx"
            class="flex gap-3 rounded-md px-1 py-0.5 hover:bg-background/60"
          >
            <span class="w-16 shrink-0 text-muted-foreground">{{ log.ts }}</span>
            <span class="w-12 shrink-0 font-semibold" :class="levelClass(log.level)">
              {{ levelLabel(log.level) }}
            </span>
            <span class="min-w-0 flex-1 text-foreground/90">{{ log.message }}</span>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="panel-card p-5">
          <p class="text-sm font-semibold">执行摘要</p>
          <dl class="mt-4 grid gap-3 text-xs">
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">任务 ID</dt>
              <dd class="font-mono text-foreground">{{ taskId }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">开始时间</dt>
              <dd class="text-foreground">2026-02-05 17:31</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">执行耗时</dt>
              <dd class="text-foreground">约 45 秒</dd>
            </div>
          </dl>
        </div>

        <div class="panel-card p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold">产物列表</p>
            <button
              class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
              type="button"
            >
              上传
            </button>
          </div>

          <ul class="mt-4 space-y-3 text-sm">
            <li
              v-for="artifact in artifacts"
              :key="artifact.id"
              class="rounded-xl border border-border bg-background/60 p-4 transition hover:bg-background/85"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="truncate font-semibold">{{ artifact.name }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {{ artifact.type.toUpperCase() }} • {{ artifact.createdAt }}
                    <span v-if="artifact.expiresAt"> • 过期时间 {{ artifact.expiresAt }}</span>
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <button
                    class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground opacity-60"
                    type="button"
                    disabled
                  >
                    预览
                  </button>
                  <button
                    class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground opacity-60"
                    type="button"
                    disabled
                  >
                    下载
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>
