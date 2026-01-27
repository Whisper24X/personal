<template>
  <horizontal-list
    :items="items"
    :show-play-button="showPlayButton"
    @item-click="handleItemClick"
  />
</template>

<script setup lang="ts">
import Taro from "@tarojs/taro"
import HorizontalList from "./HorizontalList.vue"
import type { DiscoverItem } from "../service"

interface Props {
  items: DiscoverItem[]
  showPlayButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showPlayButton: false
})

const emit = defineEmits<{
  itemClick: [item: DiscoverItem]
}>()

const handleItemClick = (item: DiscoverItem) => {
  emit("itemClick", item)
  // 跳转到外部链接
  if (item.url) {
    Taro.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(item.url)}`
    })
  }
}
</script>
