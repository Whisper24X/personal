<script setup lang="ts">
import type { Skill } from '@/types/api/skills'

defineOptions({ name: 'BlmSkillsTab' })

const skillKeyword = defineModel<string>('skillKeyword', { required: true })

defineProps<{
  activeLineId: string
  loadingLocalSkills: boolean
  localSkills: Skill[]
  uploadingLocalSkill: boolean
}>()

const emit = defineEmits<{
  refresh: []
  search: []
  'open-upload': []
  preview: [item: Skill]
}>()
</script>

<template>
  <section class="space-y-4">
    <article class="panel-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-1 items-center gap-2">
          <input
            v-model="skillKeyword"
            class="h-9 min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
            placeholder="搜索名称 / 版本 / 说明"
            type="search"
            @keydown.enter.prevent="emit('search')"
          />
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
            :disabled="!activeLineId || loadingLocalSkills"
            @click="emit('refresh')"
          >
            刷新
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!activeLineId || loadingLocalSkills"
            @click="emit('search')"
          >
            搜索
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!activeLineId || uploadingLocalSkill"
            @click="emit('open-upload')"
          >
            上传技能
          </button>
        </div>
      </div>

      <div v-if="loadingLocalSkills" class="mt-3 text-sm text-muted-foreground">
        加载业务线本地 Skill 中...
      </div>

      <div v-else class="mt-3 space-y-2">
        <article
          v-for="item in localSkills"
          :key="item.id"
          class="cursor-pointer rounded-xl border border-border bg-background/70 px-4 py-3 transition hover:border-primary/40 hover:bg-muted/30"
          role="button"
          tabindex="0"
          @click="void emit('preview', item)"
          @keydown.enter.prevent="void emit('preview', item)"
          @keydown.space.prevent="void emit('preview', item)"
        >
          <p class="text-sm font-semibold">{{ item.name }}</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ item.description ?? '暂无描述' }}</p>
        </article>

        <div
          v-if="localSkills.length === 0"
          class="rounded-xl border border-dashed border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground"
        >
          当前业务线目录下未发现 Skill 配置。
        </div>
      </div>
    </article>
  </section>
</template>
