<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from '@/hooks'
import { skillsApi } from '@/api/skills'
import type { Skill } from '@/types/api/skills'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'SkillsManagementView',
})

const PAGE_LIMIT = 30

const route = useRoute()
const message = useMessage()

const loading = ref(false)
const loadingMore = ref(false)
const keyword = ref('')
const enabledOnly = ref(false)
const skills = ref<Skill[]>([])
const page = ref(1)
const hasNextPage = ref(false)

const normalizeRouteParam = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return ''
}

const activeProjectId = computed(() => normalizeRouteParam(route.query.projectId))

const resolveCatalogSourcePath = (payload?: Record<string, unknown> | null) => {
  if (!payload || typeof payload !== 'object') {
    return '-'
  }

  const sourcePath = payload.sourcePath
  if (typeof sourcePath !== 'string') {
    return '-'
  }

  const normalized = sourcePath.trim()
  return normalized || '-'
}

const loadSkills = async (reset = true) => {
  const projectId = activeProjectId.value

  if (!projectId) {
    skills.value = []
    hasNextPage.value = false
    page.value = 1
    return
  }

  const nextPage = reset ? 1 : page.value + 1

  if (reset) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const response = await skillsApi.list({
      page: nextPage,
      limit: PAGE_LIMIT,
      keyword: keyword.value.trim() || undefined,
      enabled: enabledOnly.value ? true : undefined,
      projectId,
    })

    if (reset) {
      skills.value = response.data
    } else {
      const existingIds = new Set(skills.value.map((item) => item.id))
      skills.value = skills.value.concat(
        response.data.filter((item) => !existingIds.has(item.id)),
      )
    }

    page.value = nextPage
    hasNextPage.value = response.hasNextPage
  } catch (error) {
    message.error(toErrorMessage(error, '加载项目本地 Skill 列表失败'))
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

watch(
  () => activeProjectId.value,
  () => {
    void loadSkills(true)
  },
)

onMounted(() => {
  void loadSkills(true)
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">技能（Skill）</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">项目本地 Skill 管理</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        当前页面读取项目本地 Agent CLI 配置（如 `.codex/.cursor`）中的 Skill 列表。
      </p>
      <p class="font-mono text-xs text-muted-foreground">
        当前项目：{{ activeProjectId || '未选择项目' }}
      </p>
    </section>

    <section class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-1 flex-wrap items-center gap-2">
          <input
            v-model="keyword"
            class="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 版本 / 说明"
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
            @click="loadSkills(true)"
          >
            刷新
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="loadSkills(true)"
          >
            搜索
          </button>
        </div>
      </div>
    </section>

    <section
      v-if="!activeProjectId"
      class="panel-card p-6 text-sm text-muted-foreground"
    >
      请先在左侧选择项目后再查看 Skill。
    </section>

    <section v-else-if="loading" class="panel-card p-6 text-sm text-muted-foreground">加载中...</section>

    <section v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="item in skills" :key="item.id" class="panel-card p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ item.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">版本：{{ item.version }}</p>
          </div>
          <span
            class="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold"
            :class="item.enabled ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
          >
            {{ item.enabled ? '已启用' : '已停用' }}
          </span>
        </div>

        <p class="mt-3 text-xs text-muted-foreground">范围：{{ item.scope ?? '-' }}</p>
        <p class="mt-2 text-xs text-muted-foreground">{{ item.description ?? '暂无描述' }}</p>
        <p class="mt-2 font-mono text-[11px] text-muted-foreground">
          {{ resolveCatalogSourcePath(item.metadataJson ?? null) }}
        </p>

        <a
          v-if="item.homepageUrl"
          :href="item.homepageUrl"
          class="mt-4 inline-flex text-xs font-semibold text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          查看说明
        </a>
      </article>

      <article v-if="skills.length === 0" class="panel-card p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
        当前项目没有可读取的 Skill 本地配置。
      </article>
    </section>

    <section v-if="activeProjectId && !loading && hasNextPage" class="panel-card p-4">
      <button
        class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loadingMore"
        type="button"
        @click="loadSkills(false)"
      >
        {{ loadingMore ? '加载中...' : '加载更多' }}
      </button>
    </section>
  </div>
</template>
