<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type {
  TaskEnvironmentStatus,
  TaskMode,
  TaskStatus,
  TaskWorkspaceSnapshotStatus,
} from '@/types/api/tasks'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/ui/tooltip'

defineOptions({
  name: 'TaskExecutionContextBar',
})

const props = defineProps<{
  mode: TaskMode
  status: TaskStatus
  statusLabel: string
  statusClass: string
  modeLabel: string
  subtitle: string
  environmentStatus?: TaskEnvironmentStatus | null
  environmentStatusLabel?: string
  environmentStatusClass?: string
  environmentStageLabel?: string
  workspaceSnapshotStatus?: TaskWorkspaceSnapshotStatus | null
  workspaceSnapshotError?: string | null
  actionLoading: boolean
  showRegenerateRunnerConfig?: boolean
  canRegenerateRunnerConfig?: boolean
  regenerateRunnerConfigBlockedReason?: string
  canStartEnvironment?: boolean
  canExecute: boolean
  canCompleteTask: boolean
  canReset: boolean
  canTerminate?: boolean
  canRemove?: boolean
  regenerateRunnerConfigLoading?: boolean
  regenerateRunnerConfigPreparing?: boolean
  rightPanelVisible?: boolean
}>()

const emit = defineEmits<{
  execute: []
  regenerateRunnerConfig: []
  startEnvironment: []
  completeTask: []
  reset: []
  terminate: []
  refresh: []
  remove: []
  toggleRightPanel: []
}>()

const moreMenuOpen = ref(false)
const moreMenuRef = ref<HTMLDivElement | null>(null)

function handleClickOutside(e: MouseEvent) {
  if (moreMenuRef.value && !moreMenuRef.value.contains(e.target as Node)) {
    moreMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true)
})

const showPrimaryActions = computed(() => {
  return Boolean(props.canStartEnvironment) || props.canExecute || props.canCompleteTask
})

const canShowMoreActions = computed(() => {
  return (
    Boolean(props.showRegenerateRunnerConfig) ||
    props.canReset ||
    Boolean(props.canTerminate) ||
    Boolean(props.canRemove)
  )
})

const environmentBadgeLabel = computed(() => {
  if (!props.environmentStatusLabel) {
    return ''
  }

  if (props.environmentStatus === 'ready') {
    return `环境${props.environmentStatusLabel}`
  }

  return `环境 ${props.environmentStatusLabel}`
})
const workspaceSnapshotBadge = computed(() => {
  if (props.workspaceSnapshotStatus === 'pushing') {
    return {
      label: 'snapshot 后台同步中',
      className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    }
  }
  if (props.workspaceSnapshotStatus === 'failed') {
    return {
      label: 'snapshot 同步失败',
      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      title: props.workspaceSnapshotError ?? undefined,
    }
  }
  return null
})

const regenerateRunnerActionLoading = computed(
  () => props.regenerateRunnerConfigLoading || props.regenerateRunnerConfigPreparing,
)
</script>

