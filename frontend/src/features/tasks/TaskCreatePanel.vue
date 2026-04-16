<script setup lang="ts">
import { toRef } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import AppSelect from '@shared/components/select'
import {
  TASK_CREATE_SELECT_PANEL_PLACEMENT,
  TASK_CREATE_SELECT_PANEL_Z_INDEX,
} from './task-create-panel.constants'
import {
  useTaskCreatePanel,
  type TaskCreatePanelProps,
  type TaskCreatePanelEmit,
} from './use-task-create-panel'

defineOptions({
  name: 'TaskCreatePanel',
})

const props = withDefaults(defineProps<TaskCreatePanelProps>(), {
  projectId: '',
})

const emit = defineEmits<TaskCreatePanelEmit>()

const vm = useTaskCreatePanel(props, emit)
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
          @submit.prevent="vm.createTask"
        >
          <div class="px-5 pt-5 sm:px-6 sm:pt-6">
            <textarea
              v-model="vm.createForm.prompt"
              class="min-h-[360px] w-full resize-none border-0 bg-transparent px-1 text-lg text-foreground outline-none placeholder:text-muted-foreground"
              :placeholder="
                vm.createForm.mode === 'conversation' ? '分配任务，或直接提出问题' : '解决复杂需求...'
              "
            />
          </div>

          <div v-if="vm.selectedFiles.length > 0" class="mx-5 mb-2 flex flex-wrap gap-2 sm:mx-6">
            <span
              v-for="(file, index) in vm.selectedFiles"
              :key="`${file.name}-${file.size}-${file.lastModified}`"
              class="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
            >
              <span class="max-w-[220px] truncate">{{ file.name }}</span>
              <span class="text-muted-foreground">{{ vm.formatFileSize(file.size) }}</span>
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

          <div class="overflow-x-auto border-t border-border px-4 py-3 sm:px-5">
            <p
              v-if="vm.repositoryProvisioningHint"
              class="mb-2 text-xs text-amber-600"
            >
              {{ vm.repositoryProvisioningHint }}
            </p>
            <div class="flex min-w-full w-max flex-nowrap items-center gap-2 [&>*]:shrink-0">
              <input
                ref="fileInputRef"
                type="file"
                multiple
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

              <div
                class="inline-flex h-11 items-center rounded-full border border-border bg-background p-1"
              >
                <button
                  type="button"
                  class="rounded-full px-4 py-1.5 text-sm font-semibold transition"
                  :class="
                    vm.createForm.mode === 'conversation'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground/80 hover:text-foreground'
                  "
                  @click="vm.createForm.mode = 'conversation'"
                >
                  对话
                </button>
                <button
                  type="button"
                  class="rounded-full px-4 py-1.5 text-sm font-semibold transition"
                  :class="
                    vm.createForm.mode === 'workflow'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground/80 hover:text-foreground'
                  "
                  @click="vm.createForm.mode = 'workflow'"
                >
                  工作流
                </button>
              </div>

              <template v-if="vm.createForm.mode === 'conversation'">
                <AppSelect
                  v-model="vm.createForm.agentCliId"
                  aria-label="Agent CLI"
                  :block="false"
                  :options="vm.configuredCliToolOptions"
                  :disabled="vm.loadingAgentConfigs || vm.configuredCliTools.length === 0"
                  :panel-z-index="TASK_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="TASK_CREATE_SELECT_PANEL_PLACEMENT"
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
                  v-model="vm.createForm.agentCliConfigId"
                  aria-label="Agent CLI 配置"
                  :block="false"
                  :options="vm.agentToolConfigOptions"
                  :disabled="vm.loadingAgentConfigs || vm.agentToolConfigs.length === 0"
                  :panel-z-index="TASK_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="TASK_CREATE_SELECT_PANEL_PLACEMENT"
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
              </template>

              <template v-else>
                <AppSelect
                  v-model="vm.createForm.workflowTemplateId"
                  aria-label="工作流模板"
                  :block="false"
                  :options="vm.workflowTemplateOptions"
                  :disabled="vm.loadingTemplates || vm.templates.length === 0"
                  :panel-z-index="TASK_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="TASK_CREATE_SELECT_PANEL_PLACEMENT"
                  size="lg"
                  trigger-class="min-w-[160px] rounded-full border-border bg-background pl-3 pr-3 text-sm font-medium shadow-none"
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
                      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                      <path d="M12 8v8" />
                      <path d="m9 11 3-3 3 3" />
                      <path d="m9 13 3 3 3-3" />
                    </svg>
                  </template>
                </AppSelect>
              </template>

              <AppSelect
                v-model="vm.createForm.gitBaseBranch"
                aria-label="分支"
                :block="false"
                :options="vm.gitBaseBranchOptions"
                :disabled="vm.loadingBranches || vm.branchOptions.length === 0"
                :panel-z-index="TASK_CREATE_SELECT_PANEL_Z_INDEX"
                :panel-placement="TASK_CREATE_SELECT_PANEL_PLACEMENT"
                size="lg"
                trigger-class="w-[92px] rounded-full border-border bg-background pl-2.5 pr-2.5 text-sm font-medium shadow-none"
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
                    <path d="M6 3v12" />
                    <path d="M18 9v12" />
                    <path d="m3 6 3-3 3 3" />
                    <path d="m15 18 3 3 3-3" />
                  </svg>
                </template>
              </AppSelect>

              <button
                type="submit"
                class="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!vm.canCreateTask"
                :class="vm.submitting && 'pointer-events-none cursor-wait'"
                :aria-busy="vm.submitting"
                :aria-label="vm.submitting ? '正在创建任务' : '创建任务'"
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
