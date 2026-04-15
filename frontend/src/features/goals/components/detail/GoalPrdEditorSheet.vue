<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@shared/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui/sheet'

defineOptions({
  name: 'GoalPrdEditorSheet',
})

const props = defineProps<{
  open: boolean
  prdEditorLoading: boolean
  prdEditorSaving: boolean
  prdEditorContent: string
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
</script>

<template>
  <Sheet :open="props.open" @update:open="emit('update:open', $event)">
    <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-hidden sm:max-w-3xl">
      <SheetHeader class="text-left">
        <SheetTitle class="pr-8 text-base">编辑 PRD</SheetTitle>
      </SheetHeader>
      <div class="min-h-0 flex-1 overflow-auto py-2">
        <div v-if="props.prdEditorLoading" class="text-muted-foreground text-sm">加载中…</div>
        <textarea
          v-else
          v-model="contentModel"
          class="border-input bg-background focus-visible:ring-ring font-mono h-[min(70vh,520px)] w-full resize-y rounded-md border p-3 text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2"
          spellcheck="false"
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
