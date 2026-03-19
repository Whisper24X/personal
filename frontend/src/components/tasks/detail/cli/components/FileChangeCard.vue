<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NormalizedEntry } from '../types'
import { formatTime } from '../utils'

defineOptions({ name: 'CliFileChangeCard' })

type FileChangeItem = {
  path: string
  kind?: string
}

const props = defineProps<{
  entry: NormalizedEntry
}>()

const changes = computed<FileChangeItem[]>(() => {
  const rawChanges = Array.isArray(props.entry.metadata?.codexChanges) ? props.entry.metadata.codexChanges : []
  const items: FileChangeItem[] = []

  rawChanges.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return

    const record = raw as Record<string, unknown>
    const path = typeof record.path === 'string' ? record.path.trim() : ''
    if (!path) return

    items.push({
      path,
      kind: typeof record.kind === 'string' ? record.kind.trim() : undefined,
    })
  })

  return items
})

const isCompleted = computed(() => props.entry.metadata?.status === 'success')
const statusText = computed(() => (isCompleted.value ? '已完成' : '进行中'))
const countText = computed(() => `${changes.value.length}`)
const containerClass = computed(() =>
  isCompleted.value
    ? 'border-sky-500/20 bg-sky-500/5'
    : 'border-amber-500/20 bg-amber-500/5',
)
const badgeClass = computed(() =>
  isCompleted.value
    ? 'bg-sky-500/10 text-sky-700'
    : 'bg-amber-500/10 text-amber-700',
)
const iconClass = computed(() => (isCompleted.value ? 'text-sky-600' : 'text-amber-600'))
const collapsed = ref(true)

function shortenFilePath(path: string): string {
  const segments = path.split(/[\\/]+/).filter(Boolean)
  if (segments.length <= 4) return segments.join('/')
  return segments.slice(-4).join('/')
}

function kindLabel(kind?: string): string {
  const normalized = kind?.toLowerCase()
  if (normalized === 'add' || normalized === 'create') return '新增'
  if (normalized === 'delete' || normalized === 'remove') return '删除'
  if (normalized === 'rename') return '重命名'
  if (normalized === 'move') return '移动'
  if (normalized === 'update' || normalized === 'modify' || normalized === 'edit') return '修改'
  return '变更'
}

const summaryText = computed(() => {
  const first = changes.value[0]
  if (!first) return '暂无文件变更'

  const label = `${kindLabel(first.kind)} ${shortenFilePath(first.path)}`
  if (changes.value.length === 1) return label
  return `${label} 等 ${changes.value.length} 项`
})

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}
</script>

<template>
  <div class="rounded-xl border px-4 py-3 shadow-sm" :class="containerClass">
    <button
      type="button"
      class="flex w-full flex-wrap items-center gap-2 text-left text-xs"
      @click="toggleCollapsed"
    >
      <span class="text-sm font-medium" :class="iconClass">{{ isCompleted ? '⧉' : '◌' }}</span>
      <span class="font-medium text-foreground">文件变更</span>
      <span class="rounded-full px-2 py-0.5 text-[11px] font-medium" :class="badgeClass">
        {{ statusText }}
      </span>
      <span class="rounded-full bg-background/80 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
        {{ countText }}
      </span>
      <span class="ml-auto text-[10px] text-muted-foreground/55">{{ formatTime(entry.timestamp) }}</span>
      <span class="text-[10px] text-muted-foreground/60">
        {{ collapsed ? '展开' : '收起' }}
      </span>
    </button>

    <p class="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">
      {{ summaryText }}
    </p>

    <ul v-if="!collapsed && changes.length > 0" class="mt-3 space-y-2">
      <li
        v-for="(item, index) in changes"
        :key="`${entry.id}-${index}`"
        class="flex items-start gap-2 rounded-lg bg-background/70 px-3 py-2 text-sm"
      >
        <span class="mt-0.5 shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
          {{ kindLabel(item.kind) }}
        </span>
        <span class="whitespace-pre-wrap break-words text-foreground">
          {{ shortenFilePath(item.path) }}
        </span>
      </li>
    </ul>

    <p v-else-if="!collapsed" class="mt-3 text-sm text-muted-foreground">
      暂无文件变更
    </p>
  </div>
</template>
