<template>
  <el-dialog v-model="visible" :title="title" width="80%" destroy-on-close>
    <div class="content-dialog-body">
      <div class="content-dialog-info">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="角色">
            {{ roleDisplayName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="操作">
            {{ actionDisplayName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag type="success" size="small">已完成</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="时间" v-if="timestamp">
            {{ timestamp }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <el-divider />
      <div class="content-dialog-content">
        <div class="content-text">{{ content }}</div>
      </div>
    </div>
    <template #footer>
      <el-button @click="$emit('update:model-value', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  role?: string;
  action?: string;
  content: string;
  timestamp?: string;
  roleDisplayName?: string;
  actionDisplayName?: string;
}>();

const emit = defineEmits<{
  'update:model-value': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:model-value', value);
  },
});

const title = computed(() => {
  if (props.roleDisplayName && props.actionDisplayName) {
    return `${props.roleDisplayName} - ${props.actionDisplayName}`;
  }
  return '查看内容';
});
</script>

<style scoped>
.content-dialog-body {
  max-height: 70vh;
  overflow-y: auto;
}

.content-dialog-info {
  margin-bottom: 16px;
}

.content-dialog-content {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
  border-left: 3px solid #409EFF;
}

.content-dialog-content .content-text {
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  color: #303133;
}
</style>

