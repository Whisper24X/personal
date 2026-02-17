<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { skillsApi } from '@/api/skills'
import type { Skill } from '@/types/api/skills'

const loading = ref(false)
const errorMessage = ref('')
const keyword = ref('')
const enabledOnly = ref(false)
const skills = ref<Skill[]>([])

const loadSkills = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await skillsApi.list({
      page: 1,
      limit: 60,
      keyword: keyword.value.trim() || undefined,
      enabled: enabledOnly.value ? true : undefined,
    })

    skills.value = response.data
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载 Skills 列表失败'
  } finally {
    loading.value = false
  }
}

const filteredSkills = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) {
    return skills.value
  }

  return skills.value.filter((skill) => {
    const description = skill.description ?? ''
    const scope = skill.scope ?? ''

    return (
      skill.name.toLowerCase().includes(query) ||
      skill.version.toLowerCase().includes(query) ||
      description.toLowerCase().includes(query) ||
      scope.toLowerCase().includes(query)
    )
  })
})

onMounted(() => {
  void loadSkills()
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">技能（Skill）</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">Skill 市场</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        查看平台可用 Skills，支持按名称、版本、范围检索，并按项目配置进行白名单约束。
      </p>
      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
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

    <section v-if="loading" class="panel-card p-6 text-sm text-muted-foreground">加载中...</section>

    <section v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="item in filteredSkills" :key="item.id" class="panel-card p-4">
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

      <article v-if="filteredSkills.length === 0" class="panel-card p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
        没有匹配的 Skill。
      </article>
    </section>
  </div>
</template>
