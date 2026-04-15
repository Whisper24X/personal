<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  submitting: boolean
  initialName: string
  initialDescription: string
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'submit', payload: { name: string; description: string }): void
}>()

const name = ref('')
const description = ref('')
const validationMessage = ref('')
const dialogRef = ref<HTMLElement | null>(null)
const nameInputRef = ref<HTMLInputElement | null>(null)

let previousBodyOverflow = ''

const close = () => {
  emit('update:open', false)
}

const syncFormValues = () => {
  name.value = props.initialName
  description.value = props.initialDescription
  validationMessage.value = ''
}

const submit = () => {
  const trimmedName = name.value.trim()

  if (!trimmedName) {
    validationMessage.value = '业务线名称不能为空'
    return
  }

  validationMessage.value = ''
  emit('submit', {
    name: trimmedName,
    description: description.value,
  })
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      syncFormValues()
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      await nextTick()
      dialogRef.value?.focus()
      nameInputRef.value?.focus()
      return
    }

    document.body.style.overflow = previousBodyOverflow
  },
)

watch(
  () => [props.initialName, props.initialDescription, props.mode],
  () => {
    if (!props.open) {
      return
    }

    syncFormValues()
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[93] flex items-center justify-center p-3 sm:p-6"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭业务线表单弹窗"
        class="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="business-line-form-modal-title"
        class="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl"
        tabindex="-1"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="business-line-form-modal-title" class="text-sm font-semibold">
            {{ props.mode === 'edit' ? '编辑业务线' : '创建业务线' }}
          </h2>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="close"
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
        </header>

        <form class="space-y-3 px-4 py-4" @submit.prevent="submit">
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">名称</span>
            <input
              ref="nameInputRef"
              v-model="name"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="例如：Retail"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">描述（可选）</span>
            <input
              v-model="description"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="例如：零售业务线"
            />
          </label>

          <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>

          <div class="flex justify-end gap-2 pt-1">
            <button
              type="button"
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              @click="close"
            >
              取消
            </button>
            <button
              type="submit"
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.submitting"
            >
              {{ props.submitting ? '保存中...' : props.mode === 'edit' ? '保存修改' : '创建业务线' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
