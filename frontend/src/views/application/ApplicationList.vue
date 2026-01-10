<template>
    <div class="application-list">
        <PageHeader
            title="应用管理"
            description="管理您的应用，每个应用可以包含多个项目"
            :show-back="false"
        />

        <div v-loading="loading" class="content-section">
            <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

            <el-card class="actions-card">
                <template #header>
                    <CardHeader title="应用列表">
                        <template #right>
                            <el-button type="primary" @click="showCreateDialog = true">
                                <el-icon>
                                    <Plus />
                                </el-icon>
                                新建应用
                            </el-button>
                        </template>
                    </CardHeader>
                </template>

                <EmptyState
                    v-if="applications.length === 0"
                    description="还没有应用。创建您的第一个应用！"
                    action-text="创建应用"
                    :action-handler="() => showCreateDialog = true"
                />

                <div v-else class="applications-grid">
                    <ApplicationCard
                        v-for="app in applications"
                        :key="app.id"
                        :application="app"
                        @click="viewApplication"
                        @command="handleCommand"
                    />
                </div>
            </el-card>
        </div>

        <!-- 创建应用对话框 -->
        <ApplicationCreateDialog
            v-model="showCreateDialog"
            :loading="loading"
            @submit="handleCreate"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApplicationStore } from '../../stores/application';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '../../components/common/PageHeader.vue';
import CardHeader from '../../components/common/CardHeader.vue';
import EmptyState from '../../components/common/EmptyState.vue';
import ApplicationCard from './components/ApplicationCard.vue';
import ApplicationCreateDialog from './components/ApplicationCreateDialog.vue';
import { Plus } from '@element-plus/icons-vue';

const router = useRouter();
const applicationStore = useApplicationStore();
const { applications, loading, error } = storeToRefs(applicationStore);

const showCreateDialog = ref(false);

onMounted(() => {
    applicationStore.fetchApplications();
});

function viewApplication(id: string) {
    router.push(`/application/${id}`);
}

function handleCommand(command: { action: string; id: string }) {
    if (command.action === 'view') {
        viewApplication(command.id);
    } else if (command.action === 'edit') {
        // TODO: 实现编辑功能
        ElMessage.info('编辑功能待实现');
    } else if (command.action === 'delete') {
        handleDelete(command.id);
    }
}

async function handleDelete(id: string) {
    try {
        await ElMessageBox.confirm(
            '确定要删除这个应用吗？删除后应用下的项目不会被删除。',
            '确认删除',
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning',
            }
        );

        await applicationStore.deleteApplication(id);
        ElMessage.success('应用删除成功');
    } catch (err: any) {
        if (err !== 'cancel') {
            ElMessage.error(err.message || '删除应用失败');
        }
    }
}

async function handleCreate(data: { name: string; description: string }) {
    try {
        await applicationStore.createApplication({
            name: data.name,
            description: data.description,
        });

        ElMessage.success('应用创建成功！');
        showCreateDialog.value = false;
    } catch (err: any) {
        ElMessage.error(err.message || '创建应用失败');
    }
}
</script>

<style scoped>
.application-list {
    max-width: 100%;
}

.content-section {
    min-height: 400px;
}

.actions-card {
    margin-bottom: 24px;
}

.applications-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
}
</style>
