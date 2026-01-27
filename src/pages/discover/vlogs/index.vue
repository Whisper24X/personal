<template>
  <tab-bar-layout
    tab-key="vlogs"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: isShowVideo === 'true' ? '精彩VLOG' : '精彩时刻' }"
  >
    <!-- VLOG列表 -->
    <view v-if="isShowVideo === 'true'" class="vlogs-list">
      <horizontal-list :items="vlogs" :show-play-button="true" @item-click="handleVlogClick" />
    </view>

    <!-- 加载更多 -->
    <view v-if="loading" class="loading-more">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 暂无更多 -->
    <no-more-data v-if="!loading && vlogs.length > 0 && isShowVideo === 'true'" />
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import Taro from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import HorizontalList from "../components/HorizontalList.vue"
import NoMoreData from "@/components/NoMoreData/index.vue"
import { getDiscoverConfig, getVlogsData, type DiscoverItem } from "../service"
import { useConfigStore } from "@/store/configStore"

const vlogs = ref<DiscoverItem[]>([])
const loading = ref(false)

// 使用全局配置
const configStore = useConfigStore()
const isShowVideo = computed(() => configStore.isShowVideo)

const handleVlogClick = (vlog: DiscoverItem) => {
  // 跳转到外部链接
  if (vlog.url) {
    Taro.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(vlog.url)}`
    })
  }
}

const loadVlogs = async () => {
  try {
    loading.value = true
    const response = await getDiscoverConfig()

    if (response.list && response.list.length > 0) {
      const discoverData = response.list[0].data
      vlogs.value = getVlogsData(discoverData)
    }
  } catch (error) {
    console.error("加载VLOG数据失败:", error)
    Taro.showToast({
      title: "数据加载失败",
      icon: "none"
    })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // 确保配置已加载
  if (!configStore.isShowVideo) {
    await configStore.fetchIsShowVideoConfig()
  }
  loadVlogs()
})
</script>

<style lang="less">
.vlogs-list {
  padding: 32rpx 32rpx 0;
}

.loading-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx 0;

  .loading-spinner {
    width: 40rpx;
    height: 40rpx;
    border: 4rpx solid #f3f3f3;
    border-top: 4rpx solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    margin-top: 16rpx;
    font-size: 24rpx;
    color: #666666;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
