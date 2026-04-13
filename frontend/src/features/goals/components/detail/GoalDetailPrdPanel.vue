<script setup lang="ts">
import { MarkdownPreview } from '@features/knowledge-base'
import { Button } from '@shared/ui/button'
import { Loader2 } from 'lucide-vue-next'

defineOptions({
  name: 'GoalDetailPrdPanel',
})

const props = withDefaults(
  defineProps<{
    generatingPrd?: boolean
    prdDocPath?: string | null
    prdPreviewLoading: boolean
    prdEditorSaving: boolean
    prdPreviewError: string
    prdPreviewContent: string
  }>(),
  { generatingPrd: false },
)

const emit = defineEmits<{
  edit: []
}>()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      v-if="props.generatingPrd"
      class="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-4 py-8"
      role="status"
      aria-live="polite"
    >
      <Loader2 class="text-muted-foreground size-9 shrink-0 animate-spin" aria-hidden="true" />
      <div class="text-center">
        <p class="text-foreground text-sm font-medium">正在生成 PRD…</p>
        <p class="text-muted-foreground mt-1 max-w-sm text-xs">
          预计需要数十秒；刷新页面不会中断后台生成，本页会自动检测生成结果
        </p>
      </div>
    </div>
    <p v-else-if="!props.prdDocPath" class="text-muted-foreground text-sm">尚未生成 PRD</p>
    <template v-else>
      <div
        class="border-border/60 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b pb-2"
      >
        <p class="text-muted-foreground text-xs">文档路径：{{ props.prdDocPath }}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="shrink-0"
          :disabled="props.prdPreviewLoading || props.prdEditorSaving"
          @click="emit('edit')"
        >
          编辑
        </Button>
      </div>
      <div class="min-h-0 flex-1 overflow-auto pt-2">
        <div v-if="props.prdPreviewLoading" class="text-muted-foreground py-6 text-sm">
          加载 PRD 中…
        </div>
        <p v-else-if="props.prdPreviewError" class="text-destructive text-sm">
          {{ props.prdPreviewError }}
        </p>
        <div v-else class="bg-muted/20 rounded-md border border-border p-4">
          <MarkdownPreview :content="props.prdPreviewContent" />
        </div>
      </div>
    </template>
  </div>
</template>
