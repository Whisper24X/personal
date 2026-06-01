<template>
  <view class="status-bar" :style="{ height: `${height}px` }"></view>
</template>

<script>
import { ref, onMounted } from "vue"
import { getStatusBarHeight } from "@/utils/statusBar"

export default {
  name: "StatusBar",
  setup() {
    const height = ref(20) // 默认高度

    onMounted(() => {
      height.value = getStatusBarHeight()
    })

    return {
      height
    }
  }
}
</script>

<style>
.status-bar {
  width: 100%;
}
</style>
