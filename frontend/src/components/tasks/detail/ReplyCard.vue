<script setup lang="ts">
import { computed, ref, watch } from 'vue'

defineOptions({
  name: 'TaskDetailReplyCard',
})

const props = withDefaults(
  defineProps<{
    isRunning: boolean
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
  stop: []
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
    <div class="border-border/50 flex items-center justify-between gap-2 border-b px-3 py-2">
      <span class="text-muted-foreground text-xs font-semibold">Reply</span>
      <button
        class="h-7 rounded-md border border-border bg-background px-2 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="!props.isRunning"
        type="button"
        @click="emit('stop')"
      >
        停止执行
      </button>
    </div>

    <div class="space-y-2 px-3 py-2">
      <textarea
        v-model="inputValue"
        class="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        :placeholder="props.placeholder"
      />

      <div class="flex justify-end">
        <button
          class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!canSubmit"
          type="button"
          @click="handleSubmit"
        >
          提交回复
        </button>
      </div>
    </div>
  </section>
</template>
