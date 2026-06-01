<template>
  <view class="top-banner">
    <swiper
      class="banner-swiper"
      :indicator-dots="bannerList.length > 1"
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
import { defineProps, defineEmits, ref } from "vue"
import Taro from "@tarojs/taro"
import type { DiscoverItem } from "../service"

interface Props {
  bannerList: DiscoverItem[]
}

const props = withDefaults(defineProps<Props>(), {
  bannerList: () => []
})

const emit = defineEmits<{
  bannerClick: [item: DiscoverItem]
}>()

const handleBannerClick = (item: DiscoverItem) => {
  emit("bannerClick", item)
  // 跳转到外部链接
  if (item.url) {
    Taro.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(item.url)}`
    })
  }
}
</script>

<style lang="less">
.top-banner {
  width: 100%;
}

.banner-swiper {
  height: 576rpx;
}

.banner-swiper image {
  width: 100%;
  height: 100%;
}
</style>
