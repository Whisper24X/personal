<script setup lang="ts">
import type { ProjectItem } from '@features/layout'

defineOptions({ name: 'BlmProjectsTab' })

const projectQuery = defineModel<string>('projectQuery', { required: true })

const props = defineProps<{
  activeLineId: string
  loadingProjects: boolean
  filteredProjects: ProjectItem[]
  selectedProjectId?: string
  canCreateProjectItem: boolean
  canUpdateProjectItem: boolean
  canDeleteProjectItem: boolean
  summarizeProjectRuntime: (project: ProjectItem) => string
}>()

const emit = defineEmits<{
  refresh: []
  'create-project': []
  select: [project: ProjectItem]
  'open-runtime': [project: ProjectItem]
  'open-db-isolation': [project: ProjectItem]
  'retry-provisioning': [project: ProjectItem]
  'open-edit': [project: ProjectItem]
  'open-delete': [project: ProjectItem]
}>()

const isCurrentProject = (projectId: string) => projectId === props.selectedProjectId

type RepositoryProvisioningStatus = 'pending' | 'ready' | 'failed'

const provisioningStatusLabelMap: Record<RepositoryProvisioningStatus, string> = {
  pending: '仓库准备中',
  ready: '仓库就绪',
  failed: '仓库准备失败',
}

const provisioningStatusClassMap: Record<RepositoryProvisioningStatus, string> = {
  pending: 'border-amber-400/50 bg-amber-500/10 text-amber-600',
  ready: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-600',
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
}

const resolveProvisioningStatus = (
  project: ProjectItem,
): RepositoryProvisioningStatus => {
  return project.repositoryProvisioningStatus ?? 'ready'
}
</script>

<template>
  <section class="space-y-4">
    <div class="panel-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold">项目列表（{{ filteredProjects.length }}）</p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
            @click="emit('refresh')"
          >
            刷新
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!activeLineId || !canCreateProjectItem"
            @click="emit('create-project')"
          >
            新建项目
          </button>
        </div>
      </div>

      <input
        v-model="projectQuery"
        type="search"
        class="mt-4 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
        placeholder="按项目名 / ID / 描述 / Git 地址搜索"
      />

      <div v-if="loadingProjects" class="mt-4 text-sm text-muted-foreground">加载项目中...</div>

      <div v-else class="mt-4 space-y-2">
        <article
          v-for="project in filteredProjects"
          :key="project.id"
          :data-project-id="project.id"
          class="cursor-pointer rounded-xl border px-4 py-3"
          :class="
            isCurrentProject(project.id)
              ? 'border-primary/45 bg-primary/8 shadow-sm'
              : 'border-border bg-background/70'
          "
          role="button"
          tabindex="0"
          @click="emit('select', project)"
          @keydown.enter.prevent="emit('select', project)"
          @keydown.space.prevent="emit('select', project)"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold text-foreground">{{ project.name }}</p>
                <span
                  class="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                  :class="provisioningStatusClassMap[resolveProvisioningStatus(project)]"
                >
                  {{ provisioningStatusLabelMap[resolveProvisioningStatus(project)] }}
                </span>
                <span
                  v-if="isCurrentProject(project.id)"
                  class="inline-flex rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                >
                  当前项目
                </span>
              </div>
              <p class="text-xs text-muted-foreground">{{ project.description || '暂无描述' }}</p>
              <p class="font-mono text-[11px] text-muted-foreground">{{ project.gitUrl }}</p>
              <p class="text-xs text-muted-foreground">默认分支：{{ project.defaultBranch }}</p>
              <p
                v-if="resolveProvisioningStatus(project) === 'failed' && project.repositoryProvisioningError"
                class="text-xs text-destructive"
              >
                失败原因：{{ project.repositoryProvisioningError }}
              </p>
              <p class="text-xs text-muted-foreground">
                容器设置：{{ summarizeProjectRuntime(project) }}
              </p>
            </div>

            <div class="flex flex-wrap items-center justify-end gap-2">
              <button
                v-if="
                  canUpdateProjectItem &&
                  (resolveProvisioningStatus(project) === 'pending' ||
                    resolveProvisioningStatus(project) === 'failed')
                "
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-500/20"
                @click.stop="emit('retry-provisioning', project)"
              >
                重试仓库准备
              </button>
              <button
                v-if="canUpdateProjectItem"
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm"
                @click.stop="emit('open-runtime', project)"
              >
                容器设置
              </button>
              <button
                v-if="canUpdateProjectItem"
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/20"
                @click.stop="emit('open-db-isolation', project)"
              >
                数据库配置
              </button>
              <button
                v-if="canUpdateProjectItem"
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                @click.stop="emit('open-edit', project)"
              >
                编辑基础信息
              </button>
              <button
                v-if="canDeleteProjectItem"
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
                @click.stop="emit('open-delete', project)"
              >
                删除
              </button>
            </div>
          </div>
        </article>

        <div
          v-if="!loadingProjects && filteredProjects.length === 0"
          class="rounded-xl border border-dashed border-border bg-background/70 px-4 py-5 text-sm text-muted-foreground"
        >
          当前业务线暂无项目。
        </div>
      </div>
    </div>
  </section>
</template>
