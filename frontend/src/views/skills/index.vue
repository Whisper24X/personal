<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from '@/hooks'
import { skillsApi } from '@/api/skills'
import type { Skill } from '@/types/api/skills'
import { STORAGE_KEYS } from '@/types/common/storage'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'

defineOptions({
  name: 'SkillsManagementView',
})

const PAGE_LIMIT = 50
const MAX_PAGE_COUNT = 20
const PROJECT_SKILL_PROVIDER_LABELS: Record<string, string> = {
  codex: 'Codex',
  cursor: 'Cursor',
  curso: 'Cursor',
}

const route = useRoute()
const message = useMessage()

const loading = ref(false)
const keyword = ref('')
const skills = ref<Skill[]>([])
const detailSkill = ref<Skill | null>(null)
const detailContent = ref('')
const detailLoading = ref(false)
const detailErrorMessage = ref('')
const detailRequestToken = ref(0)

type SkillGroup = {
  id: string
  label: string
  items: Skill[]
}

const normalizeRouteParam = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return ''
}

const resolveStoredProjectId = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? ''
}

const activeProjectId = computed(() => {
  return normalizeRouteParam(route.query.projectId) || resolveStoredProjectId()
})

const readSourceProvider = (payload?: Record<string, unknown> | null) => {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const sourceProvider = payload.sourceProvider
  if (typeof sourceProvider !== 'string') {
    return ''
  }

  return sourceProvider.trim().toLowerCase()
}

const resolveSourcePath = (payload?: Record<string, unknown> | null) => {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const sourcePath = payload.sourcePath
  if (typeof sourcePath !== 'string') {
    return ''
  }

  return sourcePath.trim()
}

const resolveProviderKey = (item: Skill) => {
  const sourceProvider = readSourceProvider(item.metadataJson ?? null)
  if (sourceProvider) {
    return sourceProvider
  }

  const sourcePath = resolveSourcePath(item.metadataJson ?? null).replace(/\\/g, '/')
  if (sourcePath.includes('.codex/skills')) {
    return 'codex'
  }

  if (sourcePath.includes('.cursor/skills')) {
    return 'cursor'
  }

  if (sourcePath.includes('.curso/skills')) {
    return 'curso'
  }

  return 'project'
}

const groupedSkills = computed<SkillGroup[]>(() => {
  const groups = new Map<string, SkillGroup>()

  for (const item of skills.value) {
    const sourceProvider = resolveProviderKey(item)
    const groupLabel = PROJECT_SKILL_PROVIDER_LABELS[sourceProvider] ?? sourceProvider
    const currentGroup = groups.get(sourceProvider)

    if (!currentGroup) {
      groups.set(sourceProvider, {
        id: sourceProvider,
        label: groupLabel,
        items: [item],
      })
      continue
    }

    currentGroup.items.push(item)
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
})

const loadSkills = async () => {
  const projectId = activeProjectId.value

  if (!projectId) {
    skills.value = []
    return
  }

  loading.value = true

  try {
    const records = await fetchAllPages(
      (page, limit) => skillsApi.list({
        page,
        limit,
        keyword: keyword.value.trim() || undefined,
        projectId,
      }),
      {
        limit: PAGE_LIMIT,
        maxPages: MAX_PAGE_COUNT,
      },
    )

    skills.value = Array.from(new Map(records.map((item) => [item.id, item])).values())
  } catch (error) {
    message.error(toErrorMessage(error, '加载项目本地 Skill 列表失败'))
  } finally {
    loading.value = false
  }
}

const closeSkillDetail = () => {
  detailRequestToken.value += 1
  detailSkill.value = null
  detailContent.value = ''
  detailErrorMessage.value = ''
  detailLoading.value = false
}

const openSkillDetail = async (item: Skill) => {
  const projectId = activeProjectId.value
  if (!projectId) {
    return
  }

  detailSkill.value = item
  detailContent.value = ''
  detailErrorMessage.value = ''
  detailLoading.value = true
  const requestToken = ++detailRequestToken.value

  try {
    const response = await skillsApi.content(item.id, { projectId })
    if (requestToken !== detailRequestToken.value) {
      return
    }

    detailContent.value = response.content || ''
  } catch (error) {
    if (requestToken !== detailRequestToken.value) {
      return
    }

    detailErrorMessage.value = toErrorMessage(error, '加载 SKILL.md 失败')
  } finally {
    if (requestToken === detailRequestToken.value) {
      detailLoading.value = false
    }
  }
}

watch(
  () => activeProjectId.value,
  () => {
    closeSkillDetail()
    void loadSkills()
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-1 flex-wrap items-center gap-2">
          <input
            v-model="keyword"
            class="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 版本 / 说明"
            type="search"
          />
        </div>

        <div class="flex items-center gap-2">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="loadSkills"
          >
            刷新
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="loadSkills"
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

    <section v-else class="space-y-4">
      <article
        v-if="groupedSkills.length === 0"
        class="panel-card p-6 text-sm text-muted-foreground"
      >
        当前项目没有可读取的 Skill 本地配置。
      </article>

      <article
        v-for="group in groupedSkills"
        :key="group.id"
        class="panel-card p-4"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold">{{ group.label }}</p>
          <span class="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
            {{ group.items.length }} 项
          </span>
        </div>

        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="item in group.items"
            :key="item.id"
            role="button"
            class="cursor-pointer rounded-xl border border-border bg-background/70 px-4 py-3 transition-colors hover:border-foreground/20"
            tabindex="0"
            @click="openSkillDetail(item)"
            @keydown.enter.prevent="openSkillDetail(item)"
            @keydown.space.prevent="openSkillDetail(item)"
          >
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

            <p class="mt-3 text-xs text-muted-foreground">{{ item.description ?? '暂无描述' }}</p>

            <a
              v-if="item.homepageUrl"
              :href="item.homepageUrl"
              class="mt-3 inline-flex text-xs font-semibold text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
              @click.stop
            >
              查看说明
            </a>
          </article>
        </div>
      </article>
    </section>

    <Teleport to="body">
      <div
        v-if="detailSkill"
        class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
        @keydown.esc.prevent.stop="closeSkillDetail"
      >
        <button
          type="button"
          aria-label="关闭 Skill 详情弹窗"
          class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          @click="closeSkillDetail"
        />

        <section
          aria-modal="true"
          role="dialog"
          class="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-background shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 class="text-base font-semibold">{{ detailSkill.name }}</h2>
              <p class="text-xs text-muted-foreground">SKILL.md（只读）</p>
            </div>
            <button
              type="button"
              aria-label="关闭"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
              @click="closeSkillDetail"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <p v-if="detailLoading" class="text-sm text-muted-foreground">加载中...</p>
            <p v-else-if="detailErrorMessage" class="text-sm text-destructive">{{ detailErrorMessage }}</p>
            <pre
              v-else
              class="max-h-[62vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground"
            >{{ detailContent || '未读取到 SKILL.md 内容。' }}</pre>
          </div>

          <footer class="border-t border-border px-4 py-3">
            <button
              type="button"
              class="h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
              @click="closeSkillDetail"
            >
              关闭
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>
