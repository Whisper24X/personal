<template>
  <view class="grid-list">
    <view v-for="item in items" :key="item.id" class="list-item" @tap="handleItemClick(item)">
      <view class="item-thumbnail-container">
        <image class="item-thumbnail" :src="item.thumbnail" mode="aspectFill" />
        <view v-if="showPlayButton" class="play-button">
          <image
            class="play-icon"
            src="https://fp.yangcong345.com/middle/1.0.0/videoPlay-59ed1fac01df3a2d6a540842cb5f5205.png"
            mode="aspectFit"
          />
        </view>
      </view>
      <text class="item-title">{{ item.title }}</text>
    </view>
  </view>
  <!-- 全屏视频播放弹框 -->
  <video-player-modal
    :show="showVideoModal"
    :title="currentVlog?.title || ''"
    :feed-id="currentFeedId"
    :finder-user-name="currentFinderUserName"
    @close="closeVideoModal"
    @error="handleVideoError"
  />
</template>

<script setup lang="ts">
import { ref } from "vue"
import Taro from "@tarojs/taro"
import VideoPlayerModal from "./VideoPlayerModal.vue"

interface ListItem {
  id: string
  title: string
  thumbnail: string
  likes?: number
  url?: string
}

interface Props {
  items: ListItem[]
  showPlayButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showPlayButton: false
})

function parseQueryToJson(str: string) {
  const result: { [key: string]: string } = {}
  if (!str) return result

  // 去掉开头的 ? 或多余空格
  str = str.trim().replace(/^\?/, "")

  // 拆分每个键值对
  str.split("&").forEach(pair => {
    const [key, value] = pair.split("=")
    if (key) {
      result[key] = decodeURIComponent(value || "")
    }
  })

  return result
}

const showVideoModal = ref(false)
const currentVlog = ref<ListItem | null>(null)
const currentFeedId = ref<string>("")
const currentFinderUserName = ref<string>("")

const emit = defineEmits<{
  itemClick: [item: ListItem]
}>()

const handleItemClick = (item: ListItem) => {
  if (!props.showPlayButton) {
    showVideoModal.value = false
    emit("itemClick", item)
  } else {
    showVideoModal.value = true
    currentVlog.value = item
    // 从url中提取feedId和finderUserName
    const urlObj = parseQueryToJson(item.url || "")
    currentFeedId.value = urlObj["feedId"] || ""
    currentFinderUserName.value = urlObj["finderUserName"] || ""
    console.log("currentFeedId", currentFeedId.value)
    console.log("currentFinderUserName", currentFinderUserName.value)
  }
}

const closeVideoModal = () => {
  showVideoModal.value = false
  currentVlog.value = null
  currentFeedId.value = ""
  currentFinderUserName.value = ""
}

const handleVideoError = (error: any) => {
  console.error("视频播放出错:", error.detail?.errMsg || error)
  Taro.showToast({
    title: "视频播放失败",
    icon: "none"
  })
  closeVideoModal()
}
</script>

<style lang="less">
.grid-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
  padding-bottom: 24rpx;

  .list-item {
    border-radius: 24rpx;
    background: #fff;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);

    .item-thumbnail-container {
      position: relative;
    }

    .play-button {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60rpx;
      height: 60rpx;
      display: flex;
      align-items: center;
      justify-content: center;

      .play-icon {
        width: 60rpx;
        height: 60rpx;
      }
    }

    .item-thumbnail {
      width: 100%;
      height: 200rpx;
      font-size: 0;
      line-height: 0;
      border-top-left-radius: 24rpx;
      border-top-right-radius: 24rpx;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      background: #f0f0f0;
    }

    .item-title {
      padding: 24rpx;
      font-size: 26rpx;
      font-weight: 500;
      color: #393548;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      white-space: normal;
    }
  }
}
</style>
