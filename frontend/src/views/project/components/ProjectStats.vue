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
      <el-col :xs="12" :sm="12" v-if="hasActionCounts">
        <el-statistic title="已完成动作" :value="completedActions" :suffix="`/ ${totalActions}`">
          <template #prefix>
            <el-icon>
              <Check />
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
import { computed } from 'vue';
import { TrendCharts, Check } from '@element-plus/icons-vue';

interface Props {
  project: {
    progress: number;
    status: string;
    completedActions?: number;
    totalActions?: number;
  };
}

const props = defineProps<Props>();

const hasActionCounts = computed(() => {
  return props.project.completedActions !== undefined && props.project.totalActions !== undefined;
});

const completedActions = computed(() => props.project.completedActions || 0);
const totalActions = computed(() => props.project.totalActions || 0);
</script>

<style scoped>
.stats-card {
  margin-bottom: 0;
}

.progress-bar {
  margin-top: 24px;
}
</style>

