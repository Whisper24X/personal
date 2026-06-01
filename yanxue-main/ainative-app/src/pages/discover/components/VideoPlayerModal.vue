<template>
  <view v-if="show" class="video-modal" @tap="handleClose">
    <view class="video-player-container">
      <template v-if="isH5">
        <view class="video-h5-hint" @tap.stop>
          <text class="hint-text">视频号内容暂不支持在浏览器中播放</text>
          <text class="hint-sub">请在微信小程序中查看</text>
          <view class="hint-close" @tap="handleClose">
            <text class="hint-close-text">关闭</text>
          </view>
        </view>
      </template>
      <template v-else>
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
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
const isH5 = process.env.TARO_ENV === "h5"

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

.video-h5-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;

  .hint-text {
    font-size: 32rpx;
    color: #fff;
    font-weight: 500;
  }

  .hint-sub {
    font-size: 26rpx;
    color: #999;
  }

  .hint-close {
    margin-top: 48rpx;
    padding: 16rpx 64rpx;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 40rpx;

    .hint-close-text {
      font-size: 28rpx;
      color: #fff;
    }
  }
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
