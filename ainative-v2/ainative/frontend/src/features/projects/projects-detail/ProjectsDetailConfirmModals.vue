<script setup lang="ts">
import { ConfirmActionModal } from '@features/business-lines'

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailConfirmModals' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
<ConfirmActionModal
  :open="ctx.workflowDeleteConfirmOpen"
  title="删除工作流模板"
  :description="`确认删除模板「${ctx.workflowDeleteTarget?.name ?? ''}」吗？`"
  confirm-text="删除"
  :confirming="ctx.workflowTemplateActionId === (ctx.workflowDeleteTarget?.id ?? '')"
  @update:open="ctx.setWorkflowDeleteConfirmOpen"
  @confirm="ctx.confirmRemoveWorkflowTemplate"
/>

<ConfirmActionModal
  :open="ctx.memberRemoveConfirmOpen"
  title="移除项目成员"
  :description="`确认移除成员 ${ctx.memberRemoveTarget?.userId ?? ''} 吗？`"
  confirm-text="移除"
  :confirming="ctx.removingMemberId === (ctx.memberRemoveTarget?.userId ?? '')"
  @update:open="ctx.setMemberRemoveConfirmOpen"
  @confirm="ctx.confirmRemoveMember"
/>
</template>
