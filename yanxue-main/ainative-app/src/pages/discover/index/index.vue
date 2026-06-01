<template>
  <tab-bar-layout tab-key="discover" :show-tab-bar="true">
    <view class="discover-container">
      <!-- 头部横幅 -->
      <discover-banner :banner-list="bannerData" @banner-click="handleBannerClick" />
      <!-- 精选攻略 -->
      <view class="section-container">
        <view class="section-header">
          <view class="section-title">
            <view class="star-icon">
              <image
                class="img"
                src="https://fp.yangcong345.com/middle/1.0.0/star-e7a9ecc19a5837c8884081e71c0338e4.png"
                alt="精选攻略"
              />
            </view>
            <text class="title-text">精选攻略</text>
          </view>
          <view v-if="isShowVideo === 'true'" class="view-all" @tap="goToAllStrategies">
            <text class="view-all-text">查看全部</text>
          </view>
        </view>
        <featured-strategies
          :strategies="strategiesData"
          :is-show-video="isShowVideo"
          @strategy-click="handleStrategyClick"
        />
      </view>
      <template v-if="isShowVideo === 'true'">
        <!-- 精彩VLOG -->
        <view class="section-container">
          <view class="section-header">
            <view class="section-title">
              <view class="content-icon">
                <image class="img" :src="vlogIcon" alt="精彩VLOG" />
              </view>
              <text class="title-text">精彩VLOG</text>
            </view>
            <view class="view-all" @tap="goToAllVlogs">
              <text class="view-all-text">查看全部</text>
            </view>
          </view>
          <wonderful :items="vlogItems" :show-play-button="true" @item-click="handleVlogClick" />
        </view>

        <!-- 精彩瞬间 -->
        <view class="section-container">
          <view class="section-header">
            <view class="section-title">
              <view class="content-icon">
                <image class="img" :src="momentIcon" alt="精彩瞬间" />
              </view>
              <text class="title-text">精彩瞬间</text>
            </view>
            <view class="view-all" @tap="goToAllMoments">
              <text class="view-all-text">查看全部</text>
            </view>
          </view>
          <wonderful
            :items="momentItems"
            :show-play-button="true"
            @item-click="handleMomentClick"
          />
        </view>
      </template>

      <!-- 底部间距 -->
      <view class="bottom-spacing"></view>
    </view>
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import Taro, { useDidShow } from "@tarojs/taro"
import TabBarLayout from "../../../components/TabBarLayout/index.vue"
import DiscoverBanner from "../components/DiscoverBanner.vue"
import FeaturedStrategies from "../components/FeaturedStrategies.vue"
import Wonderful from "../components/Wonderful.vue"
import {
  getDiscoverConfig,
  getBannerData,
  getStrategiesData,
  getVlogsData,
  getMomentsData,
  type DiscoverItem
} from "../service"
import { useConfigStore } from "@/store/configStore"

// 数据状态
const loading = ref(false)
const bannerData = ref<DiscoverItem[]>([])
const strategiesData = ref<DiscoverItem[]>([])
const vlogItems = ref<DiscoverItem[]>([])
const momentItems = ref<DiscoverItem[]>([])

// 使用全局配置
const configStore = useConfigStore()
const isShowVideo = computed(() => configStore.isShowVideo)

// 图标配置
const vlogIcon = "https://fp.yangcong345.com/middle/1.0.0/vlog-984744fa73d5c44285331534e2608d89.png"
const momentIcon =
  "https://fp.yangcong345.com/middle/1.0.0/moments-b5534951982d6339278ce8ac64d43105.png"

// 加载数据
const loadDiscoverData = async () => {
  try {
    loading.value = true
    const response = await getDiscoverConfig()

    if (response.list && response.list.length > 0) {
      const discoverData = response.list[0].data

      // 按类型分类数据，每个分类只显示2条
      bannerData.value = getBannerData(discoverData)
      strategiesData.value = getStrategiesData(discoverData).slice(0, 2)
      vlogItems.value = getVlogsData(discoverData).slice(0, 2)
      momentItems.value = getMomentsData(discoverData).slice(0, 2)
    }
  } catch (error) {
    console.error("加载发现页面数据失败:", error)
    Taro.showToast({
      title: "数据加载失败",
      icon: "none"
    })
  } finally {
    loading.value = false
  }
}

// 导航函数
const goToAllStrategies = () => {
  Taro.navigateTo({
    url: "/pages/discover/strategies/index"
  })
}

const goToAllVlogs = () => {
  Taro.navigateTo({
    url: "/pages/discover/vlogs/index"
  })
}

const goToAllMoments = () => {
  Taro.navigateTo({
    url: "/pages/discover/moments/index"
  })
}

const handleVlogClick = (item: DiscoverItem) => {
  console.log("VLOG点击:", item)
}

const handleMomentClick = (item: DiscoverItem) => {
  console.log("瞬间点击:", item)
}

const handleBannerClick = (item: DiscoverItem) => {
  console.log("横幅点击:", item)
}

const handleStrategyClick = (item: DiscoverItem) => {
  console.log("策略点击:", item)
}

onMounted(async () => {
  // 确保配置已加载
  if (!configStore.isShowVideo) {
    await configStore.fetchIsShowVideoConfig()
  }
  loadDiscoverData()
})

useDidShow(() => {
  console.log("发现页面显示")
  loadDiscoverData()
})
</script>

<style lang="less">
.discover-container {
  min-height: 100vh;
  background: #f9f9f9;
}

.section-container {
  padding: 32rpx 32rpx 0;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32rpx;

    .section-title {
      display: flex;
      align-items: center;

      .star-icon,
      .content-icon {
        width: 32rpx;
        height: 32rpx;
        margin-right: 12rpx;
        display: flex;
        align-items: center;
        justify-content: center;

        .img {
          width: 100%;
          height: 100%;
        }
      }

      .title-text {
        font-size: 36rpx;
        font-weight: 600;
        color: #393548;
      }
    }

    .view-all {
      .view-all-text {
        font-size: 26rpx;
        color: #848096;
        text-decoration: underline;
        text-underline-offset: 6rpx;
      }
    }
  }
}

.bottom-spacing {
  height: 40rpx;
}
</style>
