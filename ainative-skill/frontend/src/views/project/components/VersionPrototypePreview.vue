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

    <!-- Preview Container -->
    <div class="preview-container" :class="{ 'fullscreen': isFullscreen }">
      <!-- Loading overlay -->
      <div v-if="loading" class="loading-overlay">
        <el-skeleton :rows="5" animated />
      </div>
      
      <!-- Error state -->
      <div v-if="error && !loading" class="error-container">
        <el-alert type="error" :title="error" :closable="false" show-icon />
        <el-button type="primary" @click="refreshPreview">重试</el-button>
      </div>
      
      <!-- Empty state -->
      <div v-if="!previewUrl && !loading && !error" class="empty-container">
        <el-empty description="暂无原型文件" />
      </div>
      
      <!-- Iframe - always render when URL exists -->
      <iframe
        v-if="previewUrl"
        ref="previewIframe"
        :src="previewUrl"
        class="preview-iframe"
        :class="{ 'loading': loading }"
        frameborder="0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        @load="handleIframeLoad"
        @error="handleIframeError"
      />
    </div>

    <!-- Fullscreen Overlay -->
    <div v-if="isFullscreen" class="fullscreen-overlay" @click="toggleFullscreen">
      <div class="fullscreen-content" @click.stop>
        <div class="fullscreen-header">
          <span>原型预览</span>
          <el-button :icon="Close" circle @click="toggleFullscreen" />
        </div>
        <iframe
          :src="previewUrl"
          class="fullscreen-iframe"
          frameborder="0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { View, Refresh, FullScreen, Close } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

interface Props {
  previewUrl: string;
  autoLoad?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoLoad: true,
});

const loading = ref(true); // 初始为true，等待iframe加载
const error = ref<string | null>(null);
const isFullscreen = ref(false);
const previewIframe = ref<HTMLIFrameElement | null>(null);
let loadTimeout: ReturnType<typeof setTimeout> | null = null;

// 监听URL变化，重置加载状态并重新加载iframe
watch(() => props.previewUrl, (newUrl, oldUrl) => {
  // 清除之前的超时
  if (loadTimeout) {
    clearTimeout(loadTimeout);
    loadTimeout = null;
  }
  
  if (newUrl) {
    loading.value = true;
    error.value = null;
    
    // 设置超时：如果30秒内没有加载完成，自动取消loading状态
    loadTimeout = setTimeout(() => {
      if (loading.value) {
        loading.value = false;
        // 不设置错误，因为可能内容已经加载，只是load事件没有触发
        console.warn('Iframe load timeout, but content may have loaded');
      }
    }, 30000);
    
    // 如果URL变化，强制重新加载iframe
    if (newUrl !== oldUrl) {
      nextTick(() => {
        if (previewIframe.value) {
          // 先清空src，再设置新的，确保触发重新加载
          previewIframe.value.src = '';
          setTimeout(() => {
            if (previewIframe.value) {
              previewIframe.value.src = newUrl;
            }
          }, 50);
        }
      });
    }
  } else {
    loading.value = false;
    error.value = '预览URL不存在';
  }
}, { immediate: true });

// 组件挂载后，如果URL已存在，确保iframe开始加载
onMounted(() => {
  if (props.previewUrl && props.autoLoad) {
    // 等待DOM更新后，确保iframe已渲染
    nextTick(() => {
      if (previewIframe.value && previewIframe.value.src !== props.previewUrl) {
        previewIframe.value.src = props.previewUrl;
      }
    });
  }
});

// 组件卸载时清理超时
onUnmounted(() => {
  if (loadTimeout) {
    clearTimeout(loadTimeout);
    loadTimeout = null;
  }
});

function refreshPreview() {
  if (!props.previewUrl) {
    error.value = '预览URL不存在';
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  
  // 重新加载iframe
  nextTick(() => {
    if (previewIframe.value) {
      // 先清空src，再设置新的，确保触发重新加载
      previewIframe.value.src = '';
      setTimeout(() => {
        if (previewIframe.value) {
          previewIframe.value.src = props.previewUrl;
        }
      }, 100);
    }
  });
}

function handleIframeLoad() {
  // 清除超时
  if (loadTimeout) {
    clearTimeout(loadTimeout);
    loadTimeout = null;
  }
  
  loading.value = false;
  error.value = null;
}

function handleIframeError() {
  // 清除超时
  if (loadTimeout) {
    clearTimeout(loadTimeout);
    loadTimeout = null;
  }
  
  loading.value = false;
  error.value = '加载预览失败，请检查预览URL是否正确';
  ElMessage.error(error.value);
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
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

.preview-container {
  position: relative;
  height: 600px;
  background-color: var(--el-bg-color);

  &.fullscreen {
    height: calc(100vh - 200px);
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--el-bg-color);
  z-index: 10;
  padding: 40px;
}

.error-container,
.empty-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  z-index: 10;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  
  &.loading {
    opacity: 0.3;
  }
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
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fullscreen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color);
  background-color: var(--el-bg-color-page);
}

.fullscreen-iframe {
  flex: 1;
  width: 100%;
  border: none;
}
</style>
