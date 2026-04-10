<script setup lang="ts">
import { SkillTree } from '@features/skills'
import type { Skill, SkillTreeNode } from '@/types/api/skills'

defineOptions({
  name: 'BlmSkillPreviewModal',
})

defineProps<{
  title: string
  pathSubtitle: string
  item: Skill | null
  loadingTree: boolean
  tree: SkillTreeNode[]
  selectedPath: string
  expandedDirs: Set<string>
  fileLoading: boolean
  content: string
  error: string
  downloadingLocalSkillId: string
  removingLocalSkillId: string
}>()

const emit = defineEmits<{
  close: []
  download: [item: Skill]
  remove: [item: Skill]
  'select-file': [filePath: string]
  'toggle-dir': [dirPath: string]
}>()
</script>

<template>
  <div class="fixed inset-0 z-[126] flex items-center justify-center p-3 sm:p-6">
    <button
      type="button"
      class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      aria-label="关闭 Skill 预览弹窗"
      @click="emit('close')"
    />
    <section
      aria-modal="true"
      role="dialog"
      class="relative z-10 flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-background shadow-2xl"
    >
      <header class="flex items-center justify-between border-b border-border px-4 py-3">
        <div class="min-w-0 flex-1 space-y-1">
          <h2 class="text-base font-semibold">{{ title || 'Skill' }}</h2>
          <p class="truncate text-xs text-muted-foreground">
            {{ pathSubtitle || '技能目录' }}
          </p>
        </div>
        <div class="ml-4 flex shrink-0 items-center gap-2">
          <button
            v-if="item"
            type="button"
            class="inline-flex h-8 items-center justify-center rounded-md border border-primary/60 bg-primary/5 px-3 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="loadingTree || downloadingLocalSkillId === item.id"
            @click="emit('download', item)"
          >
            {{ downloadingLocalSkillId === item?.id ? '下载中...' : '下载' }}
          </button>
          <button
            v-if="item"
            type="button"
            class="inline-flex h-8 items-center justify-center rounded-md border border-destructive/60 bg-destructive/5 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="删除 Skill"
            :disabled="loadingTree || removingLocalSkillId === item.id"
            @click="emit('remove', item)"
          >
            {{ removingLocalSkillId === item?.id ? '删除中...' : '删除' }}
          </button>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="emit('close')"
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
        </div>
      </header>

      <div v-if="loadingTree" class="flex min-h-0 flex-1 px-4 py-6 text-sm text-muted-foreground">
        加载中...
      </div>
      <p
        v-else-if="error && tree.length === 0"
        class="flex min-h-0 flex-1 px-4 py-6 text-sm text-destructive"
      >
        {{ error }}
      </p>

      <div v-else class="flex min-h-0 flex-1">
        <aside class="w-52 flex-shrink-0 overflow-y-auto border-r border-border px-2 py-3">
          <SkillTree
            :nodes="tree"
            :selected-path="selectedPath"
            :expanded-dirs="expandedDirs"
            @select-file="emit('select-file', $event)"
            @toggle-dir="emit('toggle-dir', $event)"
          />

          <p v-if="tree.length === 0" class="px-2 py-2 text-xs text-muted-foreground">无文件</p>
        </aside>

        <div class="min-w-0 flex-1 overflow-y-auto px-4 py-3">
          <p v-if="fileLoading" class="text-sm text-muted-foreground">加载中...</p>
          <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
          <p v-else-if="!selectedPath" class="text-sm text-muted-foreground">请在左侧选择一个文件查看内容。</p>
          <pre
            v-else
            class="max-h-[62vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground"
            >{{ content || '文件内容为空。' }}</pre
          >
        </div>
      </div>

      <footer class="border-t border-border px-4 py-3">
        <button
          type="button"
          class="h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
          @click="emit('close')"
        >
          关闭
        </button>
      </footer>
    </section>
  </div>
</template>
