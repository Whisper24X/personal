<script setup lang="ts">
import { provide } from 'vue'
import { useProjectsDetailPage, projectsDetailPageInjectionKey } from './use-projects-detail-page'
import ProjectsDetailConfirmModals from './projects-detail/ProjectsDetailConfirmModals.vue'
import ProjectsDetailConfigFormModal from './projects-detail/ProjectsDetailConfigFormModal.vue'
import ProjectsDetailConfigTab from './projects-detail/ProjectsDetailConfigTab.vue'
import ProjectsDetailContextTab from './projects-detail/ProjectsDetailContextTab.vue'
import ProjectsDetailHeader from './projects-detail/ProjectsDetailHeader.vue'
import ProjectsDetailMemberFormModal from './projects-detail/ProjectsDetailMemberFormModal.vue'
import ProjectsDetailMembersTab from './projects-detail/ProjectsDetailMembersTab.vue'
import ProjectsDetailOverviewTab from './projects-detail/ProjectsDetailOverviewTab.vue'
import ProjectsDetailTabStrip from './projects-detail/ProjectsDetailTabStrip.vue'
import ProjectsDetailWorkflowCopyModal from './projects-detail/ProjectsDetailWorkflowCopyModal.vue'
import ProjectsDetailWorkflowCreateModal from './projects-detail/ProjectsDetailWorkflowCreateModal.vue'
import ProjectsDetailWorkflowTab from './projects-detail/ProjectsDetailWorkflowTab.vue'

defineOptions({
  name: 'ProjectsDetailPage',
})

const ctx = useProjectsDetailPage()
provide(projectsDetailPageInjectionKey, ctx)
</script>

<template>
  <div class="fade-up w-full min-h-0 space-y-6 pb-8 md:pb-10">
    <ProjectsDetailHeader />
    <p v-if="ctx.validationMessage" class="text-sm text-destructive">{{ ctx.validationMessage }}</p>
    <section v-if="ctx.loading" class="panel-card p-6 text-sm text-muted-foreground">加载中...</section>
    <template v-else-if="ctx.project">
      <ProjectsDetailTabStrip />
      <ProjectsDetailOverviewTab />
      <ProjectsDetailContextTab />
      <ProjectsDetailMembersTab />
      <ProjectsDetailWorkflowTab />
      <ProjectsDetailConfigTab />
    </template>
    <section v-else class="panel-card p-5 text-sm text-muted-foreground">
      请先在左侧选择项目后查看工作流。
    </section>
    <ProjectsDetailConfirmModals />
    <ProjectsDetailWorkflowCreateModal />
    <ProjectsDetailWorkflowCopyModal />
    <ProjectsDetailMemberFormModal />
    <ProjectsDetailConfigFormModal />
  </div>
</template>
