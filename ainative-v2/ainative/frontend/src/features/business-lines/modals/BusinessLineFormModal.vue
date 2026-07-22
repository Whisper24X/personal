<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  submitting: boolean
  initialName: string
  initialSlug?: string
  initialDescription: string
  errorMessage?: string
  size?: 'default' | 'large'
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'submit', payload: { name: string; slug?: string; description: string }): void
}>()

const name = ref('')
const slug = ref('')
const description = ref('')
const validationMessage = ref('')

const modalTitle = computed(() => {
  return props.mode === 'edit' ? '编辑业务线' : '创建业务线'
})

const sectionClass = computed(() => {
  return props.size === 'large'
    ? 'relative z-10 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl'
    : 'relative z-10 w-full max-w-xl rounded-2xl border border-border bg-background shadow-2xl'
})

const formClass = computed(() => {
  return props.size === 'large'
    ? 'max-h-[calc(95vh-56px)] space-y-3 overflow-y-auto px-4 py-4'
    : 'space-y-3 px-4 py-4'
})

const syncFormValues = () => {
  name.value = props.initialName
  slug.value = props.initialSlug ?? ''
  description.value = props.initialDescription
  validationMessage.value = ''
}

const close = () => {
  emit('update:open', false)
}

const submit = () => {
  if (!name.value.trim()) {
    validationMessage.value = '业务线名称不能为空'
    return
  }

  if (props.mode === 'create' && !slug.value.trim()) {
    validationMessage.value = '业务线标识不能为空'
    return
  }

  validationMessage.value = ''
  emit('submit', {
    name: name.value.trim(),
    slug: props.mode === 'create' ? slug.value.trim() : undefined,
    description: description.value,
  })
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    syncFormValues()
  },
)

watch(
  () => [props.initialName, props.initialSlug, props.initialDescription, props.mode],
  () => {
    if (!props.open) {
      return
    }

    syncFormValues()
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭业务线编辑弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        aria-modal="true"
        role="dialog"
        :class="sectionClass"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="business-line-form-modal-title" class="text-sm font-semibold">{{ modalTitle }}</h2>
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

        <form :class="formClass" @submit.prevent="submit">
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">业务线名称</span>
            <input
              v-model="name"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="例如：Retail"
            />
          </label>

          <label v-if="props.mode === 'create'" class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">业务线标识</span>
            <input
              v-model="slug"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm text-foreground"
              placeholder="例如：retail"
            />
            <p class="text-[11px] text-muted-foreground">
              创建后不可修改；项目分支名为 <span class="font-mono">{slug}-项目标识</span>
            </p>
          </label>
          <p
            v-else-if="props.initialSlug"
            class="text-[11px] text-muted-foreground"
          >
            业务线标识：<span class="font-mono">{{ props.initialSlug }}</span>
          </p>

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
          <p v-else-if="props.errorMessage" class="text-sm text-destructive">{{ props.errorMessage }}</p>

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
