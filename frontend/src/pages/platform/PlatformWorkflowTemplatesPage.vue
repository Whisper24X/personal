<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useMessage } from '@app/composables/useMessage'
import { ConfirmActionModal } from '@features/business-lines'
import { usePlatformGlobalWorkflowTemplates } from '@features/platform/usePlatformGlobalWorkflowTemplates'
import WorkflowPromptTextarea from '@features/workflow/WorkflowPromptTextarea.vue'
import WorkflowPromptVariablesHint from '@features/workflow/WorkflowPromptVariablesHint.vue'

defineOptions({
  name: 'PlatformWorkflowTemplatesPage',
})

const message = useMessage()
const {
  loading,
  submitting,
  sortedTemplates,
  modalOpen,
  mode,
  validationMessage,
  activeNodeIndex,
  form,
  deleteModalOpen,
  deleteTarget,
  deleting,
  loadTemplates,
  openCreate,
  openEdit,
  closeModal,
  addNode,
  removeNode,
  submit,
  confirmDelete,
  remove,
} = usePlatformGlobalWorkflowTemplates(message)

const modalTitle = computed(() => (mode.value === 'create' ? '新建平台工作流母版' : '编辑平台工作流母版'))

const activeNode = computed(() => form.value.nodes[activeNodeIndex.value] ?? null)

const setDeleteModalOpen = (open: boolean) => {
  deleteModalOpen.value = open
}

