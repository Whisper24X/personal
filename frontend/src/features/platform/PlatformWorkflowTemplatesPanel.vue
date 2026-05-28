<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useMessage } from '@app/composables/useMessage'
import { ConfirmActionModal } from '@features/business-lines'
import { WorkflowTemplateEditorModal } from '@features/workflow'
import { usePlatformGlobalWorkflowTemplates } from './usePlatformGlobalWorkflowTemplates'

defineOptions({
  name: 'PlatformWorkflowTemplatesPanel',
})

const message = useMessage()
const {
  loading,
  submitting,
  sortedTemplates,
  modalOpen,
  mode,
  validationMessage,
  workflowEditorActiveNodeIndex,
  form,
  deleteModalOpen,
  deleteTarget,
  deleting,
  formatWorkflowNodeTabLabel,
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

const modalTitle = computed(() => (mode.value === 'create' ? '新建平台工作流' : '编辑平台工作流'))

const setDeleteModalOpen = (open: boolean) => {
  deleteModalOpen.value = open
}

onMounted(() => {
  void loadTemplates()
})
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold tracking-tight">平台工作流</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          平台工作流为全局母版，可在业务线侧通过「复制平台工作流」下发；任务执行使用业务线副本。名称在全局唯一。
        </p>
      </div>
      <button
        type="button"
        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-95"
        @click="openCreate()"
      >
        新建平台工作流
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
      暂无平台工作流，可点击「新建平台工作流」。
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-border bg-card">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
          <tr>
            <th class="px-3 py-2">名称</th>
            <th class="px-3 py-2 whitespace-nowrap">节点数</th>
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
              {{ t.nodesJson?.length ?? 0 }}
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

    <WorkflowTemplateEditorModal
      v-if="modalOpen"
      v-model:form="form"
      v-model:workflow-editor-active-node-index="workflowEditorActiveNodeIndex"
      :open="modalOpen"
      :title="modalTitle"
      title-id="platform-workflow-template-modal-title"
      template-name-label="平台工作流名称"
      template-name-placeholder="例如：默认代码修复流"
      template-info-hint="节点仅需 Prompt 骨架，业务线侧再绑定 Agent CLI。"
      hide-agent-cli
      :validation-message="validationMessage"
      :submitting-workflow-template="submitting"
      :submit-disabled="false"
      submit-loading-text="提交中…"
      submit-idle-text="保存"
      :format-workflow-node-tab-label="formatWorkflowNodeTabLabel"
      tab-key-prefix="platform-workflow-node-tab"
      @close="closeModal"
      @submit="submit"
      @add-node="addNode"
      @remove-node="removeNode"
    />

    <ConfirmActionModal
      :open="deleteModalOpen"
      title="删除平台工作流"
      :description="
        deleteTarget
          ? `确定删除平台工作流「${deleteTarget.name}」？已复制到业务线的副本不会删除。`
          : ''
      "
      confirm-text="删除"
      :confirming="deleting"
      @update:open="setDeleteModalOpen"
      @confirm="remove()"
    />
  </div>
</template>
