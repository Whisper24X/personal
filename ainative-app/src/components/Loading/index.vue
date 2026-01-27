<template>
  <view class="loading-container" :class="{ fullscreen: fullscreen }">
    <view class="loading-content">
      <view class="loading-spinner">
        <view class="spinner-dot" v-for="i in 3" :key="i"></view>
      </view>
      <text v-if="text" class="loading-text">{{ text }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Props {
  text?: string
  fullscreen?: boolean
}

defineProps<Props>()
</script>

<style lang="less">
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;

  &.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9);
    z-index: 9999;
  }
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.loading-spinner {
  display: flex;
  gap: 8rpx;

  .spinner-dot {
    width: 12rpx;
    height: 12rpx;
    background: #007aff;
    border-radius: 50%;
    animation: loading-bounce 1.4s ease-in-out infinite both;

    &:nth-child(1) {
      animation-delay: -0.32s;
    }

    &:nth-child(2) {
      animation-delay: -0.16s;
    }
  }
}

.loading-text {
  font-size: 28rpx;
  color: #666666;
}

@keyframes loading-bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
</style>
