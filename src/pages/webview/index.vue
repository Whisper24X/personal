<template>
  <view class="webview-container">
    <web-view :src="url"></web-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro from "@tarojs/taro"

const url = ref("")

onMounted(() => {
  const params = Taro?.getCurrentInstance()?.router?.params || {}
  if (params.url) {
    url.value = decodeURIComponent(params.url)
  }
})
</script>

<style lang="less">
.webview-container {
  width: 100%;
  height: 100vh;
}
</style>
