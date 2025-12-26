<template>
    <div class="application-list">
        <el-page-header class="page-header">
            <template #content>
                <div class="header-content">
                    <span class="header-title">应用管理</span>
                    <p class="header-desc">管理您的应用，每个应用可以包含多个项目</p>
                </div>
            </template>
        </el-page-header>

        <div v-loading="loading" class="content-section">
            <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

            <el-card class="actions-card">
                <template #header>
                    <div class="card-header-content">
                        <span class="card-title">应用列表</span>
                        <el-button type="primary" @click="showCreateDialog = true">
                            <el-icon>
                                <Plus />
                            </el-icon>
                            新建应用
                        </el-button>
                    </div>
                </template>

                <el-empty v-if="applications.length === 0" description="还没有应用。创建您的第一个应用！">
                    <el-button type="primary" @click="showCreateDialog = true">
                        创建应用
                    </el-button>
                </el-empty>

                <div v-else class="applications-grid">
                    <el-card v-for="app in applications" :key="app.id" shadow="hover" class="application-card"
                        @click="viewApplication(app.id)">
                        <div class="application-header">
                            <div class="application-info">
                                <h3 class="application-name">
                                    <el-icon>
                                        <Box />
                                    </el-icon>
                                    {{ app.name }}
                                </h3>
                                <p v-if="app.description" class="application-desc">
                                    {{ app.description }}
                                </p>
                            </div>
                            <el-dropdown @command="handleCommand" trigger="click">
                                <el-button type="text" :icon="MoreFilled" circle />
                                <template #dropdown>
                                    <el-dropdown-menu>
                                        <el-dropdown-item :command="{ action: 'view', id: app.id }">
                                            查看详情
                                        </el-dropdown-item>
                                        <el-dropdown-item :command="{ action: 'edit', id: app.id }">
                                            编辑
                                        </el-dropdown-item>
                                        <el-dropdown-item :command="{ action: 'delete', id: app.id }" divided>
                                            删除
                                        </el-dropdown-item>
                                    </el-dropdown-menu>
                                </template>
                            </el-dropdown>
                        </div>

                        <el-divider />

                        <div class="application-stats">
                            <div class="stat-item">
                                <el-icon>
                                    <Folder />
                                </el-icon>
                                <span>项目数: <strong>{{ app.projectCount }}</strong></span>
                            </div>
                            <div class="stat-item">
                                <el-icon>
                                    <Clock />
                                </el-icon>
                                <span>创建于 {{ formatDate(app.createdAt) }}</span>
                            </div>
                        </div>
                    </el-card>
                </div>
            </el-card>
        </div>

        <!-- 创建应用对话框 -->
        <el-dialog v-model="showCreateDialog" title="创建新应用" width="600px" @close="resetForm">
            <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-position="top">
                <el-form-item label="应用名称" prop="name">
                    <el-input v-model="createForm.name" placeholder="我的应用" :prefix-icon="Edit" />
                </el-form-item>

                <el-form-item label="应用描述" prop="description">
                    <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="描述这个应用的用途..."
                        show-word-limit :maxlength="500" />
                </el-form-item>
            </el-form>

            <template #footer>
                <el-button @click="showCreateDialog = false">取消</el-button>
                <el-button type="primary" :loading="loading" @click="handleCreate">
                    创建
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApplicationStore } from '../stores/application';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import {
    Plus,
    Box,
    Folder,
    Clock,
    Edit,
    MoreFilled
} from '@element-plus/icons-vue';

const router = useRouter();
const applicationStore = useApplicationStore();
const { applications, loading, error } = storeToRefs(applicationStore);

const showCreateDialog = ref(false);
const createFormRef = ref<FormInstance>();

const createForm = reactive({
    name: '',
    description: '',
});

const createRules = reactive<FormRules>({
    name: [
        { required: true, message: '请输入应用名称', trigger: 'blur' },
        { min: 2, max: 100, message: '长度应在 2 到 100 个字符之间', trigger: 'blur' }
    ],
});

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

async function handleCreate() {
    if (!createFormRef.value) return;

    await createFormRef.value.validate(async (valid) => {
        if (valid) {
            try {
                await applicationStore.createApplication({
                    name: createForm.name,
                    description: createForm.description,
                });

                ElMessage.success('应用创建成功！');
                showCreateDialog.value = false;
            } catch (err: any) {
                ElMessage.error(err.message || '创建应用失败');
            }
        }
    });
}

function resetForm() {
    createForm.name = '';
    createForm.description = '';
    createFormRef.value?.resetFields();
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
}
</script>

<style scoped>
.application-list {
    max-width: 100%;
}

.page-header {
    margin-bottom: 24px;
}

.header-content {
    display: flex;
    flex-direction: column;
}

.header-title {
    font-size: 28px;
    font-weight: bold;
    color: #303133;
}

.header-desc {
    color: #909399;
    margin-top: 8px;
    margin-bottom: 0;
}

.content-section {
    min-height: 400px;
}

.actions-card {
    margin-bottom: 24px;
}

.card-header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.card-title {
    font-size: 18px;
    font-weight: 600;
}

.applications-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
}

.application-card {
    cursor: pointer;
    transition: all 0.3s;
}

.application-card:hover {
    transform: translateY(-2px);
}

.application-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.application-info {
    flex: 1;
}

.application-name {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.application-desc {
    color: #909399;
    font-size: 14px;
    margin: 0;
    line-height: 1.5;
}

.application-stats {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #606266;
    font-size: 14px;
}
</style>
