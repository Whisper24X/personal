<script setup lang="ts">
import AppSelect from '@shared/components/select'

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailConfigFormModal' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
<Teleport to="body">
  <div
    v-if="ctx.configFormModalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="project-config-form-modal-title"
    @click.self="ctx.closeConfigFormModal"
  >
    <section
      class="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
    >
      <header class="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 id="project-config-form-modal-title" class="text-sm font-semibold">编辑项目配置</h2>
        <button
          class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
          type="button"
          aria-label="关闭配置弹窗"
          @click="ctx.closeConfigFormModal"
        >
          关闭
        </button>
      </header>

      <form
        class="grid max-h-[calc(92vh-56px)] gap-4 overflow-auto px-4 py-4 md:grid-cols-2"
        @submit.prevent="ctx.saveConfig"
      >
        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">项目名称</span>
          <input
            v-model="ctx.configForm.name"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">默认分支</span>
          <input
            v-model="ctx.configForm.defaultBranch"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            type="text"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">仓库地址</span>
          <input
            v-model="ctx.configForm.gitUrl"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            type="text"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">描述</span>
          <input
            v-model="ctx.configForm.description"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">Agent 执行器</span>
          <input
            v-model="ctx.configForm.agentAdapter"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="例如 codex"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">并发上限</span>
          <input
            v-model="ctx.configForm.maxConcurrency"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            min="1"
            type="number"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">Git Runtime 开关</span>
          <AppSelect
            v-model="ctx.configForm.gitRuntimeEnabled"
            aria-label="Git Runtime 开关"
            :options="[
              { label: '开启（clone/worktree）', value: true },
              { label: '关闭（目录沙箱）', value: false },
            ]"
            trigger-class="h-10 rounded-lg border-border bg-background px-3 text-sm shadow-none"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground"
            >Skills 白名单（逗号分隔）</span
          >
          <input
            v-model="ctx.configForm.skills"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="code-review, test-generator"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground"
            >MCP 白名单（逗号分隔）</span
          >
          <input
            v-model="ctx.configForm.mcp"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="filesystem, jira"
            type="text"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">Repo 本地路径（可选）</span>
          <input
            v-model="ctx.configForm.repoLocalPath"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="/path/to/existing/repo"
            type="text"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">Repo 缓存目录（可选）</span>
          <input
            v-model="ctx.configForm.repoCacheBaseDir"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="/path/to/repo-cache"
            type="text"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground"
            >Worktree 基础目录（可选）</span
          >
          <input
            v-model="ctx.configForm.worktreeBaseDir"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="/path/to/worktrees"
            type="text"
          />
        </label>

        <div class="md:col-span-2 rounded-xl border border-border bg-background/60 p-3">
          <p class="text-xs font-semibold text-muted-foreground">项目级隔离容器配置</p>
          <p class="mt-1 text-[11px] text-muted-foreground">
            运行参数统一跟随后端全局配置；项目只声明额外环境变量、服务编排和主预览入口。
          </p>
        </div>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">
            容器环境变量（每行 `KEY=VALUE`）
          </span>
          <textarea
            v-model="ctx.configForm.containerEnv"
            class="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="PORT=8080&#10;NODE_ENV=development"
          />
        </label>

        <div class="md:col-span-2 rounded-xl border border-border bg-background/60 p-3">
          <p class="text-[11px] text-muted-foreground">
            服务编排配置已改为自动生成，无需手动配置。如需手动覆盖，请联系管理员。
          </p>
        </div>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">Runner 命令（可选）</span>
          <input
            v-model="ctx.configForm.runnerCommand"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="例如 codex"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground"
            >Runner 参数（逗号分隔）</span
          >
          <input
            v-model="ctx.configForm.runnerArgs"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="exec, --skip-git-repo-check, -"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">Runner 超时秒数</span>
          <input
            v-model="ctx.configForm.runnerTimeoutSeconds"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            min="5"
            type="number"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">优先级策略</span>
          <input
            v-model="ctx.configForm.priority"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="normal"
            type="text"
          />
        </label>

        <fieldset class="md:col-span-2 space-y-3 rounded-lg border border-border/60 p-4">
          <legend class="px-1 text-xs font-semibold text-muted-foreground">子仓库配置</legend>
          <div
            v-for="(sub, idx) in ctx.configForm.subRepos"
            :key="idx"
            class="flex items-start gap-2"
          >
            <input
              v-model="sub.url"
              class="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-xs"
              placeholder="git 地址"
            />
            <input
              v-model="sub.prefix"
              class="h-9 w-32 rounded-lg border border-border bg-background px-2 text-xs"
              placeholder="目录前缀"
            />
            <input
              v-model="sub.branch"
              class="h-9 w-24 rounded-lg border border-border bg-background px-2 text-xs"
              placeholder="分支"
            />
            <button
              type="button"
              class="h-9 shrink-0 rounded-lg border border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10"
              @click="ctx.configForm.subRepos.splice(idx, 1)"
            >
              删除
            </button>
          </div>
          <button
            type="button"
            class="h-8 rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground hover:text-foreground"
            @click="ctx.configForm.subRepos.push({ url: '', prefix: '', branch: 'main' })"
          >
            + 添加子仓
          </button>
        </fieldset>

        <div class="md:col-span-2 flex justify-end gap-2">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
            type="button"
            @click="ctx.closeConfigFormModal"
          >
            取消
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="ctx.savingConfig"
            type="submit"
          >
            {{ ctx.savingConfig ? '保存中...' : '保存配置' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</Teleport>
</template>
