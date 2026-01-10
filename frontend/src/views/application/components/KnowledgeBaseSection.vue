<template>
    <el-card v-if="projects.length > 0" class="knowledge-base-card">
        <template #header>
            <CardHeader title="应用知识库" :icon="Collection" />
        </template>
        <div class="knowledge-base-content">
            <el-text type="info">
                知识库用于存储项目相关的参考文档，这些文档会被自动索引到向量数据库，用于RAG检索增强生成。
                您可以为每个项目单独管理知识库文档。
            </el-text>
            <div class="knowledge-base-projects" style="margin-top: 16px">
                <el-text type="info" size="small" style="display: block; margin-bottom: 12px">
                    快速访问项目知识库：
                </el-text>
                <div class="project-links">
                    <el-button v-for="project in projects" :key="project.id" type="primary" link
                        @click="handleProjectClick(project.id)">
                        <el-icon>
                            <Collection />
                        </el-icon>
                        {{ project.name }} 的知识库
                    </el-button>
                </div>
            </div>
        </div>
    </el-card>
</template>

<script setup lang="ts">
import CardHeader from '../../../components/common/CardHeader.vue';
import { Collection } from '@element-plus/icons-vue';

interface Props {
    projects: Array<{
        id: string;
        name: string;
    }>;
}

defineProps<Props>();

const emit = defineEmits<{
    projectClick: [projectId: string];
}>();

function handleProjectClick(projectId: string) {
    emit('projectClick', projectId);
}
</script>

<style scoped>
.knowledge-base-card {
    margin-top: 24px;
}

.knowledge-base-content {
    padding: 20px 0;
}

.knowledge-base-projects {
    margin-top: 16px;
}

.project-links {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
</style>
