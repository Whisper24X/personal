<template>
  <el-dialog
    v-model="dialogVisible"
    title="查看工作流"
    width="70%"
    :close-on-click-modal="false"
  >
    <div v-if="workflow" class="workflow-view">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="工作流名称">{{ workflow.name }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="workflow.is_default" type="success">默认</el-tag>
          <el-tag v-else>普通</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">
          {{ workflow.description || '无' }}
        </el-descriptions-item>
        <el-descriptions-item label="角色数量" :span="2">
          {{ workflow.workflow_config?.roles?.length || 0 }}
        </el-descriptions-item>
      </el-descriptions>

      <el-divider>角色配置</el-divider>

      <el-timeline>
        <el-timeline-item
          v-for="(role, index) in sortedRoles"
          :key="index"
          :timestamp="`顺序: ${role.order}`"
          placement="top"
        >
          <el-card shadow="hover">
            <template #header>
              <div class="role-header">
                <span class="role-name">
                  {{ getRoleDisplayName(role.profile) }}
                  <el-tag v-if="role.name" size="small" style="margin-left: 8px">
                    {{ role.name }}
                  </el-tag>
                </span>
              </div>
            </template>

            <div class="role-details">
              <div class="detail-item">
                <strong>可用Actions:</strong>
                <div class="tags-container">
                  <el-tag
                    v-for="action in role.actions"
                    :key="action"
                    style="margin-right: 8px; margin-bottom: 8px"
                  >
                    {{ getActionDisplayName(action) }}
                  </el-tag>
                </div>
              </div>

              <div v-if="role.watch_actions && role.watch_actions.length > 0" class="detail-item">
                <strong>监听Actions:</strong>
                <div class="tags-container">
                  <el-tag
                    v-for="action in role.watch_actions"
                    :key="action"
                    type="info"
                    style="margin-right: 8px; margin-bottom: 8px"
                  >
                    {{ getActionDisplayName(action) }}
                  </el-tag>
                </div>
              </div>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoleActionStore } from '../../../stores/roleAction';

interface Props {
  modelValue: boolean;
  workflow?: any;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const roleActionStore = useRoleActionStore();

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const sortedRoles = computed(() => {
  if (!props.workflow?.workflow_config?.roles) return [];
  // 确保只返回工作流配置中定义的角色，按order排序
  return [...props.workflow.workflow_config.roles]
    .filter(role => role.profile) // 过滤掉无效的角色
    .sort((a, b) => (a.order || 0) - (b.order || 0));
});

function getRoleDisplayName(profile: string): string {
  const role = roleActionStore.roles.find((r) => r.profile === profile);
  return role?.displayName || profile;
}

function getActionDisplayName(actionName: string): string {
  const action = roleActionStore.actions.find((a) => a.name === actionName);
  return action?.displayName || actionName;
}
</script>

<style scoped>
.workflow-view {
  padding: 20px 0;
}

.role-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.role-name {
  font-size: 16px;
  font-weight: 600;
}

.role-details {
  margin-top: 12px;
}

.detail-item {
  margin-bottom: 16px;
}

.detail-item strong {
  display: block;
  margin-bottom: 8px;
  color: #606266;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
