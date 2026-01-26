<template>
    <div class="business-line-list">
        <PageHeader
            title="业务线管理"
            description="管理您的业务线，每个业务线可以包含多个平台"
            :show-back="true"
            :back-handler="() => router.push('/')"
        />

        <div v-loading="loading" class="content-section">
            <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

            <el-card class="actions-card">
                <template #header>
                    <CardHeader title="业务线列表">
                        <template #right>
                            <el-button type="primary" @click="showCreateDialog = true">
                                <el-icon>
                                    <Plus />
                                </el-icon>
                                新建业务线
                            </el-button>
                        </template>
                    </CardHeader>
                </template>

                <EmptyState
                    v-if="businessLines.length === 0"
                    description="还没有业务线。创建您的第一个业务线！"
                    action-text="创建业务线"
                    :action-handler="() => showCreateDialog = true"
                />

                <el-table
                    v-else
                    :data="businessLines"
                    stripe
                    style="width: 100%"
                >
                    <el-table-column prop="name" label="名称" min-width="200">
                        <template #default="{ row }">
                            <el-icon style="margin-right: 8px; vertical-align: middle;">
                                <Box />
                            </el-icon>
                            <span>{{ row.name }}</span>
                        </template>
                    </el-table-column>
                    <el-table-column prop="description" label="描述" min-width="250" show-overflow-tooltip />
                    <el-table-column prop="platformCount" label="平台数" width="100" align="center">
                        <template #default="{ row }">
                            {{ row.platformCount || row.projectCount || 0 }}
                        </template>
                    </el-table-column>
                    <el-table-column prop="createdAt" label="创建时间" width="180">
                        <template #default="{ row }">
                            {{ formatDate(row.createdAt) }}
                        </template>
                    </el-table-column>
                    <el-table-column label="操作" width="250" fixed="right">
                        <template #default="{ row }">
                            <div class="action-buttons">
                                <el-button type="primary" size="small" @click="viewPlatforms(row.id)">
                                    <el-icon><Monitor /></el-icon>
                                    查看平台
                                </el-button>
                                <el-button size="small" @click="openEditDialog(row.id)">
                                    <el-icon><Edit /></el-icon>
                                    编辑
                                </el-button>
                                <el-button type="danger" plain size="small" @click="handleDelete(row.id)">
                                    <el-icon><Delete /></el-icon>
                                    删除
                                </el-button>
                            </div>
                        </template>
                    </el-table-column>
                </el-table>
            </el-card>
        </div>

        <!-- 创建业务线弹框 -->
        <BusinessLineCreateDialog
            v-model="showCreateDialog"
            @created="onCreated"
        />

        <!-- 编辑业务线弹框 -->
        <BusinessLineEditDialog
            v-model="showEditDialog"
            :business-line-id="editingId"
            @updated="onUpdated"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useBusinessLineStore } from '../../stores/businessLine';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '../../components/common/PageHeader.vue';
import CardHeader from '../../components/common/CardHeader.vue';
import EmptyState from '../../components/common/EmptyState.vue';
import BusinessLineCreateDialog from './components/BusinessLineCreateDialog.vue';
import BusinessLineEditDialog from './components/BusinessLineEditDialog.vue';
import { Plus, Box, Monitor, Edit, Delete } from '@element-plus/icons-vue';

const router = useRouter();
const businessLineStore = useBusinessLineStore();
const { businessLines, loading, error } = storeToRefs(businessLineStore);

const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const editingId = ref('');

onMounted(() => {
    businessLineStore.fetchBusinessLines();
});

function onCreated() {
    businessLineStore.fetchBusinessLines();
}

function onUpdated() {
    businessLineStore.fetchBusinessLines();
}

function openEditDialog(id: string) {
    editingId.value = id;
    showEditDialog.value = true;
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
}

function viewPlatforms(id: string) {
    router.push(`/business-line/${id}/platforms`);
}

async function handleDelete(id: string) {
    try {
        await ElMessageBox.confirm(
            '确定要删除这个业务线吗？删除后业务线下的平台不会被删除。',
            '确认删除',
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning',
            }
        );

        await businessLineStore.deleteBusinessLine(id);
        ElMessage.success('业务线删除成功');
    } catch (err: any) {
        if (err !== 'cancel') {
            ElMessage.error(err.message || '删除业务线失败');
        }
    }
}
</script>

<style scoped>
.business-line-list {
    max-width: 100%;
}

.content-section {
    min-height: 400px;
}

.actions-card {
    margin-bottom: 24px;
}

.action-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
</style>
