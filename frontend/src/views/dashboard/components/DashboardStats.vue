<template>
  <el-row :gutter="20" class="stats-row">
    <el-col :xs="24" :sm="8">
      <StatCard title="项目总数" :value="projectCount" type="info">
        <template #prefix>
          <el-icon>
            <Folder />
          </el-icon>
        </template>
      </StatCard>
    </el-col>
    <el-col :xs="24" :sm="8">
      <StatCard title="已完成" :value="completedCount" type="success">
        <template #prefix>
          <el-icon>
            <CircleCheck />
          </el-icon>
        </template>
      </StatCard>
    </el-col>
    <el-col :xs="24" :sm="8">
      <StatCard title="进行中" :value="projectCount - completedCount" type="warning">
        <template #prefix>
          <el-icon>
            <Loading />
          </el-icon>
        </template>
      </StatCard>
    </el-col>
  </el-row>
</template>

<script setup lang="ts">
import StatCard from '../../../components/common/StatCard.vue';
import { Folder, CircleCheck, Loading } from '@element-plus/icons-vue';

interface Props {
  projectCount: number;
  completedCount: number;
}

defineProps<Props>();
</script>

<style scoped>
.stats-row {
  margin-bottom: 24px;
}
</style>

