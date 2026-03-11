<script setup lang="ts">
import { computed, ref, watch } from 'vue'

defineOptions({
  name: 'TaskDetailReplyCard',
})

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    placeholder?: string
    running?: boolean
    actionLoading?: boolean
    canInterrupt?: boolean
  }>(),
  {
    disabled: false,
    placeholder: '补充指令或继续提问...',
    running: false,
    actionLoading: false,
    canInterrupt: false,
  },
)

const emit = defineEmits<{
  submit: [message: string]
  interrupt: []
}>()

const inputValue = ref('')
const isFocused = ref(false)

watch(
  () => props.disabled,
  (disabled) => {
    if (!disabled) {
      return
    }

    inputValue.value = ''
  },
)

const canSubmit = computed(() => {
  return !props.disabled && inputValue.value.trim().length > 0
})

const canTriggerAction = computed(() => {
  if (props.actionLoading) {
    return false
  }

  if (props.running) {
    return props.canInterrupt
  }

  return canSubmit.value
})

const actionAriaLabel = computed(() => {
  if (props.running) {
    return props.canInterrupt ? '停止当前执行' : '当前执行中'
  }

  return canSubmit.value ? '发送回复' : '请输入回复后发送'
})

const handleSubmit = () => {
  const message = inputValue.value.trim()
  if (!message || props.disabled) {
    return
  }

  emit('submit', message)
  inputValue.value = ''
}

const handleAction = () => {
  if (props.running) {
    if (!props.canInterrupt || props.actionLoading) {
      return
    }

    emit('interrupt')
    return
  }

  handleSubmit()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
    return
  }

  event.preventDefault()
  handleSubmit()
}
</script>

<template>
  <section class="border-border/50 bg-background rounded-xl border shadow-sm">
    <div class="p-3">
      <div
        class="relative rounded-lg border bg-muted/20 transition-colors"
        :class="isFocused ? 'border-primary/60 ring-2 ring-primary/10' : 'border-border/60 hover:border-border'"
      >
        <textarea
          v-model="inputValue"
          rows="4"
          aria-label="回复内容"
          class="min-h-[104px] w-full resize-none bg-transparent px-3 py-3 pr-16 text-sm leading-6 text-foreground placeholder:text-muted-foreground/55 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          :placeholder="props.placeholder"
          :disabled="props.disabled"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keydown="handleKeydown"
        />
        <button
          class="absolute bottom-3 right-3 inline-flex size-9 items-center justify-center rounded-md text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          :class="props.running ? 'bg-amber-500 hover:bg-amber-500/90' : 'bg-primary'"
          :aria-label="actionAriaLabel"
          :disabled="!canTriggerAction"
          type="button"
          @click="handleAction"
        >
          <svg v-if="props.running" class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6 4.75A.75.75 0 0 1 6.75 4h1.5a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75V4.75Zm5 0A.75.75 0 0 1 11.75 4h1.5a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75V4.75Z" />
          </svg>
          <svg v-else class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M3.105 3.105a.75.75 0 0 1 .826-.16l12.5 5a.75.75 0 0 1 0 1.39l-12.5 5A.75.75 0 0 1 2.9 13.75V11.1a.75.75 0 0 1 .554-.724l5.317-1.459-5.317-1.459A.75.75 0 0 1 2.9 6.733V4.25a.75.75 0 0 1 .205-.52Z" />
          </svg>
        </button>
      </div>
    </div>
  </section>
</template>
