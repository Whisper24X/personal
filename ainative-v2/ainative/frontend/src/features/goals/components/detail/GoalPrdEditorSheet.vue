<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MarkdownPreview } from '@features/knowledge-base'
import { Button } from '@shared/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui/sheet'
import GoalPrdAiChatPanel from './GoalPrdAiChatPanel.vue'

defineOptions({
  name: 'GoalPrdEditorSheet',
})

const props = defineProps<{
  open: boolean
  prdEditorLoading: boolean
  prdEditorSaving: boolean
  prdEditorContent: string
  projectId?: string | null
  prdDocPath?: string | null
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  'update:prdEditorContent': [value: string]
  save: []
}>()

const contentModel = computed({
  get: () => props.prdEditorContent,
  set: (value: string) => emit('update:prdEditorContent', value),
})

const editorTab = ref<'preview' | 'source'>('preview')

watch(
  () => props.open,
  (open) => {
    if (open) {
      editorTab.value = 'preview'
    }
  },
)

const showAiPanel = computed(
  () =>
    Boolean(props.projectId?.trim()) &&
    Boolean(props.prdDocPath?.trim()) &&
    !props.prdEditorLoading,
)

const aiDisabled = computed(() => props.prdEditorSaving || props.prdEditorLoading)

const onApplyFromAi = (value: string) => {
  emit('update:prdEditorContent', value)
}
</script>

<template>
  <Sheet :open="props.open" @update:open="emit('update:open', $event)">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 overflow-hidden sm:max-w-4xl"
    >
      <SheetHeader class="text-left">
        <SheetTitle class="pr-8 text-base">编辑 PRD</SheetTitle>
      </SheetHeader>

      <div class="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden px-4 py-2">
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div v-if="props.prdEditorLoading" class="text-muted-foreground text-sm">加载中…</div>

          <template v-else>
            <div class="mb-2 flex shrink-0 flex-wrap items-center gap-2">
              <div class="inline-flex rounded-md border border-border bg-muted/30 p-0.5 shadow-sm">
                <button
                  class="rounded px-2 py-1 text-xs transition"
                  :class="
                    editorTab === 'preview'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  type="button"
                  @click="editorTab = 'preview'"
                >
                  预览
                </button>
                <button
                  class="rounded px-2 py-1 text-xs transition"
                  :class="
                    editorTab === 'source'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  type="button"
                  @click="editorTab = 'source'"
                >
                  源码
                </button>
              </div>
            </div>

            <div
              v-show="editorTab === 'preview'"
              class="border-input bg-muted/10 min-h-0 flex-1 overflow-auto rounded-md border p-3"
            >
              <MarkdownPreview :content="props.prdEditorContent" />
            </div>

            <textarea
              v-show="editorTab === 'source'"
              v-model="contentModel"
              class="border-input bg-background focus-visible:ring-ring font-mono min-h-0 w-full flex-1 resize-y rounded-md border p-3 text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2"
              spellcheck="false"
            />
          </template>
        </div>

        <GoalPrdAiChatPanel
          v-if="showAiPanel"
          :project-id="props.projectId ?? ''"
          :prd-doc-path="props.prdDocPath ?? ''"
          :disabled="aiDisabled"
          @apply="onApplyFromAi"
        />
      </div>

      <SheetFooter class="border-border flex flex-row justify-end gap-2 border-t py-4">
        <Button
          type="button"
          variant="outline"
          :disabled="props.prdEditorSaving || props.prdEditorLoading"
          @click="emit('update:open', false)"
        >
          取消
        </Button>
        <Button
          type="button"
          :disabled="props.prdEditorSaving || props.prdEditorLoading"
          @click="emit('save')"
        >
          {{ props.prdEditorSaving ? '保存中…' : '保存' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
