<template>
  <div class="migration-panel">
    <div v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-bottom: 20px" />

      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 20px">
        <template #default>
          <div>
            <strong>警告：</strong>此操作将修改数据库中的工作流配置和执行记录。
            <br />
            建议在执行迁移前备份数据库。
          </div>
        </template>
      </el-alert>

      <el-card shadow="hover" class="migration-card">
        <template #header>
          <div class="card-header">
            <span>工作流配置迁移</span>
          </div>
        </template>

        <div class="migration-content">
          <p class="description">
            此功能将根据 <code>defaultWorkflowConfig.ts</code> 中的标准配置，自动检测并迁移数据库中的工作流配置。
          </p>

          <div class="migration-info">
            <h4>迁移范围：</h4>
            <ul>
              <li>更新 <code>application_workflows</code> 表中的工作流配置</li>
              <li>更新 <code>workflow_executions</code> 表中的工作流快照</li>
              <li>智能映射执行步骤（steps）</li>
              <li>调整当前执行位置（current_position）</li>
            </ul>
          </div>

          <div class="migration-actions">
            <el-button
              type="primary"
              size="large"
              :loading="loading"
              :disabled="loading"
              @click="handleMigrate"
            >
              <el-icon><Refresh /></el-icon>
              执行迁移
            </el-button>
          </div>
        </div>
      </el-card>

      <!-- Migration Results -->
      <el-card v-if="result" shadow="hover" class="result-card" style="margin-top: 20px">
        <template #header>
          <div class="card-header">
            <span>迁移结果</span>
            <el-tag :type="result.success ? 'success' : 'danger'" size="small">
              {{ result.success ? '成功' : '失败' }}
            </el-tag>
          </div>
        </template>

        <div v-if="result.success && result.data" class="result-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="工作流检查数">
              {{ result.data.workflowsChecked }}
            </el-descriptions-item>
            <el-descriptions-item label="工作流更新数">
              <el-tag type="success" size="small">{{ result.data.workflowsUpdated }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="执行记录检查数">
              {{ result.data.executionsChecked }}
            </el-descriptions-item>
            <el-descriptions-item label="执行记录更新数">
              <el-tag type="success" size="small">{{ result.data.executionsUpdated }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="快照更新数">
              {{ result.data.snapshotsUpdated }}
            </el-descriptions-item>
            <el-descriptions-item label="步骤更新数">
              {{ result.data.stepsUpdated }}
            </el-descriptions-item>
            <el-descriptions-item label="位置更新数">
              {{ result.data.positionsUpdated }}
            </el-descriptions-item>
          </el-descriptions>

          <!-- Changes Details -->
          <div v-if="result.data.changes && result.data.changes.length > 0" class="changes-section" style="margin-top: 20px">
            <h4>检测到的变更：</h4>
            <el-collapse>
              <el-collapse-item
                v-for="(change, index) in result.data.changes"
                :key="index"
                :title="change.name"
                :name="index"
              >
                <div class="change-details">
                  <div v-if="change.diff.addedRoles.length > 0" class="change-item">
                    <strong>新增角色：</strong>
                    <el-tag v-for="role in change.diff.addedRoles" :key="role" type="success" size="small" style="margin-left: 8px">
                      {{ role }}
                    </el-tag>
                  </div>
                  <div v-if="change.diff.removedRoles.length > 0" class="change-item">
                    <strong>删除角色：</strong>
                    <el-tag v-for="role in change.diff.removedRoles" :key="role" type="danger" size="small" style="margin-left: 8px">
                      {{ role }}
                    </el-tag>
                  </div>
                  <div v-if="change.diff.modifiedRoles.length > 0" class="change-item">
                    <strong>修改的角色：</strong>
                    <div v-for="mod in change.diff.modifiedRoles" :key="mod.profile" class="modified-role" style="margin-top: 8px">
                      <el-tag type="warning" size="small">{{ mod.profile }}</el-tag>
                      <div v-if="mod.addedActions.length > 0" style="margin-left: 16px; margin-top: 4px">
                        <span style="color: #67c23a">+ 新增动作：</span>
                        <el-tag
                          v-for="action in mod.addedActions"
                          :key="action"
                          type="success"
                          size="small"
                          style="margin-left: 4px"
                        >
                          {{ action }}
                        </el-tag>
                      </div>
                      <div v-if="mod.removedActions.length > 0" style="margin-left: 16px; margin-top: 4px">
                        <span style="color: #f56c6c">- 删除动作：</span>
                        <el-tag
                          v-for="action in mod.removedActions"
                          :key="action"
                          type="danger"
                          size="small"
                          style="margin-left: 4px"
                        >
                          {{ action }}
                        </el-tag>
                      </div>
                      <div v-if="mod.reorderedActions" style="margin-left: 16px; margin-top: 4px">
                        <el-tag type="info" size="small">动作顺序已调整</el-tag>
                      </div>
                      <div v-if="mod.watchActionsChanged" style="margin-left: 16px; margin-top: 4px">
                        <el-tag type="info" size="small">监听动作已变更</el-tag>
                      </div>
                    </div>
                  </div>
                  <div v-if="change.diff.roleOrderChanged" class="change-item">
                    <el-tag type="info" size="small">角色顺序已变更</el-tag>
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </div>

        <div v-else-if="!result.success" class="error-content">
          <el-alert :title="result.error || '迁移失败'" type="error" :closable="false" />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import apiClient from '../../../api/client';

const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

async function handleMigrate() {
  try {
    // Confirm before migration
    await ElMessageBox.confirm(
      '此操作将修改数据库中的工作流配置和执行记录。确定要继续吗？',
      '确认迁移',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    loading.value = true;
    error.value = null;
    result.value = null;

    const response = await apiClient.migrateWorkflowConfig();

    if (response.success) {
      result.value = response;
      ElMessage.success('迁移完成！');
    } else {
      error.value = response.error || '迁移失败';
      result.value = response;
      ElMessage.error('迁移失败：' + (response.error || '未知错误'));
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      // User didn't cancel
      error.value = err.message || '迁移失败';
      ElMessage.error('迁移失败：' + (err.message || '未知错误'));
    }
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.migration-panel {
  max-width: 100%;
}

.migration-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.migration-content {
  padding: 10px 0;
}

.description {
  margin-bottom: 20px;
  color: #606266;
  line-height: 1.6;
}

.description code {
  background-color: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  color: #e6a23c;
}

.migration-info {
  margin-bottom: 30px;
}

.migration-info h4 {
  margin-bottom: 10px;
  color: #303133;
}

.migration-info ul {
  margin-left: 20px;
  color: #606266;
  line-height: 1.8;
}

.migration-info li {
  margin-bottom: 8px;
}

.migration-info code {
  background-color: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  color: #409eff;
}

.migration-actions {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.result-card {
  margin-top: 20px;
}

.result-content {
  padding: 10px 0;
}

.changes-section {
  margin-top: 20px;
}

.changes-section h4 {
  margin-bottom: 15px;
  color: #303133;
}

.change-details {
  padding: 10px 0;
}

.change-item {
  margin-bottom: 12px;
}

.modified-role {
  margin-top: 12px;
  padding-left: 8px;
  border-left: 3px solid #e6a23c;
}

.error-content {
  padding: 10px 0;
}
</style>
