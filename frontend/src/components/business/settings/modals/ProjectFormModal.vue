<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  submitting: boolean
  initialName: string
  initialDescription: string
  initialGitUrl: string
  initialDefaultBranch: string
  errorMessage?: string
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'submit', payload: { name: string; description: string; gitUrl: string; defaultBranch: string }): void
}>()

const name = ref('')
const description = ref('')
const gitUrl = ref('')
const defaultBranch = ref('main')
const validationMessage = ref('')

const modalTitle = computed(() => {
  return props.mode === 'edit' ? '编辑项目' : '创建项目'
})

const syncFormValues = () => {
  name.value = props.initialName
  description.value = props.initialDescription
  gitUrl.value = props.initialGitUrl
  defaultBranch.value = props.initialDefaultBranch || 'main'
  validationMessage.value = ''
}

const close = () => {
  emit('update:open', false)
}

const submit = () => {
  if (!name.value.trim()) {
    validationMessage.value = '项目名称不能为空'
    return
  }

  if (!gitUrl.value.trim()) {
    validationMessage.value = 'Git 仓库地址不能为空'
    return
  }

  if (!defaultBranch.value.trim()) {
    validationMessage.value = '默认分支不能为空'
    return
  }

  validationMessage.value = ''
  emit('submit', {
    name: name.value.trim(),
    description: description.value,
    gitUrl: gitUrl.value.trim(),
    defaultBranch: defaultBranch.value.trim(),
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
  () => [props.initialName, props.initialDescription, props.initialGitUrl, props.initialDefaultBranch, props.mode],
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
        aria-label="关闭项目表单弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        aria-modal="true"
        role="dialog"
        class="relative z-10 w-full max-w-xl rounded-2xl border border-border bg-background shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="text-sm font-semibold">{{ modalTitle }}</h2>
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
            <span class="text-xs font-semibold text-muted-foreground">项目名称</span>
            <input
              v-model="name"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="输入项目名称"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">描述（可选）</span>
            <input
              v-model="description"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="输入项目描述"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">Git 仓库地址</span>
            <input
              v-model="gitUrl"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="git@gitlab.example.com:group/project.git"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">默认分支</span>
            <input
              v-model="defaultBranch"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="main"
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
              {{ props.submitting ? '保存中...' : props.mode === 'edit' ? '保存修改' : '创建项目' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
