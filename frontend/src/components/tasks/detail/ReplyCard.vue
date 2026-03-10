<script setup lang="ts">
import { computed, ref, watch } from 'vue'

defineOptions({
  name: 'TaskDetailReplyCard',
})

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    placeholder?: string
  }>(),
  {
    disabled: false,
    placeholder: '补充指令或继续提问...',
  },
)

const emit = defineEmits<{
  submit: [message: string]
}>()

const inputValue = ref('')

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

const handleSubmit = () => {
  const message = inputValue.value.trim()
  if (!message || props.disabled) {
    return
  }

  emit('submit', message)
  inputValue.value = ''
}
</script>

<template>
  <section class="border-border/50 bg-background rounded-xl border shadow-sm">
    <div class="px-3 pb-2 pt-2.5">
      <textarea
        v-model="inputValue"
        rows="3"
        class="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        @keydown.meta.enter="handleSubmit"
        @keydown.ctrl.enter="handleSubmit"
      />

      <div class="flex items-center justify-between pt-1">
        <span class="text-[10px] text-muted-foreground/40">⌘ Enter 发送</span>
        <button
          class="inline-flex h-6 items-center rounded-md bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!canSubmit"
          type="button"
          @click="handleSubmit"
        >
          发送
        </button>
      </div>
    </div>
  </section>
</template>
