<template>
  <el-card class="completion-card">
    <el-result icon="success" title="项目生成完成！" sub-title="所有步骤已完成，您可以查看生成的文档和代码">
      <template #extra>
        <el-space>
          <el-button type="primary" size="large" @click="$emit('view-project')">
            查看项目详情
          </el-button>
          <el-button size="large" @click="$emit('download-project')">
            下载项目文件
          </el-button>
        </el-space>
      </template>
    </el-result>

    <el-divider />

    <div class="summary-section">
      <h3>
        <el-icon>
          <DataAnalysis />
        </el-icon>
        执行摘要
      </h3>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="总步骤数">
          {{ completedSteps.length }}
        </el-descriptions-item>
        <el-descriptions-item label="编辑次数">
          {{ editCount }}
        </el-descriptions-item>
        <el-descriptions-item label="重新生成次数">
          {{ regenerateCount }}
        </el-descriptions-item>
        <el-descriptions-item label="跳过次数">
          {{ skipCount }}
        </el-descriptions-item>
        <el-descriptions-item label="总耗时">
          {{ totalDuration }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DataAnalysis } from '@element-plus/icons-vue';

const props = defineProps<{
  completedSteps: any[];
  startTime: number;
}>();

defineEmits<{
  'view-project': [];
  'download-project': [];
}>();

const editCount = computed(() => props.completedSteps.filter(s => s.userAction === 'edit').length);
const regenerateCount = computed(() => props.completedSteps.filter(s => s.userAction === 'regenerate').length);
const skipCount = computed(() => props.completedSteps.filter(s => s.userAction === 'skip').length);
const totalDuration = computed(() => {
  const duration = Date.now() - props.startTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${minutes}分${seconds}秒`;
});
</script>

<style scoped>
.completion-card {
  margin-top: 24px;
  border: 2px solid #67C23A;
}

.summary-section {
  padding: 20px;
}

.summary-section h3 {
  margin: 0 0 20px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #303133;
}
</style>

