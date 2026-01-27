<template>
  <view class="top-banner">
    <swiper
      class="banner-swiper"
      :indicator-dots="dots"
      indicator-active-color="#FFD633"
      :autoplay="true"
      :interval="3000"
      :duration="1000"
    >
      <swiper-item v-for="(item, index) in bannerList" :key="index" @tap="handleBannerClick(item)">
        <image :src="item.thumbnail" mode="aspectFill"></image>
      </swiper-item>
    </swiper>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro from "@tarojs/taro"
import { getTripConfig } from "@/api/tripConfig"
import { trackClick } from "@/utils/analytics"

interface BannerItem {
  id: string
  thumbnail: string
  title: string
  type: string
  url: string
}

const bannerList = ref<BannerItem[]>([])
const dots = ref(false)

// 获取banner数据
const fetchBannerData = async () => {
  try {
    const response = await getTripConfig("tripWechatBaseConfig")
    const data = response?.list[0]?.data
    if (data) {
      // 筛选出type为banner的数据
      const bannerData = data.filter((item: BannerItem) => item.type === "banner")
      dots.value = bannerData.length > 1
      bannerList.value = bannerData
    }
  } catch (error) {
    console.error("获取banner数据失败:", error)
    Taro.showToast({
      title: "获取banner数据失败",
      icon: "none"
    })
  }
}

// 处理banner点击事件
const handleBannerClick = (item: BannerItem) => {
  trackClick("homepage_banner", { banner_id: item.title })
  if (item.url) {
    if (/^http/.test(item.url)) {
      // 如果是外部链接，使用webview打开
      Taro.navigateTo({
        url: `/pages/webview/index?url=${encodeURIComponent(item.url)}`
      })
    } else {
      Taro.navigateTo({
        url: item.url
      })
    }
  }
}

onMounted(() => {
  fetchBannerData()
})
</script>

<style lang="less">
.top-banner {
  width: 100%;
}

.banner-swiper {
  height: 496rpx;
}

.banner-swiper image {
  width: 100%;
  height: 100%;
}
</style>