<template>
  <section
    class="border-border/50 bg-background/95 w-full shrink-0 rounded-none border shadow-sm"
    aria-label="任务执行上下文"
  >
    <TooltipProvider :delay-duration="0">
      <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <span
            v-if="environmentBadgeLabel"
            class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            :class="props.environmentStatusClass || 'bg-muted text-muted-foreground'"
          >
            {{ environmentBadgeLabel }}
          </span>
          <span
            v-if="workspaceSnapshotBadge"
            class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            :class="workspaceSnapshotBadge.className"
            :title="workspaceSnapshotBadge.title"
          >
            {{ workspaceSnapshotBadge.label }}
          </span>
          <span
            class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            :class="props.statusClass"
          >
            {{ props.statusLabel }}
          </span>
          <span class="text-muted-foreground truncate text-[11px] leading-snug">
            {{ props.modeLabel }} · {{ props.subtitle }}
          </span>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <button
            v-if="props.canStartEnvironment"
            class="inline-flex h-8 items-center rounded-md border border-border/70 bg-background px-3 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="props.actionLoading"
            type="button"
            @click="emit('startEnvironment')"
          >
            启动环境
          </button>
          <button
            v-if="props.canExecute"
            class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="props.actionLoading"
            type="button"
            @click="emit('execute')"
          >
            开始
          </button>
          <button
            v-if="props.canCompleteTask"
            class="inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="props.actionLoading"
            type="button"
            @click="emit('completeTask')"
          >
            完成
          </button>
          <span
            v-if="showPrimaryActions"
            class="bg-border/70 mx-0.5 hidden h-5 w-px shrink-0 self-center sm:block"
            aria-hidden="true"
          />

          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="flex size-8 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                type="button"
                aria-label="刷新对话区"
                @click="emit('refresh')"
              >
                <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.364.363a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.112-.231Zm-1.624-8.3a.75.75 0 0 0-1.112-.231A5.5 5.5 0 0 0 3.576 5.36l.312.311H1.455a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V2.787a.75.75 0 0 0-1.5 0v2.033l-.364-.363A7 7 0 0 1 15.688 7.595a.75.75 0 0 0-2-4.471Z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" :side-offset="0">刷新对话区</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="flex size-8 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                type="button"
                :aria-label="props.rightPanelVisible ? '收起右侧面板' : '展开右侧面板'"
                @click="emit('toggleRightPanel')"
              >
                <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    v-if="props.rightPanelVisible"
                    fill-rule="evenodd"
                    d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
                    clip-rule="evenodd"
                  />
                  <path
                    v-else
                    fill-rule="evenodd"
                    d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5.25a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" :side-offset="0">
              {{ props.rightPanelVisible ? '收起右侧面板' : '展开右侧面板' }}
            </TooltipContent>
          </Tooltip>
          <div v-if="canShowMoreActions" ref="moreMenuRef" class="relative">
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  class="flex size-8 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  type="button"
                  aria-label="更多操作"
                  @click="moreMenuOpen = !moreMenuOpen"
                >
                  <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM15.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" :side-offset="0">更多操作</TooltipContent>
            </Tooltip>

            <Transition
              enter-active-class="transition duration-100 ease-out"
              leave-active-class="transition duration-75 ease-in"
              enter-from-class="opacity-0 scale-95"
              leave-to-class="opacity-0 scale-95"
            >
              <div
                v-if="moreMenuOpen"
                class="border-border bg-background absolute right-0 top-full z-30 mt-1 min-w-[120px] rounded-lg border py-1 shadow-lg"
              >
              <button
                v-if="props.showRegenerateRunnerConfig"
                class="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                :title="
                  props.canRegenerateRunnerConfig ? undefined : props.regenerateRunnerConfigBlockedReason
                "
                :disabled="
                  props.actionLoading ||
                  props.regenerateRunnerConfigLoading ||
                  props.regenerateRunnerConfigPreparing ||
                  !props.canRegenerateRunnerConfig
                "
                type="button"
                @click="
                  moreMenuOpen = false;
                  emit('regenerateRunnerConfig');
                "
              >
                <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.364.363a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.112-.231Zm-1.624-8.3a.75.75 0 0 0-1.112-.231A5.5 5.5 0 0 0 3.576 5.36l.312.311H1.455a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V2.787a.75.75 0 0 0-1.5 0v2.033l-.364-.363A7 7 0 0 1 15.688 7.595a.75.75 0 0 0-2-4.471Z"
                    clip-rule="evenodd"
                  />
                </svg>
                {{ regenerateRunnerActionLoading ? '准备中...' : '重置配置' }}
              </button>
              <button
                v-if="props.canReset"
                class="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="props.actionLoading"
                type="button"
                @click="
                  moreMenuOpen = false;
                  emit('reset');
                "
              >
                <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.364.363a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.112-.231Zm-1.624-8.3a.75.75 0 0 0-1.112-.231A5.5 5.5 0 0 0 3.576 5.36l.312.311H1.455a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V2.787a.75.75 0 0 0-1.5 0v2.033l-.364-.363A7 7 0 0 1 15.688 7.595a.75.75 0 0 0-2-4.471Z"
                    clip-rule="evenodd"
                  />
                </svg>
                重置
              </button>
              <button
                v-if="props.canTerminate"
                class="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="props.actionLoading"
                type="button"
                @click="
                  moreMenuOpen = false;
                  emit('terminate');
                "
              >
                <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M5.25 3A2.25 2.25 0 0 0 3 5.25v9.5A2.25 2.25 0 0 0 5.25 17h9.5A2.25 2.25 0 0 0 17 14.75v-9.5A2.25 2.25 0 0 0 14.75 3h-9.5ZM8 7.75A.75.75 0 0 1 8.75 7h2.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75h-2.5A.75.75 0 0 1 8 12.25v-4.5Z"
                    clip-rule="evenodd"
                  />
                </svg>
                终止
              </button>
              <button
                v-if="props.canRemove"
                class="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="props.actionLoading"
                type="button"
                @click="
                  moreMenuOpen = false;
                  emit('remove');
                "
              >
                <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022 1.005 11.36A2.75 2.75 0 0 0 7.76 20h4.48a2.75 2.75 0 0 0 2.742-2.53l1.005-11.36.149.022a.75.75 0 1 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.8l-.5 5.5a.75.75 0 0 1-1.495-.137l.5-5.5a.75.75 0 0 1 .795-.662Zm2.84 0a.75.75 0 0 1 .795.662l.5 5.5a.75.75 0 1 1-1.495.136l-.5-5.5a.75.75 0 0 1 .7-.798Z"
                    clip-rule="evenodd"
                  />
                </svg>
                删除
              </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </TooltipProvider>
  </section>
</template>
