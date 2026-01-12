<template>
  <el-card class="stats-card">
    <el-row :gutter="20">
      <el-col :xs="12" :sm="12">
        <el-statistic title="进度" :value="project.progress" suffix="%">
          <template #prefix>
            <el-icon>
              <TrendCharts />
            </el-icon>
          </template>
        </el-statistic>
      </el-col>
      <el-col :xs="12" :sm="12">
        <el-statistic title="当前轮次" :value="project.currentRound" :suffix="`/ ${project.nRound}`">
          <template #prefix>
            <el-icon>
              <Refresh />
            </el-icon>
          </template>
        </el-statistic>
      </el-col>
    </el-row>

    <el-progress
      v-if="project.status === 'running'"
      :percentage="project.progress"
      :status="project.progress === 100 ? 'success' : undefined"
      :stroke-width="12"
      striped
      striped-flow
      class="progress-bar"
    />
  </el-card>
</template>

<script setup lang="ts">
import { TrendCharts, Refresh } from '@element-plus/icons-vue';

interface Props {
  project: {
    progress: number;
    currentRound: number;
    nRound: number;
    status: string;
  };
}

defineProps<Props>();
</script>

<style scoped>
.stats-card {
  margin-bottom: 0;
}

.progress-bar {
  margin-top: 24px;
}
</style>

