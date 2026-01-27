<template>
  <tab-bar-layout
    tab-key="strategies"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '精选攻略' }"
  >
    <!-- 攻略列表 -->
    <view class="strategies-list">
      <vertical-list :items="strategies" @item-click="handleStrategyClick" />
    </view>

    <!-- 加载更多 -->
    <view v-if="loading" class="loading-more">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 暂无更多 -->
    <no-more-data v-if="!loading && strategies.length > 0" />
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import VerticalList from "../components/VerticalList.vue"
import NoMoreData from "@/components/NoMoreData/index.vue"
import { getDiscoverConfig, getStrategiesData, type DiscoverItem } from "../service"

const strategies = ref<DiscoverItem[]>([])
const loading = ref(false)

const handleStrategyClick = (strategy: DiscoverItem) => {
  // 跳转到外部链接
  if (strategy.url) {
    Taro.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(strategy.url)}`
    })
  }
}

const loadStrategies = async () => {
  try {
    loading.value = true
    const response = await getDiscoverConfig()

    if (response.list && response.list.length > 0) {
      const discoverData = response.list[0].data
      strategies.value = getStrategiesData(discoverData)
    }
  } catch (error) {
    console.error("加载攻略数据失败:", error)
    Taro.showToast({
      title: "数据加载失败",
      icon: "none"
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStrategies()
})
</script>

<style lang="less">
.strategies-list {
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
