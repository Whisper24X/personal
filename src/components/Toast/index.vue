<template>
  <view v-if="visible" class="toast-container">
    <view class="toast-content" :class="[`toast-${type}`]">
      <image v-if="icon" class="toast-icon" :src="icon" />
      <text class="toast-text">{{ message }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue"

interface Props {
  visible: boolean
  message: string
  type?: "success" | "error" | "warning" | "info"
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: "info",
  duration: 3000
})

const emit = defineEmits<{
  close: []
}>()

const icon = computed(() => {
  const iconMap = {
    success: "https://fp.yangcong345.com/middle/1.0.0/yanxueImg/success-icon__w.png",
    error: "https://fp.yangcong345.com/middle/1.0.0/yanxueImg/error-icon__w.png",
    warning: "https://fp.yangcong345.com/middle/1.0.0/yanxueImg/warning-icon__w.png",
    info: ""
  }
  return iconMap[props.type]
})

let timer: number | null = null

watch(
  () => props.visible,
  newVisible => {
    if (newVisible) {
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        emit("close")
      }, props.duration)
    } else {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
  }
)
</script>

<style lang="less">
.toast-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10001;
  pointer-events: none;
}

.toast-content {
  display: flex;
  align-items: center;
  padding: 24rpx 32rpx;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 16rpx;
  min-width: 200rpx;
  max-width: 500rpx;

  &.toast-success {
    background: rgba(52, 199, 89, 0.9);
  }

  &.toast-error {
    background: rgba(255, 59, 48, 0.9);
  }

  &.toast-warning {
    background: rgba(255, 149, 0, 0.9);
  }

  .toast-icon {
    width: 32rpx;
    height: 32rpx;
    margin-right: 16rpx;
    flex-shrink: 0;
  }

  .toast-text {
    font-size: 28rpx;
    color: #ffffff;
    text-align: center;
    line-height: 1.4;
  }
}
</style>
