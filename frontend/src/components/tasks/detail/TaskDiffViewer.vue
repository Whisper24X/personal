<script setup lang="ts">
import { computed, ref } from 'vue'
import { highlightCodeLine, resolveCodeLanguage } from '@/components/core/file-browser/preview'
import {
  buildSplitRows,
  parseUnifiedDiff,
  type TaskDiffFile,
  type TaskDiffFileStatus,
  type TaskDiffInlineSegment,
  type TaskDiffLine,
  type TaskDiffSplitRow,
} from './task-diff'

defineOptions({
  name: 'TaskDiffViewer',
})

const props = withDefaults(
  defineProps<{
    diffText: string
    emptyText?: string
    loading?: boolean
    fallbackPath?: string | null
  }>(),
  {
    emptyText: '暂无差异',
    loading: false,
    fallbackPath: null,
  },
)

const parsedFiles = computed(() => parseUnifiedDiff(props.diffText))
const viewMode = ref<'unified' | 'split'>('unified')
const shouldUseFallback = computed(() => {
  return Boolean(props.diffText.trim()) && parsedFiles.value.length === 0
})

const statusTextMap: Record<TaskDiffFileStatus, string> = {
  added: '新增',
  deleted: '删除',
  modified: '修改',
  renamed: '重命名',
  copied: '复制',
  binary: '二进制',
  unknown: '未知',
}

