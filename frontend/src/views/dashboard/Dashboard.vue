<template>
  <div class="dashboard">
    <PageHeader title="控制面板" description="系统概览与快捷入口" :show-back="false" />

    <div v-loading="loading" class="content-section">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

      <div v-else>
        <!-- 统计卡片区域 -->
        <el-row :gutter="20" class="stats-row">
          <el-col :span="8">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-content">
                <div class="stat-icon business-line-icon">
                  <el-icon :size="32"><Box /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ businessLineCount }}</div>
                  <div class="stat-label">业务线数</div>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-content">
                <div class="stat-icon platform-icon">
                  <el-icon :size="32"><Monitor /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ platformCount }}</div>
                  <div class="stat-label">平台总数</div>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-content">
                <div class="stat-icon completed-icon">
                  <el-icon :size="32"><CircleCheck /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ completedCount }}</div>
                  <div class="stat-label">完成平台数</div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <!-- 快捷入口 -->
        <el-card class="quick-actions-card">
          <template #header>
            <CardHeader title="快捷入口" />
          </template>
          
          <div class="quick-actions">
            <el-button type="primary" size="large" @click="router.push('/business-lines')">
              <el-icon><Box /></el-icon>
              查看业务线列表
            </el-button>
            <el-button size="large" @click="router.push('/config/llm')">
              <el-icon><Setting /></el-icon>
              大模型配置
            </el-button>
            <el-button size="large" @click="router.push('/config/role-llm')">
              <el-icon><UserFilled /></el-icon>
              角色LLM配置
            </el-button>
            <el-button size="large" @click="router.push('/config/prompts')">
              <el-icon><Document /></el-icon>
              提示词配置
            </el-button>
          </div>
        </el-card>

        <!-- 最近业务线 -->
        <el-card class="recent-card" v-if="businessLines.length > 0">
          <template #header>
            <CardHeader title="最近业务线">
              <template #right>
                <el-button type="primary" text @click="router.push('/business-lines')">
                  查看全部
                  <el-icon><ArrowRight /></el-icon>
                </el-button>
              </template>
            </CardHeader>
          </template>

          <div class="business-lines-grid">
            <el-card
              v-for="bl in businessLines.slice(0, 4)"
              :key="bl.id"
              shadow="hover"
              class="bl-card"
              @click="router.push(`/business-line/${bl.id}/platforms`)"
            >
              <div class="bl-header">
                <el-icon><Box /></el-icon>
                <span class="bl-name">{{ bl.name }}</span>
              </div>
              <p class="bl-desc">{{ bl.description || '暂无描述' }}</p>
              <div class="bl-stats">
                <el-tag size="small">{{ bl.platformCount || bl.projectCount || 0 }} 个平台</el-tag>
              </div>
            </el-card>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { usePlatformStore } from '../../stores/platform';
import { useBusinessLineStore } from '../../stores/businessLine';
import { storeToRefs } from 'pinia';
import PageHeader from '../../components/common/PageHeader.vue';
import CardHeader from '../../components/common/CardHeader.vue';
import { Box, Monitor, CircleCheck, Setting, UserFilled, Document, ArrowRight } from '@element-plus/icons-vue';

const router = useRouter();
const platformStore = usePlatformStore();
const businessLineStore = useBusinessLineStore();
const { loading, error, platformCount, completedCount } = storeToRefs(platformStore);
const { businessLines, businessLineCount } = storeToRefs(businessLineStore);

function refreshData() {
  platformStore.fetchPlatforms();
  businessLineStore.fetchBusinessLines();
}

// Listen for page visibility changes to refresh when user returns to the page
const visibilityHandler = () => {
  if (!document.hidden) {
    refreshData();
  }
};

// Listen for custom refresh event from router guard
const refreshHandler = () => {
  refreshData();
};

onMounted(() => {
  refreshData();
  document.addEventListener('visibilitychange', visibilityHandler);
  window.addEventListener('refresh-platform-list', refreshHandler);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', visibilityHandler);
  window.removeEventListener('refresh-platform-list', refreshHandler);
});

// Refresh when component is activated (if using keep-alive)
onActivated(() => {
  refreshData();
});
</script>

<style scoped>
.dashboard {
  max-width: 100%;
}

.content-section {
  min-height: 400px;
}

.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  cursor: default;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px;
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.business-line-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.platform-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.completed-icon {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.quick-actions-card {
  margin-bottom: 24px;
}

.quick-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.quick-actions .el-button {
  min-width: 160px;
}

.recent-card {
  margin-bottom: 24px;
}

.business-lines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.bl-card {
  cursor: pointer;
  transition: all 0.3s;
}

.bl-card:hover {
  transform: translateY(-2px);
}

.bl-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.bl-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.bl-desc {
  color: #909399;
  font-size: 14px;
  margin: 0 0 12px 0;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.bl-stats {
  display: flex;
  gap: 8px;
}
</style>
