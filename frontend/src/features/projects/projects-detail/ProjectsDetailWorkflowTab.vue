<script setup lang="ts">

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailWorkflowTab' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
  <section
    v-if="(ctx.workflowOnlyMode || ctx.tab === 'workflow') && ctx.canAccessWorkflow"
    class="space-y-4"
  >
    <article class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-1 flex-wrap items-center gap-2">
          <input
            v-model="ctx.workflowKeyword"
            class="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 描述"
            type="search"
            @keydown.enter.prevent="ctx.loadWorkflowTemplates(ctx.projectId)"
          />
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            :disabled="!ctx.projectId || ctx.loadingWorkflowTemplates"
            @click="ctx.loadWorkflowTemplates(ctx.projectId)"
          >
            刷新
          </button>
          <button
            type="button"
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!ctx.projectId || ctx.loadingWorkflowTemplates"
            @click="ctx.loadWorkflowTemplates(ctx.projectId)"
          >
            搜索
          </button>
          <div
            v-if="ctx.canAccessWorkflow"
            :ref="(el) => ctx.setWorkflowAddMenuAnchorEl(el)"
            class="relative"
          >
            <button
              type="button"
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!ctx.projectId"
              @click="ctx.toggleWorkflowAddMenu"
            >
              添加工作流
            </button>

            <div
              v-if="ctx.workflowAddMenuOpen"
              class="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-border bg-background p-1 shadow-lg"
            >
              <button
                type="button"
                class="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="void ctx.openWorkflowCopyModal()"
              >
                从业务线复制
              </button>
              <button
                type="button"
                class="mt-1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="ctx.openWorkflowCreateModal"
              >
                新建工作流
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>

    <article class="panel-card p-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">工作流列表</p>
          <p class="mt-1 text-xs text-muted-foreground">
            仅展示当前项目工作流模板，支持增删改查。
          </p>
        </div>
        <span
          class="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground"
        >
          {{ ctx.workflowTemplates.length }} 项
        </span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[640px] table-fixed text-left text-sm">
          <thead class="border-b border-border bg-background/70">
            <tr class="text-xs font-semibold text-muted-foreground">
              <th class="px-3 py-2">模板</th>
              <th class="w-20 px-3 py-2 whitespace-nowrap">节点数</th>
              <th class="w-44 px-3 py-2 text-right whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="template in ctx.workflowTemplates"
              :key="template.id"
              class="transition hover:bg-background/70"
            >
              <td class="px-3 py-2">
                <div class="text-left">
                  <p class="truncate font-semibold">{{ template.name }}</p>
                  <p class="mt-0.5 truncate text-xs text-muted-foreground">
                    {{ template.description || '暂无描述' }}
                  </p>
                </div>
              </td>
              <td class="px-3 py-2 text-muted-foreground whitespace-nowrap">
                {{ template.nodesJson.length }}
              </td>
              <td class="px-3 py-2">
                <div class="flex justify-end gap-2">
                  <button
                    v-if="ctx.canAccessWorkflow"
                    type="button"
                    class="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="ctx.workflowTemplateActionId === template.id"
                    @click="ctx.openWorkflowEditModal(template)"
                  >
                    编辑
                  </button>
                  <button
                    v-if="ctx.canAccessWorkflow"
                    type="button"
                    class="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="ctx.workflowTemplateActionId === template.id"
                    @click="ctx.removeWorkflowTemplate(template)"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!ctx.loadingWorkflowTemplates && ctx.workflowTemplates.length === 0">
              <td colspan="3" class="px-3 py-4 text-sm text-muted-foreground">
                当前项目暂无自定义模板，请先创建。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>
