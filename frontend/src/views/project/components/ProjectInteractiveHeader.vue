<template>
  <el-page-header @back="$emit('back')" class="page-header">
    <template #content>
      <div class="header-content">
        <span class="header-title">
          <el-icon>
            <MagicStick />
          </el-icon>
          交互式项目生成
        </span>
        <p class="header-desc">在每个步骤人工确认和审查</p>
      </div>
    </template>
  </el-page-header>
</template>

<script setup lang="ts">
import { MagicStick } from '@element-plus/icons-vue';

defineEmits<{
  back: [];
}>();
</script>

<style scoped>
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
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-desc {
  color: #909399;
  margin-top: 8px;
  margin-bottom: 0;
}
</style>

