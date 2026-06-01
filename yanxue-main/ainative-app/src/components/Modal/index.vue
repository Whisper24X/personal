<template>
  <view class="modal-overlay" v-if="visible" @tap="handleMaskClick">
    <view class="modal-container" @tap.stop>
      <view v-if="title" class="modal-header">
        <text class="modal-title">{{ title }}</text>
        <view v-if="showClose" class="close-btn" @tap="close">
          <image
            class="close-icon"
            src="https://fp.yangcong345.com/middle/1.0.0/yanxueImg/close__w.png"
          />
        </view>
      </view>

      <view class="modal-content">
        <slot>
          <text v-if="content" class="modal-text">{{ content }}</text>
        </slot>
      </view>

      <view v-if="showFooter" class="modal-footer">
        <button v-if="cancelText" class="modal-btn cancel-btn" @tap="handleCancel">
          {{ cancelText }}
        </button>
        <button v-if="confirmText" class="modal-btn confirm-btn" @tap="handleConfirm">
          {{ confirmText }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue"

interface Props {
  visible: boolean
  title?: string
  content?: string
  cancelText?: string
  confirmText?: string
  showClose?: boolean
  maskClosable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showClose: true,
  maskClosable: true,
  cancelText: "取消",
  confirmText: "确定"
})

const emit = defineEmits<{
  close: []
  cancel: []
  confirm: []
}>()

const showFooter = computed(() => {
  return props.cancelText || props.confirmText
})

const handleMaskClick = () => {
  if (props.maskClosable) {
    close()
  }
}

const close = () => {
  emit("close")
}

const handleCancel = () => {
  emit("cancel")
  close()
}

const handleConfirm = () => {
  emit("confirm")
}
</script>

<style lang="less">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60rpx;
}

.modal-container {
  background: #ffffff;
  border-radius: 24rpx;
  min-width: 560rpx;
  max-width: 90%;
  max-height: 80%;
  overflow: hidden;
}

.modal-header {
  position: relative;
  padding: 40rpx 32rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;

  .modal-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333333;
    text-align: center;
    display: block;
  }

  .close-btn {
    position: absolute;
    top: 32rpx;
    right: 32rpx;
    width: 48rpx;
    height: 48rpx;
    display: flex;
    align-items: center;
    justify-content: center;

    .close-icon {
      width: 24rpx;
      height: 24rpx;
    }
  }
}

.modal-content {
  padding: 32rpx;
  max-height: 60vh;
  overflow-y: auto;

  .modal-text {
    font-size: 28rpx;
    color: #666666;
    line-height: 1.6;
    text-align: center;
  }
}

.modal-footer {
  display: flex;
  border-top: 1rpx solid #f0f0f0;

  .modal-btn {
    flex: 1;
    height: 88rpx;
    border: none;
    font-size: 32rpx;

    &.cancel-btn {
      background: #f8f8f8;
      color: #666666;
      border-right: 1rpx solid #f0f0f0;
    }

    &.confirm-btn {
      background: #007aff;
      color: #ffffff;
    }
  }
}
</style>
