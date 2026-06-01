<script setup lang="ts">
import type { Mcp } from '@/types/api/mcps'

defineOptions({ name: 'BlmMcpTab' })

defineProps<{
  activeLineId: string
  loadingLocalMcps: boolean
  localMcps: Mcp[]
  canViewMcpList: boolean
  canManageLocalMcp: boolean
  importingLocalMcps: boolean
}>()

const emit = defineEmits<{
  refresh: []
  'open-import': []
  preview: [item: Mcp]
}>()
</script>

<template>
  <section class="space-y-4">
    <article class="panel-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-sm font-semibold">MCP 列表</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button
            v-if="canViewMcpList"
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
            :disabled="!activeLineId || loadingLocalMcps"
            @click="emit('refresh')"
          >
            刷新
          </button>
          <button
            v-if="canManageLocalMcp"
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!activeLineId || importingLocalMcps"
            @click="emit('open-import')"
          >
            添加
          </button>
        </div>
      </div>

      <div
        v-if="!activeLineId"
        class="mt-3 rounded-xl border border-dashed border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground"
      >
        请先选择业务线。
      </div>
      <div
        v-else-if="!canViewMcpList"
        class="mt-3 rounded-xl border border-dashed border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground"
      >
        暂无查看 MCP 列表权限。
      </div>
      <div v-else-if="loadingLocalMcps" class="mt-3 text-sm text-muted-foreground">
        加载业务线本地 MCP 中...
      </div>

      <div v-else class="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
        <article
          v-for="item in localMcps"
          :key="item.id"
          :data-mcp-id="item.id"
          class="flex min-h-[6.5rem] cursor-pointer flex-col gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 py-2 transition hover:border-primary/40 hover:bg-muted/30"
          role="button"
          tabindex="0"
          @click="void emit('preview', item)"
          @keydown.enter.prevent="void emit('preview', item)"
          @keydown.space.prevent="void emit('preview', item)"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-semibold">{{ item.name }}</p>
            <p
              v-if="item.version && item.version !== 'local'"
              class="mt-1 text-[11px] text-muted-foreground"
            >
              版本：{{ item.version }}
            </p>
            <p
              v-if="item.description"
              class="mt-1 line-clamp-1 text-[11px] text-muted-foreground"
            >
              {{ item.description }}
            </p>
          </div>
        </article>

        <div
          v-if="localMcps.length === 0"
          class="col-span-full rounded-xl border border-dashed border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground"
        >
          当前业务线目录下未发现 MCP 配置。
        </div>
      </div>
    </article>
  </section>
</template>
