<script setup lang="ts">
import { computed } from 'vue'
import type { TaskEnvironment } from '@/types/api/tasks'

defineOptions({
  name: 'TaskEnvironmentGate',
})

const props = defineProps<{
  title: string
  environment: TaskEnvironment | null
  actionLoading: boolean
  canStart: boolean
  canRemove: boolean
  removeLoading: boolean
  formatDate: (value?: string) => string
}>()

const emit = defineEmits<{
  start: []
  refresh: []
  remove: []
}>()

const statusLabelMap: Record<string, string> = {
  not_started: '未启动',
  starting: '启动中',
  ready: '已就绪',
  failed: '启动失败',
  stopping: '释放中',
  stopped: '已释放',
}

const statusClassMap: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  starting: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  ready: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-destructive/10 text-destructive',
  stopping: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  stopped: 'bg-muted text-muted-foreground',
}

const statusLabel = computed(() => {
  return statusLabelMap[props.environment?.status ?? 'not_started'] ?? '执行环境'
})

const statusClass = computed(() => {
  return statusClassMap[props.environment?.status ?? 'not_started'] ?? 'bg-muted text-muted-foreground'
})

const isStarting = computed(() => props.environment?.status === 'starting')
const shouldShowSteps = computed(() => {
  return props.environment?.status === 'starting' || props.environment?.status === 'failed'
})
const stageMeta = computed(() => {
  if (!shouldShowSteps.value) {
    return []
  }

  const items: string[] = []
  if (props.environment?.stageLabel) {
    items.push(props.environment.stageLabel)
  }

  const formattedDate = props.formatDate(props.environment?.updatedAt)
  if (formattedDate && formattedDate !== '-') {
    items.push(`${formattedDate} 更新`)
  }

  return items
})

const headerEyebrow = computed(() => {
  if (props.environment?.status === 'starting') {
    return '环境启动中'
  }

  if (props.environment?.status === 'failed') {
    return '环境状态'
  }

  return '环境状态'
})

const headerTitle = computed(() => {
  if (props.environment?.status === 'starting') {
    return '正在为当前任务启动执行环境'
  }

  if (props.environment?.status === 'failed') {
    return '任务环境启动失败'
  }

  if (props.environment?.status === 'stopped') {
    return '当前任务环境已释放'
  }

  return '当前任务环境尚未启动'
})

const shouldShowHeaderCopy = computed(() => {
  const status = props.environment?.status ?? 'not_started'

  return status === 'starting' || status === 'failed'
})

const helperText = computed(() => {
  if (props.environment?.status === 'starting') {
    return props.environment?.message || '当前任务的执行容器正在拉起，启动过程会在当前区域实时展示。'
  }

  if (props.environment?.status === 'failed') {
    return props.environment?.message || '重新启动后会再次尝试准备工作区、分配资源并拉起执行容器。'
  }

  if (props.environment?.status === 'stopped') {
    return '重新启动后即可恢复终端、预览与任务执行能力。'
  }

  return '启动后这里会直接切换为实时启动舞台，展示工作区准备、资源分配和容器拉起过程。'
})

const primaryActionLabel = computed(() => {
  if (props.environment?.status === 'failed') {
    return '重试启动'
  }

  if (props.environment?.status === 'stopped') {
    return '重新启动环境'
  }

  return '启动环境'
})
</script>