const statusClassMap: Record<TaskDiffFileStatus, string> = {
  added: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  deleted: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  modified: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  renamed: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  copied: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  binary: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  unknown: 'bg-muted text-muted-foreground',
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function formatLineNumber(value: number | null) {
  return value == null ? '' : String(value)
}

function resolveLineNumberClass(type: TaskDiffLine['type'] | null | undefined) {
  if (type === 'add') {
    return 'border-r border-emerald-500/15 bg-emerald-500/18 text-emerald-950/70 dark:border-emerald-400/15 dark:bg-emerald-400/12 dark:text-emerald-100/75'
  }

  if (type === 'delete') {
    return 'border-r border-rose-500/15 bg-rose-500/18 text-rose-950/70 dark:border-rose-400/15 dark:bg-rose-400/12 dark:text-rose-100/75'
  }

  return 'border-r border-border/50 bg-muted/35 text-foreground/75'
}

function resolveMarkerColumnClass(type: TaskDiffLine['type'] | null | undefined) {
  if (type === 'add') {
    return 'bg-emerald-500/8 text-emerald-700/95 dark:bg-emerald-400/8 dark:text-emerald-300/95'
  }

  if (type === 'delete') {
    return 'bg-rose-500/8 text-rose-700/95 dark:bg-rose-400/8 dark:text-rose-300/95'
  }

  return 'bg-muted/5 text-muted-foreground/80'
}

function resolveFileLanguage(file: TaskDiffFile) {
  return resolveCodeLanguage(file.displayPath || props.fallbackPath, null)
}

function resolveSplitRows(file: TaskDiffFile, hunkIndex: number): TaskDiffSplitRow[] {
  return buildSplitRows(file.hunks[hunkIndex]?.lines ?? [])
}

function resolveLinePrefix(line: TaskDiffLine) {
  switch (line.type) {
    case 'add':
      return '+'
    case 'delete':
      return '-'
    case 'context':
      return ' '
    default:
      return ''
  }
}

function renderCodeLine(line: TaskDiffLine, file: TaskDiffFile) {
  if (line.type === 'meta') {
    return escapeHtml(line.content || line.raw)
  }

  return highlightCodeLine(line.content, resolveFileLanguage(file))
}

function renderInlineSegments(segments: TaskDiffInlineSegment[] | undefined) {
  if (!segments || segments.length === 0) {
    return '&nbsp;'
  }

  const html = segments
    .map((segment) => {
      const escaped = escapeHtml(segment.text).replaceAll(' ', '&nbsp;')
      if (!segment.changed) {
        return escaped
      }

      return `<span class="diff-inline-change">${escaped}</span>`
    })
    .join('')

  return html || '&nbsp;'
}

function renderSplitCell(
  line: TaskDiffLine | null,
  file: TaskDiffFile,
  segments?: TaskDiffInlineSegment[],
) {
  if (!line) {
    return '&nbsp;'
  }

  if (segments && segments.some((segment) => segment.changed)) {
    return renderInlineSegments(segments)
  }

  return renderCodeLine(line, file)
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto bg-muted/10">
    <div v-if="props.loading" class="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      加载中...
    </div>

    <div v-else-if="!props.diffText.trim()" class="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      {{ props.emptyText }}
    </div>

    <div v-else-if="shouldUseFallback" class="min-h-0 overflow-auto p-3">
      <pre class="font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">{{ props.diffText }}</pre>
    </div>

    <div v-else class="space-y-4 p-3">
      <div class="sticky top-0 z-10 flex justify-end bg-muted/10 pb-2">
        <div class="inline-flex rounded-md border border-border/70 bg-background p-0.5 shadow-sm">
          <button
            class="rounded px-2.5 py-1 text-[11px] transition-colors"
            :class="viewMode === 'unified' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
            type="button"
            @click="viewMode = 'unified'"
          >
            统一视图
          </button>
          <button
            class="rounded px-2.5 py-1 text-[11px] transition-colors"
            :class="viewMode === 'split' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
            type="button"
            @click="viewMode = 'split'"
          >
            分栏视图
          </button>
        </div>
      </div>

      <section
        v-for="file in parsedFiles"
        :key="file.id"
        class="overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm"
      >
        <header class="border-b border-border/60 bg-muted/20 px-3 py-2">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
              :class="statusClassMap[file.status]"
            >
              {{ statusTextMap[file.status] }}
            </span>
            <code class="min-w-0 truncate font-mono text-xs text-foreground">{{ file.displayPath }}</code>
            <span class="ml-auto shrink-0 text-[11px] text-emerald-600 dark:text-emerald-400">+{{ file.additions }}</span>
            <span class="shrink-0 text-[11px] text-rose-600 dark:text-rose-400">-{{ file.deletions }}</span>
          </div>

          <div v-if="file.status === 'renamed' && file.oldPath && file.newPath" class="mt-1 text-[11px] text-muted-foreground">
            {{ file.oldPath }} -> {{ file.newPath }}
          </div>

          <div v-if="file.isBinary" class="mt-1 text-[11px] text-muted-foreground">
            二进制文件，暂不支持文本对比。
          </div>
        </header>

        <div v-if="!file.isBinary" class="overflow-auto">
          <div
            v-for="(hunk, hunkIndex) in file.hunks"
            :key="`${file.id}-${hunkIndex}`"
            class="border-b border-border/40 last:border-b-0"
          >
            <div class="border-b border-border/50 bg-sky-500/8 px-3 py-1.5 font-mono text-[11px] text-sky-700 dark:text-sky-300">
              {{ hunk.header }}
            </div>

            <div v-if="viewMode === 'unified'" class="font-mono text-[12px] leading-6">
              <div
                v-for="(line, lineIndex) in hunk.lines"
                :key="`${file.id}-${hunkIndex}-${lineIndex}`"
                class="grid min-w-full grid-cols-[56px_56px_18px_minmax(0,1fr)]"
                :class="{
                  'bg-emerald-500/8': line.type === 'add',
                  'bg-rose-500/8': line.type === 'delete',
                  'bg-muted/20': line.type === 'meta',
                }"
              >
                <template v-if="line.type === 'meta'">
                  <div class="col-span-4 border-l-4 border-amber-500/20 px-3 py-0.5 text-[11px] text-muted-foreground">
                    {{ line.raw }}
                  </div>
                </template>

                <template v-else>
                  <div
                    class="select-none px-2 py-0.5 text-right text-[11px] font-medium tabular-nums"
                    :class="resolveLineNumberClass(line.type)"
                  >
                    {{ formatLineNumber(line.oldLineNumber) }}
                  </div>
                  <div
                    class="select-none px-2 py-0.5 text-right text-[11px] font-medium tabular-nums"
                    :class="resolveLineNumberClass(line.type)"
                  >
                    {{ formatLineNumber(line.newLineNumber) }}
                  </div>
                  <div
                    class="select-none px-1 py-0.5 text-center text-[11px] font-semibold"
                    :class="resolveMarkerColumnClass(line.type)"
                  >
                    {{ resolveLinePrefix(line) }}
                  </div>
                  <div class="min-w-0 px-3 py-0.5">
                    <code
                      class="block whitespace-pre-wrap break-words text-foreground"
                      v-html="renderCodeLine(line, file)"
                    />
                  </div>
                </template>
              </div>
            </div>

            <div v-else class="font-mono text-[12px] leading-6">
              <div
                v-for="(row, rowIndex) in resolveSplitRows(file, hunkIndex)"
                :key="`${file.id}-${hunkIndex}-split-${rowIndex}`"
              >
                <div
                  v-if="row.kind === 'meta'"
                  class="border-l-4 border-amber-500/20 bg-muted/20 px-3 py-0.5 text-[11px] text-muted-foreground"
                >
                  {{ row.metaText }}
                </div>

                <div
                  v-else
                  class="grid min-w-full grid-cols-2 divide-x divide-border/40"
                >
                  <div
                    class="grid min-w-0 grid-cols-[56px_18px_minmax(0,1fr)]"
                    :class="{
                      'bg-rose-500/8': row.left?.type === 'delete',
                      'bg-muted/5': row.left?.type === 'context',
                    }"
                  >
                    <div
                      class="select-none px-2 py-0.5 text-right text-[11px] font-medium tabular-nums"
                      :class="resolveLineNumberClass(row.left?.type)"
                    >
                      {{ formatLineNumber(row.left?.oldLineNumber ?? null) }}
                    </div>
                    <div
                      class="select-none px-1 py-0.5 text-center text-[11px] font-semibold"
                      :class="resolveMarkerColumnClass(row.left?.type)"
                    >
                      {{ row.left?.type === 'delete' ? '-' : '' }}
                    </div>
                    <div class="min-w-0 px-3 py-0.5">
                      <code
                        class="block whitespace-pre-wrap break-words text-foreground"
                        v-html="renderSplitCell(row.left, file, row.leftSegments)"
                      />
                    </div>
                  </div>

                  <div
                    class="grid min-w-0 grid-cols-[56px_18px_minmax(0,1fr)]"
                    :class="{
                      'bg-emerald-500/8': row.right?.type === 'add',
                      'bg-muted/5': row.right?.type === 'context',
                    }"
                  >
                    <div
                      class="select-none px-2 py-0.5 text-right text-[11px] font-medium tabular-nums"
                      :class="resolveLineNumberClass(row.right?.type)"
                    >
                      {{ formatLineNumber(row.right?.newLineNumber ?? null) }}
                    </div>
                    <div
                      class="select-none px-1 py-0.5 text-center text-[11px] font-semibold"
                      :class="resolveMarkerColumnClass(row.right?.type)"
                    >
                      {{ row.right?.type === 'add' ? '+' : '' }}
                    </div>
                    <div class="min-w-0 px-3 py-0.5">
                      <code
                        class="block whitespace-pre-wrap break-words text-foreground"
                        v-html="renderSplitCell(row.right, file, row.rightSegments)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="file.hunks.length === 0 && file.metaLines.length > 0"
            class="space-y-1 border-t border-border/40 px-3 py-2 font-mono text-[11px] text-muted-foreground"
          >
            <div v-for="(metaLine, metaIndex) in file.metaLines" :key="`${file.id}-meta-${metaIndex}`">
              {{ metaLine }}
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
:deep(.diff-inline-change) {
  border-radius: 0.2rem;
  background: color-mix(in oklab, var(--foreground) 12%, transparent);
}

:global(.dark) :deep(.diff-inline-change) {
  background: color-mix(in oklab, var(--foreground) 18%, transparent);
}
</style>
