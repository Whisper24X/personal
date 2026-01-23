<template>
  <div class="system-config">
    <PageHeader
      title="系统配置"
      description="配置 LLM 服务商、角色和提示词"
      :back-handler="() => router.push('/')"
    />

    <el-tabs v-model="activeTab" type="border-card" class="config-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="LLM 服务商" name="llm">
        <LLMConfigPanel />
      </el-tab-pane>
      <el-tab-pane label="角色配置" name="roles">
        <RoleConfigPanel />
      </el-tab-pane>
      <el-tab-pane label="提示词" name="prompts">
        <PromptConfigPanel />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import PageHeader from '../../components/common/PageHeader.vue';
import LLMConfigPanel from './panels/LLMConfigPanel.vue';
import RoleConfigPanel from './panels/RoleConfigPanel.vue';
import PromptConfigPanel from './panels/PromptConfigPanel.vue';

const router = useRouter();
const route = useRoute();

const activeTab = ref('llm');

// 从 URL query 参数初始化 tab
onMounted(() => {
  const tab = route.query.tab as string;
  if (tab && ['llm', 'roles', 'prompts'].includes(tab)) {
    activeTab.value = tab;
  }
});

// Tab 切换时更新 URL
function handleTabChange(tabName: string) {
  router.replace({ query: { tab: tabName } });
}
</script>

<style scoped>
.system-config {
  max-width: 100%;
}

.config-tabs {
  margin-top: 20px;
}

.config-tabs :deep(.el-tabs__content) {
  padding: 20px;
  min-height: 500px;
}
</style>