onMounted(() => {
  void loadTemplates()
})
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4 px-4 py-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold tracking-tight">平台工作流母版</h1>
        <p class="mt-1 text-xs text-muted-foreground">
          全局母版仅在新建业务线时按「种子顺序」复制到业务线；任务执行仍使用业务线副本。名称在全局唯一；业务线侧已有同名模板时跳过复制。
        </p>
      </div>
      <button
        type="button"
        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-95"
        @click="openCreate()"
      >
        新建母版
      </button>
    </header>

    <div
      v-if="loading"
      class="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground"
    >
      加载中…
    </div>

    <div
      v-else-if="sortedTemplates.length === 0"
      class="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground"
    >
      暂无 global 母版。可新建或等待数据迁移种子。
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-border bg-card">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
          <tr>
            <th class="px-3 py-2">名称</th>
            <th class="px-3 py-2 whitespace-nowrap">参与新建业务线</th>
            <th class="px-3 py-2 whitespace-nowrap">种子顺序</th>
            <th class="px-3 py-2 whitespace-nowrap">节点数</th>
            <th class="px-3 py-2 whitespace-nowrap">启用</th>
            <th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-for="t in sortedTemplates" :key="t.id" class="hover:bg-muted/30">
            <td class="px-3 py-2">
              <p class="font-medium">{{ t.name }}</p>
              <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {{ t.description || '—' }}
              </p>
            </td>
            <td class="px-3 py-2 text-muted-foreground">
              {{ t.seedOnBusinessLineCreate ? '是' : '否' }}
            </td>
            <td class="px-3 py-2 text-muted-foreground">
              {{ t.businessLineSeedOrder ?? 0 }}
            </td>
            <td class="px-3 py-2 text-muted-foreground">
              {{ t.nodesJson?.length ?? 0 }}
            </td>
            <td class="px-3 py-2 text-muted-foreground">
              {{ t.isActive !== false ? '是' : '否' }}
            </td>
            <td class="px-3 py-2 text-right">
              <button
                type="button"
                class="mr-2 rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold"
                @click="openEdit(t)"
              >
                编辑
              </button>
              <button
                type="button"
                class="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive"
                @click="confirmDelete(t)"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div
        v-if="modalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="closeModal()"
      >
        <section
          class="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 class="text-sm font-semibold">{{ modalTitle }}</h2>
            <button
              type="button"
              class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
              @click="closeModal()"
            >
              关闭
            </button>
          </header>

          <form class="max-h-[calc(92vh-52px)] space-y-4 overflow-auto px-4 py-4" @submit.prevent="submit()">
            <p v-if="validationMessage" class="text-xs font-medium text-destructive">
              {{ validationMessage }}
            </p>

            <section class="space-y-3 rounded-xl border border-border bg-background/60 p-3">
              <p class="text-xs font-semibold text-muted-foreground">母版设置</p>
              <div class="grid gap-3 md:grid-cols-2">
                <label class="space-y-1">
                  <span class="text-xs font-semibold text-muted-foreground">模板名称</span>
                  <input
                    v-model="form.name"
                    class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    type="text"
                    required
                  />
                </label>
                <label class="space-y-1">
                  <span class="text-xs font-semibold text-muted-foreground">描述</span>
                  <input
                    v-model="form.description"
                    class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    type="text"
                  />
                </label>
              </div>
              <div class="flex flex-wrap items-center gap-4">
                <label class="flex items-center gap-2 text-xs">
                  <input v-model="form.seedOnBusinessLineCreate" type="checkbox" class="rounded border-border" />
                  <span>新建业务线时自动复制此模板</span>
                </label>
                <label class="flex items-center gap-2 text-xs">
                  <input v-model="form.isActive" type="checkbox" class="rounded border-border" />
                  <span>启用模板</span>
                </label>
                <label class="flex items-center gap-2 text-xs">
                  <span class="font-semibold text-muted-foreground">种子顺序</span>
                  <input
                    v-model.number="form.businessLineSeedOrder"
                    class="h-8 w-20 rounded-lg border border-border bg-background px-2 text-sm"
                    type="number"
                  />
                </label>
              </div>
              <p class="text-[11px] text-muted-foreground">
                数字越小越先复制；相同顺序时按创建时间。母版节点仅需 Prompt 骨架，业务线侧再绑定 Agent CLI。
              </p>
            </section>

            <section class="space-y-3 rounded-xl border border-border bg-background/60 p-3">
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-semibold text-muted-foreground">节点</p>
                <button
                  type="button"
                  class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                  @click.prevent="addNode()"
                >
                  添加节点
                </button>
              </div>
              <div class="flex gap-2 overflow-x-auto pb-1">
                <button
                  v-for="(node, index) in form.nodes"
                  :key="`pf-node-tab-${index}`"
                  type="button"
                  class="shrink-0 rounded-lg border px-3 py-2 text-xs transition"
                  :class="
                    activeNodeIndex === index
                      ? 'border-primary/40 bg-primary/10 font-semibold'
                      : 'border-border text-muted-foreground'
                  "
                  @click.prevent="activeNodeIndex = index"
                >
                  {{ node.name.trim() || `节点 ${index + 1}` }}
                </button>
              </div>

              <div v-if="activeNode" class="space-y-3">
                <label class="space-y-1 block">
                  <span class="text-xs font-semibold text-muted-foreground">节点名称</span>
                  <input
                    v-model="activeNode.name"
                    class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    type="text"
                  />
                </label>
                <div class="flex flex-wrap gap-4 text-xs">
                  <label class="flex items-center gap-2">
                    <input v-model="activeNode.requiresApproval" type="checkbox" class="rounded border-border" />
                    需审批
                  </label>
                  <label class="flex items-center gap-2">
                    <input v-model="activeNode.requiresArtifact" type="checkbox" class="rounded border-border" />
                    需产物
                  </label>
                  <button
                    v-if="form.nodes.length > 1"
                    type="button"
                    class="text-destructive"
                    @click.prevent="removeNode(activeNodeIndex)"
                  >
                    删除此节点
                  </button>
                </div>
                <div class="space-y-1">
                  <span class="text-xs font-semibold text-muted-foreground">Prompt</span>
                  <WorkflowPromptTextarea v-model="activeNode.prompt" class="min-h-[140px]" />
                  <WorkflowPromptVariablesHint />
                </div>
              </div>
            </section>

            <div class="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                class="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold"
                @click="closeModal()"
              >
                取消
              </button>
              <button
                type="submit"
                class="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                :disabled="submitting"
              >
                {{ submitting ? '提交中…' : '保存' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>

    <ConfirmActionModal
      :open="deleteModalOpen"
      title="删除母版"
      :description="
        deleteTarget
          ? `确定删除全局母版「${deleteTarget.name}」？已复制到业务线的副本不会删除。`
          : ''
      "
      confirm-text="删除"
      :confirming="deleting"
      @update:open="setDeleteModalOpen"
      @confirm="remove()"
    />
  </div>
</template>
