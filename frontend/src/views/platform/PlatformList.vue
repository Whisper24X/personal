<template>
  <div class="platform-list">
    <PageHeader
      :title="`${businessLine?.name || '业务线'} - 平台列表`"
      description="管理该业务线下的所有平台"
      :back-handler="() => router.push('/business-lines')"
    />

    <div v-loading="loading" class="content-section">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

      <el-card class="actions-card">
        <template #header>
          <CardHeader title="平台列表">
            <template #right>
              <el-button type="primary" @click="showCreateDialog = true">
                <el-icon>
                  <Plus />
                </el-icon>
                创建平台
              </el-button>
              <el-button @click="goToWorkflowManagement">
                <el-icon>
                  <Setting />
                </el-icon>
                工作流管理
              </el-button>
            </template>
          </CardHeader>
        </template>

        <EmptyState
          v-if="platforms.length === 0"
          description="该业务线下还没有平台。创建第一个平台！"
          action-text="创建平台"
          :action-handler="() => showCreateDialog = true"
        />

        <div v-else class="platforms-grid">
          <PlatformCard
            v-for="platform in platforms"
            :key="platform.id"
            :platform="platform"
            @view="goToVersions"
            @knowledge="goToKnowledgeBase"
            @edit="openEditDialog"
            @delete="handleDelete"
          />
        </div>
      </el-card>
    </div>

    <!-- 创建平台弹框 -->
    <PlatformCreateDialog
      v-model="showCreateDialog"
      :business-line-id="businessLineId"
      @created="onCreated"
    />

    <!-- 编辑平台弹框 -->
    <PlatformEditDialog
      v-model="showEditDialog"
      :platform-id="editingId"
      @updated="onUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onActivated, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useBusinessLineStore } from '../../stores/businessLine';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import { apiClient } from '../../api/client';
import PageHeader from '../../components/common/PageHeader.vue';
import CardHeader from '../../components/common/CardHeader.vue';
import EmptyState from '../../components/common/EmptyState.vue';
import PlatformCard from './components/PlatformCard.vue';
import PlatformCreateDialog from './components/PlatformCreateDialog.vue';
import PlatformEditDialog from './components/PlatformEditDialog.vue';
import { Plus, Setting } from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const businessLineStore = useBusinessLineStore();
const { currentBusinessLine } = storeToRefs(businessLineStore);

const businessLineId = computed(() => route.params.id as string);
const businessLine = computed(() => currentBusinessLine.value);

const platforms = ref<any[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const editingId = ref('');

async function fetchPlatforms() {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.getBusinessLinePlatforms(businessLineId.value) as any;
    platforms.value = response.projects || response.platforms || [];
  } catch (err: any) {
    error.value = err.message || '获取平台列表失败';
    ElMessage.error(error.value || '获取平台列表失败');
  } finally {
    loading.value = false;
  }
}

async function fetchBusinessLine() {
  try {
    await businessLineStore.fetchBusinessLine(businessLineId.value);
  } catch (err: any) {
    ElMessage.error('获取业务线信息失败');
  }
}

// Listen for page visibility changes to refresh when user returns
const visibilityHandler = () => {
  if (!document.hidden) {
    fetchPlatforms();
  }
};

// Listen for custom refresh event from router guard
const refreshHandler = () => {
  fetchPlatforms();
};

onMounted(async () => {
  await fetchBusinessLine();
  await fetchPlatforms();
  document.addEventListener('visibilitychange', visibilityHandler);
  window.addEventListener('refresh-platform-list', refreshHandler);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', visibilityHandler);
  window.removeEventListener('refresh-platform-list', refreshHandler);
});

// Refresh when component is activated (if using keep-alive)
onActivated(() => {
  fetchPlatforms();
});

function onCreated() {
  fetchPlatforms();
}

function onUpdated() {
  fetchPlatforms();
}

function openEditDialog(id: string) {
  editingId.value = id;
  showEditDialog.value = true;
}

function goToVersions(id: string) {
  router.push(`/platform/${id}/versions`);
}

function goToKnowledgeBase(id: string) {
  router.push(`/platform/${id}/knowledge-base`);
}

function goToWorkflowManagement() {
  router.push(`/business-line/${businessLineId.value}/workflows`);
}

async function handleDelete(id: string) {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个平台吗？删除后无法恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await apiClient.deletePlatform(id);
    ElMessage.success('平台删除成功');
    await fetchPlatforms();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除平台失败');
    }
  }
}
</script>

<style scoped>
.platform-list {
  max-width: 100%;
}

.content-section {
  min-height: 400px;
}

.actions-card {
  margin-bottom: 24px;
}

.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
</style>