<template>
  <section class="relative isolate flex h-full min-h-0 w-full overflow-hidden">
    <div class="absolute inset-0 bg-background/68 backdrop-blur-md" />
    <div class="environment-orb environment-orb-left" />
    <div class="environment-orb environment-orb-right" />
    <div class="environment-grid absolute inset-0 opacity-60" />

    <div class="relative z-10 flex h-full w-full min-h-0 overflow-hidden">
      <div class="bg-background/82 flex min-h-0 w-full flex-1 flex-col overflow-hidden backdrop-blur-2xl">
        <header
          class="border-border/60 bg-background/24 shrink-0 border-b px-6 pb-6 pt-7 lg:px-10 lg:pb-7 lg:pt-9"
        >
          <div class="flex flex-wrap items-start justify-between gap-6">
            <div class="max-w-3xl space-y-4">
              <div class="flex flex-wrap items-center gap-3">
                <div class="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  {{ headerEyebrow }}
                </div>
                <span
                  class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                  :class="statusClass"
                >
                  {{ statusLabel }}
                </span>
              </div>

              <div class="space-y-2">
                <template v-if="shouldShowHeaderCopy">
                  <h1 class="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
                    {{ headerTitle }}
                  </h1>
                  <p class="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
                    {{ helperText }}
                  </p>
                </template>
                <div class="text-sm text-muted-foreground">
                  任务：<span class="font-medium text-foreground">{{ props.title }}</span>
                </div>
              </div>
            </div>

            <div class="flex shrink-0 flex-wrap items-center gap-3">
              <button
                class="inline-flex h-11 items-center rounded-xl border border-border/70 bg-background/70 px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                :disabled="props.actionLoading"
                @click="emit('refresh')"
              >
                刷新状态
              </button>
              <button
                class="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_32px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                type="button"
                :disabled="!props.canStart || props.actionLoading"
                @click="emit('start')"
              >
                <span v-if="isStarting" class="environment-button-spinner mr-2" />
                {{ primaryActionLabel }}
              </button>
              <button
                v-if="props.canRemove"
                class="inline-flex h-11 items-center rounded-xl border border-destructive/25 bg-destructive/8 px-5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/12 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                :disabled="props.actionLoading || props.removeLoading"
                @click="emit('remove')"
              >
                {{ props.removeLoading ? '删除中...' : '删除任务' }}
              </button>
            </div>
          </div>

        </header>

        <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div class="environment-stage-beam" />

          <Transition name="gate-panel" mode="out-in">
            <div
              v-if="shouldShowSteps"
              key="steps"
              class="flex min-h-0 flex-1 flex-col overflow-hidden bg-background/16 px-6 pb-8 pt-7 lg:px-10 lg:pb-10"
            >
              <div class="mx-auto flex w-full max-w-4xl min-h-0 flex-1 flex-col">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div class="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      启动过程
                    </div>
                    <div class="mt-2 text-lg font-semibold text-foreground">
                      执行容器正在启动
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center justify-end gap-2">
                    <div
                      v-if="stageMeta.length > 0"
                      class="text-xs text-muted-foreground"
                    >
                      {{ stageMeta.join(' · ') }}
                    </div>
                    <div
                      v-if="isStarting"
                      class="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-700 dark:text-sky-300"
                    >
                      <span class="environment-live-dot" />
                      实时进行中
                    </div>
                  </div>
                </div>

                <TransitionGroup
                  name="step-flow"
                  tag="div"
                  class="mt-6 flex min-h-0 flex-1 flex-col gap-3 overflow-auto pr-1"
                >
                  <div
                    v-for="(step, index) in props.environment?.steps ?? []"
                    :key="step.key"
                    class="environment-step-card border-border/60 relative flex items-start gap-4 rounded-[1.6rem] border px-4 py-4 backdrop-blur-sm"
                    :class="{
                      'bg-sky-500/[0.06] shadow-[0_0_0_1px_rgba(14,165,233,0.12)]': step.status === 'in_progress',
                      'bg-emerald-500/[0.06]': step.status === 'done',
                      'bg-destructive/[0.06]': step.status === 'error',
                      'bg-background/35 opacity-65': step.status === 'pending',
                    }"
                    :style="{ transitionDelay: `${index * 80}ms` }"
                  >
                    <div
                      class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      :class="{
                        'bg-muted text-muted-foreground': step.status === 'pending',
                        'environment-step-indicator-active bg-sky-500/10 text-sky-700 dark:text-sky-300': step.status === 'in_progress',
                        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300': step.status === 'done',
                        'bg-destructive/10 text-destructive': step.status === 'error',
                      }"
                    >
                      <span v-if="step.status === 'done'">✓</span>
                      <span v-else-if="step.status === 'error'">!</span>
                      <span v-else-if="step.status === 'in_progress'">...</span>
                      <span v-else>{{ index + 1 }}</span>
                    </div>

                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-medium text-foreground">
                        {{ step.label }}
                      </div>
                      <div v-if="step.message" class="mt-1 text-xs leading-6 text-muted-foreground">
                        {{ step.message }}
                      </div>
                    </div>

                    <div
                      v-if="step.status === 'in_progress'"
                      class="environment-step-glow absolute inset-y-0 right-0 w-24"
                    />
                  </div>
                </TransitionGroup>
              </div>
            </div>

            <div
              v-else
              key="idle"
              class="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 py-10 text-center lg:px-10"
            >
              <div class="relative mx-auto flex w-full max-w-4xl flex-col items-center">
                <div class="environment-idle-halo environment-idle-halo-left" />
                <div class="environment-idle-halo environment-idle-halo-right" />

                <div class="environment-idle-core">
                  <div class="environment-idle-ring environment-idle-ring-outer" />
                  <div class="environment-idle-ring environment-idle-ring-inner" />
                  <div class="environment-idle-center" />
                </div>

                <div class="mt-8 max-w-2xl space-y-4">
                  <div class="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    容器待启动
                  </div>
                  <div class="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
                    启动当前任务的独立执行容器
                  </div>
                  <p class="text-sm leading-7 text-muted-foreground sm:text-[15px]">
                    主操作固定在页面顶部。点击启动后，当前区域会直接切换成实时启动舞台，展示任务工作区准备、资源分配、容器拉起和环境就绪过程。
                  </p>
                </div>

                <div class="mt-10 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
                  <div class="border-border/60 bg-background/44 rounded-2xl border px-4 py-3 backdrop-blur-sm">
                    <div class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      容器粒度
                    </div>
                    <div class="mt-2 text-sm font-medium text-foreground">每个任务独立一容器</div>
                  </div>
                  <div class="border-border/60 bg-background/44 rounded-2xl border px-4 py-3 backdrop-blur-sm">
                    <div class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      启动后
                    </div>
                    <div class="mt-2 text-sm font-medium text-foreground">才显示过程流</div>
                  </div>
                  <div class="border-border/60 bg-background/44 rounded-2xl border px-4 py-3 backdrop-blur-sm">
                    <div class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      就绪后
                    </div>
                    <div class="mt-2 text-sm font-medium text-foreground">才能执行任务</div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.environment-orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  opacity: 0.7;
  animation: orbFloat 14s ease-in-out infinite;
}

