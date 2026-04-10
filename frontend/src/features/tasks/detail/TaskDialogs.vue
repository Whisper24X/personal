<script setup lang="ts">
import { reactive, watch } from 'vue'

export type TaskEditFormValue = {
  title: string
  prompt: string
  gitBranch: string
  agentCliId: string
  agentCliConfigId: string
}

defineOptions({
  name: 'TaskDetailDialogs',
})

const props = withDefaults(
  defineProps<{
    editOpen: boolean
    deleteOpen: boolean
    saving?: boolean
    removing?: boolean
    editForm: TaskEditFormValue
  }>(),
  {
    saving: false,
    removing: false,
  },
)

const emit = defineEmits<{
  'update:editOpen': [value: boolean]
  'update:deleteOpen': [value: boolean]
  save: [payload: TaskEditFormValue]
  remove: []
}>()

const localEditForm = reactive<TaskEditFormValue>({
  title: '',
  prompt: '',
  gitBranch: '',
  agentCliId: '',
  agentCliConfigId: '',
})

watch(
  () => props.editOpen,
  (open) => {
    if (!open) {
      return
    }

    localEditForm.title = props.editForm.title
    localEditForm.prompt = props.editForm.prompt
    localEditForm.gitBranch = props.editForm.gitBranch
    localEditForm.agentCliId = props.editForm.agentCliId
    localEditForm.agentCliConfigId = props.editForm.agentCliConfigId
  },
)

const submitEdit = () => {
  emit('save', {
    title: localEditForm.title,
    prompt: localEditForm.prompt,
    gitBranch: localEditForm.gitBranch,
    agentCliId: localEditForm.agentCliId,
    agentCliConfigId: localEditForm.agentCliConfigId,
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.editOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-edit-modal-title"
      @click.self="emit('update:editOpen', false)"
    >
      <section class="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="task-edit-modal-title" class="text-sm font-semibold">编辑任务</h2>
          <button
            class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
            type="button"
            aria-label="关闭任务编辑弹窗"
            @click="emit('update:editOpen', false)"
          >
            关闭
          </button>
        </header>

        <form class="grid gap-3 px-4 py-4" @submit.prevent="submitEdit">
          <label class="space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">任务标题</span>
            <input
              v-model="localEditForm.title"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              type="text"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">提示词</span>
            <textarea
              v-model="localEditForm.prompt"
              class="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">分支</span>
            <input
              v-model="localEditForm.gitBranch"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              type="text"
            />
          </label>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">CLI 工具 ID</span>
              <input
                v-model="localEditForm.agentCliId"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">CLI 配置 ID</span>
              <input
                v-model="localEditForm.agentCliConfigId"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>
          </div>

          <div class="flex justify-end gap-2">
            <button
              class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
              type="button"
              @click="emit('update:editOpen', false)"
            >
              取消
            </button>
            <button
              class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.saving"
              type="submit"
            >
              {{ props.saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="props.deleteOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-delete-modal-title"
      @click.self="emit('update:deleteOpen', false)"
    >
      <section class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <header class="border-b border-border px-4 py-3">
          <h2 id="task-delete-modal-title" class="text-sm font-semibold">删除任务</h2>
        </header>

        <div class="space-y-2 px-4 py-4 text-sm text-muted-foreground">
          <p>该操作会删除任务记录，无法恢复。</p>
          <p>如果任务正在运行，请先停止任务。</p>
        </div>

        <div class="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
            type="button"
            @click="emit('update:deleteOpen', false)"
          >
            取消
          </button>
          <button
            class="h-9 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="props.removing"
            type="button"
            @click="emit('remove')"
          >
            {{ props.removing ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
