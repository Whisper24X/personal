<script setup lang="ts">
import { toRef } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import AppSelect from '@shared/components/select'
import {
  GOAL_CREATE_SELECT_PANEL_PLACEMENT,
  GOAL_CREATE_SELECT_PANEL_Z_INDEX,
} from '@shared/constants/task-goal-create-ui'
import { formatFileSize } from '@shared/utils/project-doc-upload'
import {
  useGoalCreatePanel,
  type GoalCreatePanelProps,
} from './use-goal-create-panel'

defineOptions({
  name: 'GoalCreatePanel',
})

const props = withDefaults(defineProps<GoalCreatePanelProps>(), {
  projectId: '',
})

const vm = useGoalCreatePanel(props)
const fileInputRef = toRef(vm, 'fileInputRef')
</script>

<template>
  <div
    class="fade-up flex min-h-[calc(var(--app-viewport-height)-8rem)] items-center justify-center px-4 py-8 sm:px-8"
  >
    <div class="w-full max-w-[1120px]">
      <div v-if="vm.loading" class="py-24 text-center text-sm text-muted-foreground">加载中...</div>

      <template v-else>
        <header class="mb-8 flex flex-col items-center text-center sm:mb-10">
          <div
            class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-foreground/80"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5z" />
            </svg>
          </div>
          <Transition name="headline-fade" mode="out-in">
            <h1
              :key="vm.currentHeadline"
              class="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl"
            >
              {{ vm.currentHeadline }}
            </h1>
          </Transition>
        </header>

        <form
          class="overflow-hidden rounded-3xl border border-border bg-card/90 shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
          @submit.prevent="vm.submit"
        >
          <div
            class="flex min-h-[360px] flex-col px-5 pt-5 sm:px-6 sm:pt-6"
          >
            <input
              v-model="vm.form.title"
              type="text"
              maxlength="200"
              placeholder="输入你的目标"
              class="w-full shrink-0 border-0 bg-transparent text-lg font-medium text-foreground outline-none placeholder:text-muted-foreground"
            />
            <textarea
              v-model="vm.form.summary"
              class="mt-4 min-h-0 flex-1 resize-none border-0 bg-transparent px-1 text-lg text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="摘要（可选）"
            />
          </div>

          <div v-if="vm.selectedFiles.length > 0" class="mx-5 mb-2 flex flex-wrap gap-2 sm:mx-6">
            <span
              v-for="(file, index) in vm.selectedFiles"
              :key="`${file.name}-${file.size}-${file.lastModified}`"
              class="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
            >
              <span class="max-w-[220px] truncate">{{ file.name }}</span>
              <span class="text-muted-foreground">{{ formatFileSize(file.size) }}</span>
              <button
                type="button"
                class="rounded-full text-muted-foreground transition hover:text-foreground"
                aria-label="移除文件"
                @click="vm.removeFile(index)"
              >
                ×
              </button>
            </span>
          </div>

          <div class="border-t border-border">
            <div class="overflow-x-auto px-4 py-3 sm:px-5">
              <div class="flex min-w-full w-max flex-nowrap items-center gap-2 [&>*]:shrink-0">
                <input
                  ref="fileInputRef"
                  type="file"
                  multiple
                  accept=".zip,.md,.markdown,application/zip,text/markdown"
                  class="hidden"
                  @change="vm.onFilesSelected"
                />
                <button
                  type="button"
                  class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground/80 transition hover:bg-muted"
                  aria-label="添加文件"
                  @click="vm.openFilePicker"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </button>

                <AppSelect
                  v-model="vm.form.agentCliId"
                  aria-label="Agent CLI"
                  :block="false"
                  :match-trigger-width="false"
                  :trigger-label-truncate="false"
                  :option-label-truncate="false"
                  :options="vm.configuredCliToolOptions"
                  :disabled="vm.loadingAgentConfigs || vm.configuredCliTools.length === 0"
                  :panel-z-index="GOAL_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="GOAL_CREATE_SELECT_PANEL_PLACEMENT"
                  size="lg"
                  trigger-class="min-w-[120px] rounded-full border-border bg-background pl-3 pr-3 text-sm font-medium shadow-none"
                >
                  <template #prefix>
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
                      class="text-foreground/70"
                      aria-hidden="true"
                    >
                      <path d="M4 17 10 11 4 5" />
                      <path d="M12 19h8" />
                    </svg>
                  </template>
                </AppSelect>

                <AppSelect
                  v-model="vm.form.gitBaseBranch"
                  aria-label="Git 基准分支"
                  :block="false"
                  :match-trigger-width="false"
                  :trigger-label-truncate="false"
                  :option-label-truncate="false"
                  :options="vm.gitBaseBranchOptions"
                  :disabled="vm.loadingBranches || vm.branchOptions.length === 0"
                  :panel-z-index="GOAL_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="GOAL_CREATE_SELECT_PANEL_PLACEMENT"
                  size="lg"
                  trigger-class="min-w-[120px] max-w-[200px] rounded-full border-border bg-background pl-3 pr-3 text-sm font-medium shadow-none"
                >
                  <template #prefix>
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
                      class="text-foreground/70"
                      aria-hidden="true"
                    >
                      <line x1="6" x2="6" y1="3" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                  </template>
                </AppSelect>

                <AppSelect
                  v-model="vm.form.agentCliConfigId"
                  aria-label="Agent CLI 配置"
                  :block="false"
                  :match-trigger-width="false"
                  :trigger-label-truncate="false"
                  :option-label-truncate="false"
                  :options="vm.agentToolConfigOptions"
                  :disabled="vm.loadingAgentConfigs || vm.agentToolConfigs.length === 0"
                  :panel-z-index="GOAL_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="GOAL_CREATE_SELECT_PANEL_PLACEMENT"
                  size="lg"
                  trigger-class="min-w-[120px] rounded-full border-border bg-background pl-3 pr-3 text-sm font-medium shadow-none"
                >
                  <template #prefix>
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
                      class="text-foreground/70"
                      aria-hidden="true"
                    >
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </svg>
                  </template>
                </AppSelect>

                <button
                  type="submit"
                  class="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="!vm.canSubmit"
                  :class="vm.submitting && 'pointer-events-none cursor-wait'"
                  :aria-busy="vm.submitting"
                  :aria-label="vm.submitting ? '正在创建需求' : '创建需求'"
                >
                  <Loader2
                    v-if="vm.submitting"
                    class="size-[18px] shrink-0 animate-spin text-current [animation-duration:0.75s] motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m12 19 0-14" />
                    <path d="m5 12 7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.headline-fade-enter-active,
.headline-fade-leave-active {
  transition: opacity 0.45s ease;
}

.headline-fade-enter-from,
.headline-fade-leave-to {
  opacity: 0;
}
</style>
