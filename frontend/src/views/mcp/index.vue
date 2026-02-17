<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { mcpsApi } from '@/api/mcps'
import type { Mcp } from '@/types/api/mcps'

const loading = ref(false)
const errorMessage = ref('')
const keyword = ref('')
const enabledOnly = ref(false)
const mcps = ref<Mcp[]>([])

const loadMcps = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await mcpsApi.list({
      page: 1,
      limit: 60,
      keyword: keyword.value.trim() || undefined,
      enabled: enabledOnly.value ? true : undefined,
    })

    mcps.value = response.data
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载 MCP 列表失败'
  } finally {
    loading.value = false
  }
}

const filteredMcps = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) {
    return mcps.value
  }

  return mcps.value.filter((mcp) => {
    const description = mcp.description ?? ''
    const provider = mcp.provider ?? ''

    return (
      mcp.name.toLowerCase().includes(query) ||
      mcp.version.toLowerCase().includes(query) ||
      description.toLowerCase().includes(query) ||
      provider.toLowerCase().includes(query)
    )
  })
})

onMounted(() => {
  void loadMcps()
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MCP</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">MCP 市场</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        浏览平台可用 MCP 连接器，查看版本、提供方与工具数量，结合项目配置进行可用范围治理。
      </p>
      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
    </section>

    <section class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-1 flex-wrap items-center gap-2">
          <input
            v-model="keyword"
            class="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 版本 / 提供方"
            type="search"
          />
          <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input v-model="enabledOnly" class="h-4 w-4" type="checkbox" />
            仅显示启用
          </label>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="loadMcps"
          >
            刷新
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="loadMcps"
          >
            搜索
          </button>
        </div>
      </div>
    </section>

    <section v-if="loading" class="panel-card p-6 text-sm text-muted-foreground">加载中...</section>

    <section v-else class="panel-card p-5">
      <div class="space-y-3">
        <article
          v-for="server in filteredMcps"
          :key="server.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/70 px-4 py-3"
        >
          <div>
            <p class="text-sm font-semibold">{{ server.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">
              版本：{{ server.version }} · 提供方：{{ server.provider ?? '-' }} · 工具数量：{{ server.toolsCount }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">{{ server.description ?? '暂无描述' }}</p>
          </div>
          <span
            class="rounded-full px-2 py-1 text-[10px] font-semibold"
            :class="server.enabled ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
          >
            {{ server.enabled ? '已启用' : '已停用' }}
          </span>
        </article>

        <article v-if="filteredMcps.length === 0" class="rounded-xl border border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground">
          没有匹配的 MCP 连接器。
        </article>
      </div>
    </section>
  </div>
</template>
