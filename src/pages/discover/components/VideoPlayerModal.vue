<template>
  <view v-if="show" class="video-modal" @tap="handleClose">
    <view class="video-player-container">
      <view v-if="feedId && finderUserName" @tap.stop>
        <channel-video
          :feed-id="feedId"
          :finder-user-name="finderUserName"
          autoplay="true"
          loop="true"
          @binderror="handleVideoError"
        />
      </view>
      <view v-else class="video-error">
        <text class="error-text">无法播放此视频</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Props {
  show: boolean
  title?: string
  feedId?: string
  finderUserName?: string
}

withDefaults(defineProps<Props>(), {
  show: false,
  title: "",
  feedId: "",
  finderUserName: ""
})

const emit = defineEmits<{
  close: []
  error: [error: any]
}>()

const handleClose = () => {
  emit("close")
}

const handleVideoError = (e: any) => {
  console.error("视频播放出错:", e.detail?.errMsg || e)
  emit("error", e)
}
</script>

<style lang="less">
.video-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-player-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.video-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.error-text {
  font-size: 28rpx;
  color: #999;
}
</style>
