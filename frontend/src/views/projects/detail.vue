<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const projectId = computed(() => String(route.params.id ?? ''))

type TabKey = 'overview' | 'tasks' | 'config'
const tab = ref<TabKey>('overview')

const project = computed(() => ({
  id: projectId.value,
  name: projectId.value === 'demo-ainative' ? 'AINative 示例项目' : '业务项目',
  repoUrl:
    projectId.value === 'demo-ainative'
      ? 'git@example.com:platform/ainative.git'
      : 'git@example.com:org/repo.git',
  defaultBranch: 'main',
  updatedAt: '2026-02-05',
}))

const tabClass = (key: TabKey) =>
  key === tab.value
    ? 'bg-background text-foreground shadow-sm'
    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <RouterLink to="/projects" class="hover:text-foreground hover:underline">项目列表</RouterLink>
        <span>/</span>
        <span class="font-mono">{{ project.id }}</span>
      </div>

      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="space-y-1">
          <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">{{ project.name }}</h1>
          <p class="text-sm text-muted-foreground">
            <span class="font-mono text-xs">{{ project.repoUrl }}</span>
            <span class="mx-2">•</span>
            <span class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
              {{ project.defaultBranch }}
            </span>
            <span class="mx-2">•</span>
            <span>更新于 {{ project.updatedAt }}</span>
          </p>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:shadow-md"
            type="button"
          >
            编辑配置
          </button>
          <RouterLink
            to="/tasks"
            class="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
          >
            新建任务
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="panel-card flex flex-wrap gap-2 p-2">
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="tabClass('overview')"
        type="button"
        @click="tab = 'overview'"
      >
        概览
      </button>
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="tabClass('tasks')"
        type="button"
        @click="tab = 'tasks'"
      >
        任务
      </button>
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="tabClass('config')"
        type="button"
        @click="tab = 'config'"
      >
        配置
      </button>
    </section>

    <section v-if="tab === 'overview'" class="space-y-6">
      <div class="grid gap-4 md:grid-cols-3">
        <div class="panel-card p-4">
          <p class="text-xs text-muted-foreground">任务总数</p>
          <p class="mt-2 text-2xl font-semibold">24</p>
          <p class="mt-3 text-xs text-muted-foreground">覆盖全部执行模板</p>
        </div>
        <div class="panel-card p-4">
          <p class="text-xs text-muted-foreground">运行中</p>
          <p class="mt-2 text-2xl font-semibold">2</p>
          <p class="mt-3 text-xs text-muted-foreground">实时日志已开启</p>
        </div>
        <div class="panel-card p-4">
          <p class="text-xs text-muted-foreground">最近一次运行</p>
          <p class="mt-2 text-2xl font-semibold">12 分钟前</p>
          <p class="mt-3 text-xs text-muted-foreground">任务 t-004</p>
        </div>
      </div>

      <div class="panel-card p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold">最近任务</p>
            <p class="text-xs text-muted-foreground">该项目的近期执行活动</p>
          </div>
          <RouterLink
            to="/tasks"
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
          >
            查看全部
          </RouterLink>
        </div>
        <div class="mt-4 space-y-2 text-sm">
          <RouterLink
            to="/tasks/t-004"
            class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 hover:bg-background"
          >
            <span class="font-semibold">上传产物预览页面</span>
            <span class="text-xs text-muted-foreground">成功</span>
          </RouterLink>
          <RouterLink
            to="/tasks/t-002"
            class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 hover:bg-background"
          >
            <span class="font-semibold">运行 Agent 生成 API 桩代码</span>
            <span class="text-xs text-muted-foreground">运行中</span>
          </RouterLink>
          <RouterLink
            to="/tasks/t-001"
            class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 hover:bg-background"
          >
            <span class="font-semibold">创建 MVP 工作流模板</span>
            <span class="text-xs text-muted-foreground">草稿</span>
          </RouterLink>
        </div>
      </div>
    </section>

    <section v-else-if="tab === 'tasks'" class="space-y-4">
      <div class="panel-card p-5">
        <p class="text-sm font-semibold">任务视图</p>
        <p class="mt-1 text-sm text-muted-foreground">这里可嵌入该项目的任务列表，MVP 阶段先跳转到全局任务页。</p>
        <div class="mt-4">
          <RouterLink
            to="/tasks"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
          >
            前往任务页
          </RouterLink>
        </div>
      </div>
    </section>

    <section v-else class="space-y-4">
      <div class="panel-card p-5">
        <p class="text-sm font-semibold">项目配置（MVP）</p>
        <p class="mt-1 text-sm text-muted-foreground">仓库绑定与默认执行参数配置，后续可接 API 持久化。</p>

        <form class="mt-6 grid gap-4 md:grid-cols-2">
          <label class="space-y-2 md:col-span-2">
            <span class="text-xs font-semibold text-muted-foreground">仓库地址</span>
            <input
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
              :value="project.repoUrl"
              type="text"
            />
          </label>

          <label class="space-y-2">
            <span class="text-xs font-semibold text-muted-foreground">默认分支</span>
            <input
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
              :value="project.defaultBranch"
              type="text"
            />
          </label>

          <label class="space-y-2">
            <span class="text-xs font-semibold text-muted-foreground">允许 Agent</span>
            <select
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
            >
              <option>Codex</option>
              <option>Cursor</option>
              <option>Claude</option>
            </select>
          </label>

          <div class="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:shadow-md"
              type="button"
            >
              重置
            </button>
            <button
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
              type="button"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>
