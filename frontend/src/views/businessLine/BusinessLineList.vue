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

                <div v-else class="business-lines-grid">
                    <BusinessLineCard
                        v-for="bl in businessLines"
                        :key="bl.id"
                        :business-line="bl"
                        @view-platforms="viewPlatforms"
                        @edit="openEditDialog"
                        @delete="handleDelete"
                    />
                </div>
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
import BusinessLineCard from './components/BusinessLineCard.vue';
import BusinessLineCreateDialog from './components/BusinessLineCreateDialog.vue';
import BusinessLineEditDialog from './components/BusinessLineEditDialog.vue';
import { Plus } from '@element-plus/icons-vue';

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

.business-lines-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
}
</style>
