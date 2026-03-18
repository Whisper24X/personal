<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { WORKFLOW_PROMPT_VARIABLES } from '@/constants/workflow'

defineOptions({
  name: 'WorkflowPromptVariablesHint',
})

const VARIABLE_GROUPS = [
  {
    title: '任务',
    keys: ['taskId', 'taskTitle', 'taskPrompt'],
  },
  {
    title: 'Git',
    keys: ['gitBranch', 'gitBaseBranch', 'gitWorktree', 'gitWorktreePath'],
  },
  {
    title: '项目',
    keys: ['projectId', 'projectName', 'projectGitUrl', 'projectDefaultBranch'],
  },
] as const

const props = withDefaults(
  defineProps<{
    variant?: 'card' | 'popover'
  }>(),
  {
    variant: 'card',
  },
)

const rootRef = ref<HTMLElement | null>(null)
const popoverOpen = ref(false)

const formatWorkflowPromptVariable = (key: string) => {
  return `{{${key}}}`
}

const variableGroups = VARIABLE_GROUPS.map((group) => {
  return {
    title: group.title,
    items: group.keys
      .map((key) => WORKFLOW_PROMPT_VARIABLES.find((item) => item.key === key))
      .filter((item) => item !== undefined),
  }
})

const closePopover = () => {
  popoverOpen.value = false
}

const togglePopover = () => {
  popoverOpen.value = !popoverOpen.value
}

const handleDocumentPointerDown = (event: Event) => {
  if (!(event.target instanceof Node)) {
    return
  }

  if (!rootRef.value?.contains(event.target)) {
    closePopover()
  }
}

watch(popoverOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    return
  }

  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <div
    v-if="props.variant === 'card'"
    class="rounded-xl border border-dashed border-border/70 bg-muted/30 p-3"
  >
    <p class="text-[11px] font-semibold text-muted-foreground">提示词变量</p>
    <div class="mt-2 space-y-1 text-[11px] leading-5 text-muted-foreground">
      <p>
        1. 在节点 Prompt 中输入 <span class="font-semibold text-foreground">/</span>
        ，可搜索并插入变量。
      </p>
      <p>
        2. 插入格式为
        <span class="font-mono text-foreground">{{
          formatWorkflowPromptVariable('taskPrompt')
        }}</span>
        。
      </p>
      <p>3. 只支持白名单变量；未识别变量会原样保留，不会注入环境变量或密钥。</p>
    </div>
    <div class="mt-3 space-y-2">
      <div v-for="group in variableGroups" :key="group.title" class="space-y-1">
        <p class="text-[11px] font-semibold text-muted-foreground">{{ group.title }}</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="item in group.items"
            :key="item.key"
            class="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground"
          >
            {{ formatWorkflowPromptVariable(item.key) }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <div v-else ref="rootRef" class="relative">
    <button
      type="button"
      class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-muted-foreground transition hover:text-foreground hover:shadow-sm"
      aria-label="查看工作流 Prompt 变量说明"
      @click="togglePopover"
    >
      ?
    </button>

    <div
      v-if="popoverOpen"
      class="absolute left-0 top-9 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-3 shadow-xl"
    >
      <p class="text-[11px] font-semibold text-muted-foreground">Prompt 变量说明</p>
      <div
        class="mt-2 rounded-lg border border-border bg-muted/20 p-2 text-[11px] leading-5 text-muted-foreground"
      >
        <p>
          1. 输入 <span class="font-semibold text-foreground">/</span>，搜索变量后按回车即可插入。
        </p>
        <p>
          2. 变量会以
          <span class="font-mono text-foreground">{{
            formatWorkflowPromptVariable('taskPrompt')
          }}</span>
          的形式写入 Prompt。
        </p>
        <p>3. 只会注入下列白名单变量；未识别变量会原样保留，不会读取环境变量或密钥。</p>
      </div>
      <div class="mt-3 max-h-72 space-y-3 overflow-auto pr-1">
        <div v-for="group in variableGroups" :key="group.title" class="space-y-2">
          <p class="text-[11px] font-semibold text-muted-foreground">{{ group.title }}</p>
          <div class="space-y-1">
            <div
              v-for="item in group.items"
              :key="item.key"
              class="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 px-2.5 py-2"
            >
              <span class="font-mono text-[11px] text-foreground">
                {{ formatWorkflowPromptVariable(item.key) }}
              </span>
              <span class="text-[11px] text-muted-foreground">{{ item.description }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
