<script setup lang="ts">
import { computed, nextTick, ref, useAttrs, watch } from 'vue'
import { WORKFLOW_PROMPT_VARIABLES } from '@shared/constants/workflow'

defineOptions({
  name: 'WorkflowPromptTextarea',
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  {
    placeholder: '输入该节点的提示词，输入 / 可插入变量',
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

type SlashCommandState = {
  start: number
  end: number
  query: string
}

const attrs = useAttrs()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const slashCommand = ref<SlashCommandState | null>(null)
const activeIndex = ref(0)

const slashMenuVisible = computed(() => {
  return slashCommand.value !== null
})

const filteredVariables = computed(() => {
  const query = slashCommand.value?.query.trim().toLowerCase() ?? ''
  if (!query) {
    return WORKFLOW_PROMPT_VARIABLES
  }

  return WORKFLOW_PROMPT_VARIABLES.filter((item) => {
    return item.key.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
  })
})

watch(filteredVariables, (variables) => {
  if (variables.length === 0) {
    activeIndex.value = 0
    return
  }

  if (activeIndex.value >= variables.length) {
    activeIndex.value = 0
  }
})

const closeSlashMenu = () => {
  slashCommand.value = null
  activeIndex.value = 0
}

const formatWorkflowPromptVariable = (key: string) => {
  return `{{${key}}}`
}

const resolveSlashCommand = (value: string, caret: number | null): SlashCommandState | null => {
  if (caret === null || caret < 0) {
    return null
  }

  const textBeforeCaret = value.slice(0, caret)
  const slashIndex = textBeforeCaret.lastIndexOf('/')
  if (slashIndex < 0) {
    return null
  }

  const previousChar = textBeforeCaret[slashIndex - 1] ?? ''
  if (slashIndex > 0 && !/\s/.test(previousChar)) {
    return null
  }

  const query = textBeforeCaret.slice(slashIndex + 1)
  if (/\s/.test(query) || query.includes('{') || query.includes('}')) {
    return null
  }

  return {
    start: slashIndex,
    end: caret,
    query,
  }
}

const syncSlashMenu = (caret: number | null) => {
  slashCommand.value = resolveSlashCommand(props.modelValue, caret)
  if (slashCommand.value === null) {
    activeIndex.value = 0
  }
}

const updateModelValue = (value: string, caret: number | null) => {
  emit('update:modelValue', value)
  slashCommand.value = resolveSlashCommand(value, caret)
  if (slashCommand.value === null) {
    activeIndex.value = 0
  }
}

const insertVariable = async (key: string) => {
  if (!slashCommand.value) {
    return
  }

  const replacement = `{{${key}}}`
  const nextValue =
    props.modelValue.slice(0, slashCommand.value.start) +
    replacement +
    props.modelValue.slice(slashCommand.value.end)
  const nextCaret = slashCommand.value.start + replacement.length

  emit('update:modelValue', nextValue)
  closeSlashMenu()

  await nextTick()

  textareaRef.value?.focus()
  textareaRef.value?.setSelectionRange(nextCaret, nextCaret)
}

const onInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  updateModelValue(target.value, target.selectionStart)
}

const onCaretChange = () => {
  syncSlashMenu(textareaRef.value?.selectionStart ?? null)
}

const onBlur = () => {
  closeSlashMenu()
}

const onKeydown = async (event: KeyboardEvent) => {
  if (!slashMenuVisible.value) {
    return
  }

  const availableVariables = filteredVariables.value

  if (event.key === 'Escape') {
    event.preventDefault()
    closeSlashMenu()
    return
  }

  if (availableVariables.length === 0) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % availableVariables.length
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value =
      (activeIndex.value - 1 + availableVariables.length) % availableVariables.length
    return
  }

  if (event.key === 'Enter' || event.key === 'Tab') {
    const activeVariable = availableVariables[activeIndex.value]
    if (!activeVariable) {
      return
    }

    event.preventDefault()
    await insertVariable(activeVariable.key)
  }
}
</script>

<template>
  <div class="relative">
    <textarea
      ref="textareaRef"
      :value="props.modelValue"
      :placeholder="props.placeholder"
      class="min-h-[76px] w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
      v-bind="attrs"
      @input="onInput"
      @keydown="onKeydown"
      @click="onCaretChange"
      @keyup="onCaretChange"
      @blur="onBlur"
    />

    <div
      v-if="slashMenuVisible"
      class="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-xl border border-border bg-background p-2 shadow-xl"
    >
      <p class="px-2 pb-1 text-[11px] text-muted-foreground">
        输入 <span class="font-semibold text-foreground">/</span> 搜索变量，回车即可插入
      </p>

      <div v-if="filteredVariables.length > 0" class="max-h-56 space-y-1 overflow-auto">
        <button
          v-for="(item, index) in filteredVariables"
          :key="item.key"
          type="button"
          class="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition"
          :class="
            index === activeIndex
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          "
          @mousedown.prevent
          @click="void insertVariable(item.key)"
        >
          <span class="font-mono text-[11px]">{{ formatWorkflowPromptVariable(item.key) }}</span>
          <span class="ml-3 text-[11px]">{{ item.description }}</span>
        </button>
      </div>

      <p v-else class="px-2 py-2 text-[11px] text-muted-foreground">未找到匹配变量</p>
    </div>
  </div>
</template>
