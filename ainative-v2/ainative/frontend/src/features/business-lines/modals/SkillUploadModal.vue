<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ProjectSkillProvider } from '@/types/api/skills'

const ALLOWED_EXTENSIONS = new Set(['.zip'])

const PROJECT_SKILL_PROVIDER_ORDER: ProjectSkillProvider[] = [
  'agents',
  'cursor',
  'gemini',
  'opencode',
  'claude',
  'codex',
]
const PROJECT_SKILL_PROVIDER_LABELS: Record<string, string> = {
  agents: '.agents/skills',
  codex: 'Codex',
  cursor: 'Cursor',
  curso: 'Cursor',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  claude: 'Claude Code',
}

/** 打开弹窗 / 重置 /「取消全选」时的默认勾选（与列表顺序：先有 .agents/skills，再有 Claude Code） */
const DEFAULT_UPLOAD_SKILL_PROVIDERS: ProjectSkillProvider[] = ['agents', 'claude']

const props = withDefaults(
  defineProps<{
    open: boolean
    submitting: boolean
    errorMessage?: string
    showTargetSelection?: boolean
    size?: 'default' | 'large'
  }>(),
  { showTargetSelection: true, size: 'default' },
)

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'submit', file: File, providers: ProjectSkillProvider[]): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const selectedProviders = ref<ProjectSkillProvider[]>([...DEFAULT_UPLOAD_SKILL_PROVIDERS])
const dragActive = ref(false)
const validationMessage = ref('')

const resetState = () => {
  selectedFile.value = null
  selectedProviders.value = [...DEFAULT_UPLOAD_SKILL_PROVIDERS]
  dragActive.value = false
  validationMessage.value = ''
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const selectAllProviders = () => {
  selectedProviders.value = [...PROJECT_SKILL_PROVIDER_ORDER]
}

const clearAllProviders = () => {
  selectedProviders.value = [...DEFAULT_UPLOAD_SKILL_PROVIDERS]
}

const close = () => {
  emit('update:open', false)
}

const sectionClass = computed(() => {
  return props.size === 'large'
    ? 'relative z-10 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl'
    : 'relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl'
})

const bodyClass = computed(() => {
  return props.size === 'large'
    ? 'max-h-[calc(95vh-56px)] space-y-4 overflow-y-auto px-4 py-4'
    : 'space-y-4 px-4 py-4'
})

const isAllowedFileName = (fileName: string) => {
  const lowerCaseName = fileName.toLowerCase()
  return Array.from(ALLOWED_EXTENSIONS).some((extension) => lowerCaseName.endsWith(extension))
}

const applyFile = (file: File | undefined) => {
  if (!file) {
    return
  }

  if (!isAllowedFileName(file.name)) {
    selectedFile.value = null
    validationMessage.value = '仅支持 .zip 文件'
    return
  }

  selectedFile.value = file
  validationMessage.value = ''
}

const onInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  applyFile(target?.files?.[0])
}

const openFileDialog = () => {
  fileInputRef.value?.click()
}

const onDragEnter = () => {
  dragActive.value = true
}

const onDragLeave = () => {
  dragActive.value = false
}

const onDrop = (event: DragEvent) => {
  event.preventDefault()
  dragActive.value = false
  applyFile(event.dataTransfer?.files?.[0])
}

const submit = () => {
  if (!selectedFile.value) {
    validationMessage.value = '请先选择一个技能包文件'
    return
  }

  if (props.showTargetSelection && selectedProviders.value.length === 0) {
    validationMessage.value = '请至少选择一个目标类型'
    return
  }

  validationMessage.value = ''
  emit(
    'submit',
    selectedFile.value,
    props.showTargetSelection ? selectedProviders.value : [],
  )
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    resetState()
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
        aria-label="关闭上传技能弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        aria-modal="true"
        role="dialog"
        :class="sectionClass"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="text-base font-semibold">上传技能</h2>
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

        <div :class="bodyClass">
          <button
            type="button"
            class="flex h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed px-3 text-sm transition"
            :class="
              dragActive
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/35'
            "
            @click="openFileDialog"
            @dragenter.prevent="onDragEnter"
            @dragover.prevent="onDragEnter"
            @dragleave.prevent="onDragLeave"
            @drop="onDrop"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="mb-2 opacity-70"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <p class="font-medium">拖放或点击以上传</p>
            <p v-if="selectedFile" class="mt-1 truncate text-xs text-foreground">
              {{ selectedFile.name }}
            </p>
          </button>

          <input
            ref="fileInputRef"
            type="file"
            class="hidden"
            accept=".zip"
            @change="onInputChange"
          />

          <section class="space-y-1.5">
            <p class="text-sm font-semibold">文件要求</p>
            <ul class="space-y-1 text-sm text-muted-foreground">
              <li>• 根目录下包含 SKILL.md 文件的 .zip</li>
              <li>• SKILL.md 包含以 YAML 格式编写的技能名称和描述</li>
            </ul>
          </section>

          <div v-if="props.showTargetSelection" class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-muted-foreground">添加到</label>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="text-xs text-muted-foreground underline hover:text-foreground"
                  @click="selectAllProviders"
                >
                  全选
                </button>
                <button
                  type="button"
                  class="text-xs text-muted-foreground underline hover:text-foreground"
                  @click="clearAllProviders"
                >
                  取消全选
                </button>
              </div>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-2">
              <label
                v-for="p in PROJECT_SKILL_PROVIDER_ORDER"
                :key="p"
                class="flex cursor-pointer items-center gap-2"
              >
                <input
                  v-model="selectedProviders"
                  type="checkbox"
                  :value="p"
                  class="h-4 w-4 rounded border-border"
                />
                <span class="text-sm">{{ PROJECT_SKILL_PROVIDER_LABELS[p] ?? p }}</span>
              </label>
            </div>
          </div>

          <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
          <p v-else-if="props.errorMessage" class="text-sm text-destructive">
            {{ props.errorMessage }}
          </p>

          <div class="flex justify-end gap-2 pt-1">
            <button
              type="button"
              class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              @click="close"
            >
              取消
            </button>
            <button
              type="button"
              class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.submitting || !selectedFile || (props.showTargetSelection && selectedProviders.length === 0)"
              @click="submit"
            >
              {{ props.submitting ? '上传中...' : '上传技能' }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
