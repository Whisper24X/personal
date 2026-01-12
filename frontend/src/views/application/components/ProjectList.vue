<template>
  <el-card class="projects-card">
    <template #header>
      <CardHeader title="项目列表" />
    </template>

    <EmptyState
      v-if="projects.length === 0"
      :description="emptyDescription"
      :action-text="emptyActionText"
      :action-handler="emptyActionHandler"
    />

    <div v-else>
      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        :show-knowledge-base="showKnowledgeBase"
        @click="handleProjectClick"
        @knowledge-base="handleKnowledgeBaseClick"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import CardHeader from '../../../components/common/CardHeader.vue';
import EmptyState from '../../../components/common/EmptyState.vue';
import ProjectCard from './ProjectCard.vue';

interface Props {
  projects: Array<{
    id: string;
    name: string;
    idea?: string;
    status: string;
  }>;
  emptyDescription?: string;
  emptyActionText?: string;
  showKnowledgeBase?: boolean;
}

withDefaults(defineProps<Props>(), {
  emptyDescription: '还没有项目。创建您的第一个项目！',
  emptyActionText: '创建项目',
  showKnowledgeBase: true,
});

const emit = defineEmits<{
  projectClick: [project: any];
  knowledgeBase: [projectId: string];
  emptyAction: [];
}>();

function handleProjectClick(project: any) {
  emit('projectClick', project);
}

function handleKnowledgeBaseClick(projectId: string) {
  emit('knowledgeBase', projectId);
}

function emptyActionHandler() {
  emit('emptyAction');
}
</script>

<style scoped>
.projects-card {
  margin-bottom: 24px;
}
</style>

