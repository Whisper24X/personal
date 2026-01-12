<template>
  <el-card class="messages-card">
    <template #header>
      <CardHeader title="消息" :icon="ChatLineRound" :badge="messages.length" />
    </template>

    <EmptyState
      v-if="messages.length === 0"
      description="暂无消息"
      :image-size="100"
    />

    <el-scrollbar v-else max-height="500px">
      <el-timeline>
        <el-timeline-item
          v-for="message in messages"
          :key="message.id"
          :timestamp="message.causeBy"
          placement="top"
        >
          <el-card class="message-card">
            <template #header>
              <div class="message-header">
                <el-tag :type="getRoleType(message.roleType)" effect="plain">
                  {{ message.roleType }}
                </el-tag>
              </div>
            </template>
            <el-text class="message-content">
              {{ message.content.substring(0, 300) }}
              <span v-if="message.content.length > 300">...</span>
            </el-text>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-scrollbar>
  </el-card>
</template>

<script setup lang="ts">
import CardHeader from '../../../components/common/CardHeader.vue';
import EmptyState from '../../../components/common/EmptyState.vue';
import { ChatLineRound } from '@element-plus/icons-vue';

interface Message {
  id: string;
  roleType: string;
  content: string;
  causeBy: string;
}

interface Props {
  messages: Message[];
}

defineProps<Props>();

function getRoleType(role: string): 'success' | 'warning' | 'info' | 'danger' {
  const roleMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    ProductManager: 'success',
    Architect: 'warning',
    Engineer: 'info',
  };
  return roleMap[role] || 'info';
}
</script>

<style scoped>
.message-card {
  margin-bottom: 0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.message-content {
  white-space: pre-wrap;
}
</style>

