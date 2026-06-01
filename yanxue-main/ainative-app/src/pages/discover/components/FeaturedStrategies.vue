<template>
  <vertical-list :items="strategies" @item-click="handleStrategyClick" />
</template>

<script setup lang="ts">
import Taro from "@tarojs/taro"
import VerticalList from "./VerticalList.vue"
import type { DiscoverItem } from "../service"

interface Props {
  strategies: DiscoverItem[]
  isShowVideo?: string
}

const props = withDefaults(defineProps<Props>(), {
  strategies: () => [],
  isShowVideo: "false"
})

const emit = defineEmits<{
  strategyClick: [item: DiscoverItem]
}>()

const handleStrategyClick = (strategy: DiscoverItem) => {
  emit("strategyClick", strategy)
  // 跳转到外部链接
  if (strategy.url && props.isShowVideo === "true") {
    Taro.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(strategy.url)}`
    })
  }
}
</script>