.environment-orb-left {
  top: 6%;
  left: -6%;
  height: 18rem;
  width: 18rem;
  background: rgba(14, 165, 233, 0.16);
}

.environment-orb-right {
  right: -8%;
  bottom: -2%;
  height: 20rem;
  width: 20rem;
  background: rgba(16, 185, 129, 0.15);
  animation-delay: -6s;
}

.environment-grid {
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.09) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.09) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.7), transparent 80%);
}

.environment-stage-beam {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at top, rgba(14, 165, 233, 0.08), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 42%);
}

.environment-button-spinner {
  height: 0.95rem;
  width: 0.95rem;
  border-radius: 9999px;
  border: 2px solid rgba(255, 255, 255, 0.28);
  border-top-color: currentColor;
  animation: spin 0.8s linear infinite;
}

.environment-live-dot {
  height: 0.45rem;
  width: 0.45rem;
  border-radius: 9999px;
  background: currentColor;
  animation: livePulse 1.6s ease-in-out infinite;
}

.environment-step-indicator-active {
  box-shadow: 0 0 0 8px rgba(14, 165, 233, 0.08);
  animation: stepPulse 1.8s ease-in-out infinite;
}

.environment-step-glow {
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(14, 165, 233, 0.14));
  border-top-right-radius: 1rem;
  border-bottom-right-radius: 1rem;
  animation: shimmer 1.8s linear infinite;
}

.environment-idle-halo {
  position: absolute;
  border-radius: 9999px;
  filter: blur(70px);
  opacity: 0.72;
}

.environment-idle-halo-left {
  top: 12%;
  left: 12%;
  height: 11rem;
  width: 11rem;
  background: rgba(14, 165, 233, 0.12);
}

.environment-idle-halo-right {
  right: 10%;
  bottom: 10%;
  height: 12rem;
  width: 12rem;
  background: rgba(16, 185, 129, 0.11);
}

.environment-idle-core {
  position: relative;
  display: flex;
  height: 10rem;
  width: 10rem;
  align-items: center;
  justify-content: center;
}

.environment-idle-ring {
  position: absolute;
  border-radius: 9999px;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.environment-idle-ring-outer {
  height: 10rem;
  width: 10rem;
  animation: idleOrbit 8s linear infinite;
}

.environment-idle-ring-inner {
  height: 6.75rem;
  width: 6.75rem;
  animation: idleOrbitReverse 6s linear infinite;
}

.environment-idle-center {
  height: 2.75rem;
  width: 2.75rem;
  border-radius: 9999px;
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.9), rgba(14, 165, 233, 0.12)),
    rgba(255, 255, 255, 0.82);
  box-shadow:
    0 0 0 14px rgba(255, 255, 255, 0.08),
    0 12px 32px rgba(15, 23, 42, 0.14);
}

.gate-panel-enter-active,
.gate-panel-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease;
}

.gate-panel-enter-from,
.gate-panel-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.step-flow-enter-active,
.step-flow-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease;
}

.step-flow-enter-from,
.step-flow-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@keyframes orbFloat {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(0, -18px, 0) scale(1.06);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes livePulse {
  0%,
  100% {
    transform: scale(0.9);
    opacity: 0.55;
  }

  50% {
    transform: scale(1.15);
    opacity: 1;
  }
}

@keyframes stepPulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.16);
  }

  50% {
    box-shadow: 0 0 0 10px rgba(14, 165, 233, 0.06);
  }
}

@keyframes shimmer {
  0% {
    opacity: 0.2;
    transform: translateX(10px);
  }

  50% {
    opacity: 0.6;
  }

  100% {
    opacity: 0.15;
    transform: translateX(-8px);
  }
}

@keyframes idleOrbit {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes idleOrbitReverse {
  from {
    transform: rotate(360deg);
  }

  to {
    transform: rotate(0deg);
  }
}
</style>
