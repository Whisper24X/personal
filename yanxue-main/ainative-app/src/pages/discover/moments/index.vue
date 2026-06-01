<template>
  <tab-bar-layout
    tab-key="moments"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '精彩瞬间' }"
  >
    <!-- 瞬间列表 -->
    <view class="moments-list">
      <horizontal-list :items="moments" :show-play-button="true" @item-click="handleMomentClick" />
    </view>

    <!-- 加载更多 -->
    <view v-if="loading" class="loading-more">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 暂无更多 -->
    <no-more-data v-if="!loading && moments.length > 0" />
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import HorizontalList from "../components/HorizontalList.vue"
import NoMoreData from "@/components/NoMoreData/index.vue"
import { getDiscoverConfig, getMomentsData, type DiscoverItem } from "../service"

const moments = ref<DiscoverItem[]>([])
const loading = ref(false)

const handleMomentClick = (moment: DiscoverItem) => {
  // 跳转到外部链接
  if (moment.url) {
    Taro.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(moment.url)}`
    })
  }
}

const loadMoments = async () => {
  try {
    loading.value = true
    const response = await getDiscoverConfig()

    if (response.list && response.list.length > 0) {
      const discoverData = response.list[0].data
      moments.value = getMomentsData(discoverData)
    }
  } catch (error) {
    console.error("加载瞬间数据失败:", error)
    Taro.showToast({
      title: "数据加载失败",
      icon: "none"
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadMoments()
})
</script>

<style lang="less">
.moments-container {
  min-height: 100vh;
  background: #f9f9f9;
}

.moments-list {
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
