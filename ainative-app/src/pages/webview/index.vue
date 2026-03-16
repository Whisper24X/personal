<template>
  <view class="webview-container">
    <!-- H5 模式下 web-view 会渲染为 iframe，受目标站点 CSP frame-ancestors 限制 -->
    <web-view v-if="!isH5" :src="url"></web-view>
    <view v-else class="h5-fallback">
      <text class="h5-fallback-text">正在打开外部链接…</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro from "@tarojs/taro"

const url = ref("")
const isH5 = process.env.TARO_ENV === "h5"

onMounted(() => {
  const params = Taro?.getCurrentInstance()?.router?.params || {}
  if (params.url) {
    const decodedUrl = decodeURIComponent(params.url)
    url.value = decodedUrl

    if (isH5 && typeof window !== "undefined") {
      window.open(decodedUrl, "_blank")
      Taro.navigateBack()
    }
  }
})
</script>

<style lang="less">
.webview-container {
  width: 100%;
  height: 100vh;
}

.h5-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;

  .h5-fallback-text {
    font-size: 28rpx;
    color: #848096;
  }
}
</style>
