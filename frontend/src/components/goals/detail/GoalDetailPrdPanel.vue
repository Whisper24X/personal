<script setup lang="ts">
import MarkdownPreview from '@/components/knowledge-base/MarkdownPreview.vue'
import { Button } from '@/components/ui/button'

defineOptions({
  name: 'GoalDetailPrdPanel',
})

const props = defineProps<{
  prdDocPath?: string | null
  prdPreviewLoading: boolean
  prdEditorSaving: boolean
  prdPreviewError: string
  prdPreviewContent: string
}>()

const emit = defineEmits<{
  edit: []
}>()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <p v-if="!props.prdDocPath" class="text-muted-foreground text-sm">尚未生成 PRD</p>
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
