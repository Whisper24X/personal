<script setup lang="ts">

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailTabStrip' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
  <section v-if="!ctx.workflowOnlyMode" class="panel-card flex flex-wrap gap-2 p-2">
    <button
      class="rounded-xl px-4 py-2 text-sm font-semibold transition"
      :class="ctx.tabClass('overview')"
      type="button"
      @click="ctx.tab = 'overview'"
    >
      概览
    </button>
    <button
      class="rounded-xl px-4 py-2 text-sm font-semibold transition"
      :class="ctx.tabClass('context')"
      type="button"
      @click="ctx.tab = 'context'"
    >
      项目上下文
    </button>
    <button
      v-if="ctx.canManageProjectMembers"
      class="rounded-xl px-4 py-2 text-sm font-semibold transition"
      :class="ctx.tabClass('members')"
      type="button"
      @click="ctx.tab = 'members'"
    >
      成员
    </button>
    <button
      v-if="ctx.canAccessWorkflow"
      class="rounded-xl px-4 py-2 text-sm font-semibold transition"
      :class="ctx.tabClass('workflow')"
      type="button"
      @click="ctx.tab = 'workflow'"
    >
      工作流
    </button>
    <button
      v-if="ctx.canUpdateProject"
      class="rounded-xl px-4 py-2 text-sm font-semibold transition"
      :class="ctx.tabClass('config')"
      type="button"
      @click="ctx.tab = 'config'"
    >
      项目配置
    </button>
  </section>
</template>
