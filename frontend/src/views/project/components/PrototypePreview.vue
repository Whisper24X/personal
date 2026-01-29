<template>
  <div class="prototype-preview">
    <div class="preview-header">
      <h4>
        <el-icon><View /></el-icon>
        原型预览
      </h4>
      <el-button-group size="small">
        <el-button :icon="Refresh" @click="refreshPreview" :loading="loading">刷新</el-button>
        <el-button :icon="FullScreen" @click="toggleFullscreen">全屏</el-button>
      </el-button-group>
    </div>

    <!-- File List (if multiple files) -->
    <div v-if="files.length > 1" class="file-list">
      <el-tabs v-model="selectedFile" @tab-change="handleFileChange">
        <el-tab-pane
          v-for="file in files"
          :key="file.filename"
          :label="file.filename"
          :name="file.filename"
        />
      </el-tabs>
    </div>

    <!-- Preview Container -->
    <div class="preview-container" :class="{ 'fullscreen': isFullscreen }">
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="5" animated />
      </div>
      <div v-else-if="error" class="error-container">
        <el-alert type="error" :title="error" :closable="false" show-icon />
        <el-button type="primary" @click="loadPrototype">重试</el-button>
      </div>
      <div v-else-if="!prototypeContent" class="empty-container">
        <el-empty description="暂无原型文件">
          <el-button type="primary" @click="generatePrototype">生成原型</el-button>
        </el-empty>
      </div>
      <iframe
        v-else
        :srcdoc="prototypeContent"
        class="preview-iframe"
        frameborder="0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>

    <!-- Fullscreen Overlay -->
    <div v-if="isFullscreen" class="fullscreen-overlay" @click="toggleFullscreen">
      <div class="fullscreen-content" @click.stop>
        <div class="fullscreen-header">
          <span>原型预览 - {{ selectedFile }}</span>
          <el-button :icon="Close" circle @click="toggleFullscreen" />
        </div>
        <iframe
          :srcdoc="prototypeContent"
          class="fullscreen-iframe"
          frameborder="0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { View, Refresh, FullScreen, Close } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import apiClient from '@/api/client';

interface Props {
  projectId: string;
  prdId: string;
  autoLoad?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoLoad: true,
});

const emit = defineEmits<{
  (e: 'prototype-generated'): void;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const files = ref<Array<{ filename: string; content: string; size: number }>>([]);
const selectedFile = ref<string>('');
const prototypeContent = ref<string>('');
const isFullscreen = ref(false);

onMounted(() => {
  if (props.autoLoad) {
    loadPrototype();
  }
});

watch(() => [props.projectId, props.prdId], () => {
  if (props.autoLoad) {
    loadPrototype();
  }
});

async function loadPrototype() {
  loading.value = true;
  error.value = null;

  try {
    const response = await apiClient.getPrototype(props.projectId, props.prdId) as unknown as {
      success: boolean;
      prototype?: {
        exists: boolean;
        files?: Array<{ filename: string; content: string; size: number }>;
        mainFile?: string;
      };
    };
    
    if (response.success && response.prototype?.exists) {
      files.value = response.prototype.files || [];
      if (files.value.length > 0) {
        selectedFile.value = response.prototype.mainFile || files.value[0].filename;
        loadFileContent(selectedFile.value);
      } else {
        prototypeContent.value = '';
      }
    } else {
      files.value = [];
      prototypeContent.value = '';
    }
  } catch (err: any) {
    const errorMessage = err.message || '加载原型失败';
    error.value = errorMessage;
    ElMessage.error(errorMessage);
  } finally {
    loading.value = false;
  }
}

async function loadFileContent(filename: string) {
  try {
    const file = files.value.find(f => f.filename === filename);
    if (file) {
      prototypeContent.value = file.content;
    } else {
      // Fallback: fetch from API
      const content = await apiClient.getPrototypeFile(props.projectId, props.prdId, filename) as unknown as string;
      prototypeContent.value = content;
    }
  } catch (err: any) {
    const errorMessage = `加载文件 ${filename} 失败: ${err.message}`;
    error.value = errorMessage;
    ElMessage.error(errorMessage);
  }
}

function handleFileChange(filename: string) {
  loadFileContent(filename);
}

function refreshPreview() {
  loadPrototype();
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}

async function generatePrototype() {
  loading.value = true;
  error.value = null;

  try {
    const response = await apiClient.generatePrototype(props.projectId, props.prdId) as unknown as {
      success: boolean;
      error?: string;
      message?: string;
    };
    
    if (response.success) {
      ElMessage.success('原型生成成功');
      emit('prototype-generated');
      // Reload prototype after generation
      await loadPrototype();
    } else {
      throw new Error(response.error || '生成原型失败');
    }
  } catch (err: any) {
    const errorMessage = err.message || '生成原型失败';
    error.value = errorMessage;
    ElMessage.error(errorMessage);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="scss">
.prototype-preview {
  margin-top: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color);

  h4 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
  }
}

.file-list {
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color);
}

.preview-container {
  position: relative;
  height: 600px;
  background-color: var(--el-bg-color);

  &.fullscreen {
    height: calc(100vh - 200px);
  }
}

.loading-container,
.error-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-content {
  width: 95%;
  height: 95%;
  background-color: var(--el-bg-color);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fullscreen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color);
  font-weight: 500;
}

.fullscreen-iframe {
  flex: 1;
  width: 100%;
  border: none;
}
</style>
