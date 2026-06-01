<script setup lang="ts">
import TaskGitChangeTreeItem from './TaskGitChangeTreeItem.vue'
import TaskGitCompareTreeItem from './TaskGitCompareTreeItem.vue'
import TaskDiffViewer from './TaskDiffViewer.vue'
import { useTaskGitPanel, type TaskGitPanelProps } from './use-task-git-panel'

defineOptions({
  name: 'TaskGitPanel',
})

const props = withDefaults(defineProps<TaskGitPanelProps>(), {
  baseBranch: null,
})

const vm = useTaskGitPanel(props)
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <header class="border-border/70 flex items-center justify-between gap-2 border-b px-3 py-2">
      <p class="truncate text-xs text-foreground">
        {{ vm.statusInfo?.branchName || '-' }}
        <span class="text-muted-foreground/60">-></span>
        {{ vm.baseBranchInput }}
      </p>

      <div class="flex shrink-0 items-center gap-1">
        <button
          class="h-6 rounded-md border border-border/60 bg-background px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          type="button"
          @click="vm.refreshActiveTab"
        >
          刷新
        </button>
      </div>
    </header>

    <div class="border-border/70 flex items-center gap-1 border-b px-2 py-1">
      <button
        v-for="tab in [
          { key: 'changes' as const, label: '变更' },
          { key: 'compare' as const, label: '对比' },
          { key: 'operations' as const, label: '操作' },
          { key: 'log' as const, label: '日志' },
        ]"
        :key="tab.key"
        class="h-7 rounded-md px-2 text-xs transition-colors"
        :class="
          vm.activeTab === tab.key
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted'
        "
        type="button"
        @click="vm.activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <!-- Changes tab -->
      <div v-if="vm.activeTab === 'changes'" class="flex h-full min-w-0">
        <aside
          class="border-border/70 flex w-72 shrink-0 flex-col border-r bg-background/80 text-xs"
        >
          <div class="flex items-center justify-between border-b border-border/50 px-2 py-1.5">
            <span class="text-muted-foreground/70">文件变更</span>
            <div class="flex gap-1">
              <button
                class="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                type="button"
                @click="vm.stageAll"
              >
                全部暂存
              </button>
              <button
                class="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                type="button"
                @click="vm.unstageAll"
              >
                全部取消
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
            <p v-if="vm.loading" class="px-1 text-muted-foreground">加载中...</p>
            <p v-else-if="vm.errorMessage" class="px-1 text-destructive">{{ vm.errorMessage }}</p>

            <template v-else>
              <div v-if="vm.stagedFiles.length > 0" class="mb-3">
                <p
                  class="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
                >
                  已暂存 ({{ vm.stagedFiles.length }})
                </p>
                <p class="mb-1.5 px-1 text-[11px] text-muted-foreground/70">
                  准备进入下一次 vm.commit 的内容
                </p>
                <div class="space-y-0.5">
                  <TaskGitChangeTreeItem
                    v-for="node in vm.stagedTree.nodes"
                    :key="'s-' + node.path"
                    :node="node"
                    :files-by-path="vm.stagedTree.filesByPath"
                    :collapsed-paths="vm.stagedCollapsedPaths"
                    :selected-path="vm.selectedChangedFile?.staged ? vm.selectedChangedFile.path : null"
                    :staged="true"
                    @select-file="vm.selectFile"
                    @toggle-dir="vm.toggleCollapsedPath($event, true)"
                    @toggle-stage="vm.toggleStage($event.filePath, $event.staged)"
                  />
                </div>
              </div>

              <div v-if="vm.unstagedFiles.length > 0">
                <p
                  class="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60"
                >
                  未暂存 ({{ vm.unstagedFiles.length }})
                </p>
                <p class="mb-1.5 px-1 text-[11px] text-muted-foreground/70">
                  工作区变更，尚未加入 vm.commit
                </p>
                <div class="space-y-0.5">
                  <TaskGitChangeTreeItem
                    v-for="node in vm.unstagedTree.nodes"
                    :key="'u-' + node.path"
                    :node="node"
                    :files-by-path="vm.unstagedTree.filesByPath"
                    :collapsed-paths="vm.unstagedCollapsedPaths"
                    :selected-path="
                      vm.selectedChangedFile && !vm.selectedChangedFile.staged
                        ? vm.selectedChangedFile.path
                        : null
                    "
                    :staged="false"
                    @select-file="vm.selectFile"
                    @toggle-dir="vm.toggleCollapsedPath($event, false)"
                    @toggle-stage="vm.toggleStage($event.filePath, $event.staged)"
                  />
                </div>
              </div>

              <p v-if="!vm.hasChanges" class="px-1 py-2 text-center text-muted-foreground/50">
                工作区干净
              </p>
            </template>
          </div>
        </aside>

        <section class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div class="min-h-0 flex-1 overflow-hidden">
            <section
              class="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background"
            >
              <div
                class="flex items-center justify-end gap-2 border-b border-border/60 px-2 py-1.5"
              >
                <div
                  class="inline-flex rounded-md border border-border/70 bg-background p-0.5 shadow-sm"
                >
                  <button
                    class="rounded px-2.5 py-1 text-[11px] transition-colors"
                    :class="
                      vm.changesViewMode === 'unified'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    "
                    type="button"
                    @click="vm.changesViewMode = 'unified'"
                  >
                    统一视图
                  </button>
                  <button
                    class="rounded px-2.5 py-1 text-[11px] transition-colors"
                    :class="
                      vm.changesViewMode === 'split'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    "
                    type="button"
                    @click="vm.changesViewMode = 'split'"
                  >
                    分栏视图
                  </button>
                </div>
                <button
                  class="rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  type="button"
                  @click="vm.openFullscreen('changes')"
                >
                  全屏
                </button>
              </div>
              <TaskDiffViewer
                :diff-text="vm.diffText"
                :fallback-text="vm.diffFallbackText"
                :loading="vm.diffLoading"
                :empty-text="'选择文件查看差异'"
                :fallback-path="vm.selectedFilePath"
                :view-mode="vm.changesViewMode"
                :show-view-mode-toolbar="false"
              />
            </section>
          </div>
        </section>
      </div>

      <!-- Compare tab -->
      <div v-else-if="vm.activeTab === 'compare'" class="flex h-full min-w-0">
        <aside
          class="border-border/70 flex w-72 shrink-0 flex-col border-r bg-background/80 text-xs"
        >
          <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
            <p v-if="vm.compareLoading" class="px-1 text-muted-foreground">加载中...</p>
            <p v-else-if="vm.errorMessage" class="px-1 text-destructive">{{ vm.errorMessage }}</p>

            <template v-else>
              <div class="mb-3">
                <p
                  class="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-sky-700 dark:text-sky-300"
                >
                  分支差异 ({{ vm.branchDiffFiles.length }})
                </p>
                <div class="space-y-0.5">
                  <TaskGitCompareTreeItem
                    v-for="node in vm.branchDiffTree.nodes"
                    :key="node.path"
                    :node="node"
                    :files-by-path="vm.branchDiffTree.filesByPath"
                    :collapsed-paths="vm.compareCollapsedPaths"
                    :selected-path="vm.selectedBranchDiffPath"
                    @select-file="vm.selectBranchDiffFile"
                    @toggle-dir="vm.toggleCompareCollapsedPath"
                  />
                </div>
              </div>

              <p
                v-if="vm.branchDiffFiles.length === 0"
                class="px-1 py-2 text-center text-muted-foreground/50"
              >
                无分支差异
              </p>
            </template>
          </div>
        </aside>

        <section class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div class="min-h-0 flex-1 overflow-hidden">
            <section
              class="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background"
            >
              <div class="flex items-center justify-end gap-2 border-b border-border/60 px-3 py-1.5">
                <div
                  class="inline-flex rounded-md border border-border/70 bg-background p-0.5 shadow-sm"
                >
                  <button
                    class="rounded px-2.5 py-1 text-[11px] transition-colors"
                    :class="
                      vm.compareViewMode === 'unified'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    "
                    type="button"
                    @click="vm.compareViewMode = 'unified'"
                  >
                    统一视图
                  </button>
                  <button
                    class="rounded px-2.5 py-1 text-[11px] transition-colors"
                    :class="
                      vm.compareViewMode === 'split'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    "
                    type="button"
                    @click="vm.compareViewMode = 'split'"
                  >
                    分栏视图
                  </button>
                </div>
                <button
                  class="rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  type="button"
                  @click="vm.openFullscreen('compare')"
                >
                  全屏
                </button>
              </div>
              <TaskDiffViewer
                :diff-text="vm.branchDiffText"
                :loading="vm.branchDiffLoading"
                :empty-text="'选择文件查看差异'"
                :fallback-path="vm.selectedBranchDiffPath"
                :view-mode="vm.compareViewMode"
                :show-view-mode-toolbar="false"
              />
            </section>
          </div>
        </section>
      </div>

      <!-- Operations tab -->
      <div v-else-if="vm.activeTab === 'operations'" class="min-h-0 flex-1 overflow-y-auto p-4">
        <div class="mx-auto flex max-w-4xl flex-col gap-4">
          <section class="rounded-2xl border border-border/70 bg-background shadow-sm">
            <div class="flex flex-wrap items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
              <span class="rounded-md bg-muted px-2 py-1">
                当前分支 {{ vm.statusInfo?.branchName || '-' }}
              </span>
              <span class="rounded-md bg-muted px-2 py-1">基准分支 {{ vm.baseBranchInput }}</span>
            </div>
          </section>

          <section class="rounded-2xl border border-border/70 bg-background shadow-sm">
            <header
              class="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3"
            >
              <div>
                <h3 class="text-sm font-semibold text-foreground">提交操作</h3>
                <p class="mt-1 text-xs text-muted-foreground">整理已暂存内容并提交到当前分支。</p>
              </div>
              <span
                class="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
                >
                  已暂存 {{ vm.stagedFilesCount }} 个文件
                </span>
            </header>

            <div class="space-y-4 px-4 py-4">
              <div class="flex flex-col gap-2 md:flex-row">
                <input
                  v-model="vm.commitMessage"
                  class="h-10 min-w-0 flex-1 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                  placeholder="输入提交信息..."
                  type="text"
                  @keydown.enter="vm.commit"
                />
                <button
                  class="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="vm.commitLoading || !vm.hasStagedFiles || !vm.commitMessage.trim()"
                  type="button"
                  @click="vm.commit"
                >
                  {{ vm.commitLoading ? '提交中...' : '提交' }}
                </button>
                <button
                  class="h-10 rounded-xl border border-border/60 bg-background px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="vm.pushLoading"
                  type="button"
                  @click="vm.push"
                >
                  {{ vm.pushLoading ? '推送中...' : '推送' }}
                </button>
              </div>

            </div>
          </section>

          <section class="rounded-2xl border border-border/70 bg-background shadow-sm">
            <header class="border-b border-border/60 px-4 py-3">
              <div>
                <h3 class="text-sm font-semibold text-foreground">分支操作</h3>
                <p class="mt-1 text-xs text-muted-foreground">
                  围绕当前分支和基准分支执行后续协作动作。
                </p>
              </div>
            </header>

            <div class="space-y-4 px-4 py-4">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  class="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="vm.actionLoading === 'pr'"
                  type="button"
                  @click="vm.openPrLink"
                >
                  {{ vm.actionLoading === 'pr' ? '生成中...' : '创建 PR' }}
                </button>
                <button
                  class="h-10 rounded-xl border border-border/60 bg-background px-4 text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="vm.actionLoading === 'merge'"
                  type="button"
                  @click="vm.doMerge"
                >
                  {{ vm.actionLoading === 'merge' ? '合并中...' : '合并' }}
                </button>
                <button
                  class="h-10 rounded-xl border border-amber-500/30 bg-amber-50/30 px-4 text-sm text-amber-700 transition-colors hover:bg-amber-50/50 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-500/10 dark:text-amber-300"
                  :disabled="vm.actionLoading === 'rebase'"
                  type="button"
                  @click="vm.doRebase"
                >
                  {{ vm.actionLoading === 'rebase' ? '变基中...' : '变基' }}
                </button>
              </div>

              <div
                v-if="vm.actionMessage"
                class="rounded-xl border px-3 py-3 text-sm"
                :class="vm.actionFeedbackClasses"
              >
                {{ vm.actionMessage }}
              </div>

              <div
                v-if="vm.conflictFiles.length > 0"
                class="rounded-xl border border-amber-500/30 bg-amber-50/20 px-3 py-3 dark:bg-amber-500/5"
              >
                <p class="mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  冲突文件 ({{ vm.conflictFiles.length }})
                </p>
                <ul class="space-y-1">
                  <li
                    v-for="cf in vm.conflictFiles"
                    :key="cf"
                    class="truncate rounded-md bg-background/70 px-2 py-1 text-xs text-amber-700 dark:text-amber-300"
                  >
                    {{ cf }}
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- Log tab -->
      <div v-else class="flex h-full flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <p v-if="vm.logLoading" class="text-xs text-muted-foreground">加载中...</p>
          <pre
            v-else
            class="font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap"
            >{{ vm.logText || '暂无提交记录' }}</pre
          >
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="vm.fullscreenOpen"
      class="fixed inset-0 z-[140] flex bg-background/85 p-3 backdrop-blur-sm sm:p-6"
      @click.self="vm.closeFullscreen"
    >
      <section
        ref="fullscreenDialog"
        class="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Git Diff 全屏预览"
        tabindex="-1"
        @keydown.esc="vm.closeFullscreen"
      >
        <header
          class="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3"
        >
          <p class="min-w-0 truncate font-mono text-sm text-foreground">
            {{ vm.fullscreenSelectedPath || 'Git Diff' }}
          </p>
          <div class="flex items-center gap-2">
            <div
              class="inline-flex rounded-md border border-border/70 bg-background p-0.5 shadow-sm"
            >
              <button
                class="rounded px-2.5 py-1 text-[11px] transition-colors"
                :class="
                  vm.fullscreenViewMode === 'unified'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                "
                type="button"
                @click="vm.setFullscreenViewMode('unified')"
              >
                统一视图
              </button>
              <button
                class="rounded px-2.5 py-1 text-[11px] transition-colors"
                :class="
                  vm.fullscreenViewMode === 'split'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                "
                type="button"
                @click="vm.setFullscreenViewMode('split')"
              >
                分栏视图
              </button>
            </div>
            <button
              class="rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              type="button"
              @click="vm.closeFullscreen"
            >
              退出全屏
            </button>
          </div>
        </header>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TaskDiffViewer
            :diff-text="vm.fullscreenDiffText"
            :fallback-text="vm.fullscreenFallbackText"
            :loading="vm.fullscreenDiffLoading"
            :empty-text="'选择文件查看差异'"
            :fallback-path="vm.fullscreenSelectedPath"
            :view-mode="vm.fullscreenViewMode"
            :show-view-mode-toolbar="false"
          />
        </div>
      </section>
    </div>
  </Teleport>
</template>
