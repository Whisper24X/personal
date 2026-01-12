<template>
  <el-card class="knowledge-base-card">
    <template #header>
      <CardHeader title="知识库" :icon="Collection">
        <template #right>
          <el-button type="primary" @click="handleManage">
            <el-icon><Plus /></el-icon>
            管理知识库
          </el-button>
        </template>
      </CardHeader>
    </template>
    <div class="knowledge-base-content">
      <el-text type="info">
        知识库用于存储项目相关的参考文档，这些文档会被自动索引到向量数据库，用于RAG检索增强生成。
      </el-text>
      <el-button type="primary" style="margin-top: 16px" @click="handleManage">
        <el-icon><Collection /></el-icon>
        前往知识库管理
      </el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import CardHeader from '../../../components/common/CardHeader.vue';
import { Collection, Plus } from '@element-plus/icons-vue';

const emit = defineEmits<{
  manage: [];
}>();

function handleManage() {
  emit('manage');
}
</script>

<style scoped>
.knowledge-base-card {
  margin-top: 20px;
}

.knowledge-base-content {
  text-align: center;
  padding: 20px;
}
</style>

