<template>
  <view v-if="displayQrCode" class="qr-code-section">
    <view class="qr-code-tip">
      <image
        class="hand-icon"
        src="https://fp.yangcong345.com/middle/1.0.0/icon-hand-13905b6698004e034082ac738c83419f__w.png"
      />
      <text>
        长按二维码加入群聊，即可获取<text class="highlight">详细研学安排与资料</text>哦~
      </text>
    </view>
    <view class="qr-code-container">
      <image class="qr-code" :src="displayQrCode" mode="aspectFit" :show-menu-by-longpress="true" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useConfigStore } from "@/store/configStore"

interface Props {
  qrCode?: string
}

const props = defineProps<Props>()

// 使用全局配置
const configStore = useConfigStore()
const defaultServiceQrCodeUrl = computed(() => configStore.defaultServiceQrCodeUrl)

// 显示的二维码：优先使用传入的二维码，如果没有则使用默认客服二维码
const displayQrCode = computed(() => {
  return props.qrCode || defaultServiceQrCodeUrl.value
})
</script>

<style lang="less">
.qr-code-section {
  padding: 32rpx;
  background: #fff;
  border-radius: 24rpx;
  margin-top: 32rpx;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
  gap: 28rpx;

  .qr-code-tip {
    display: flex;
    align-items: flex-start;
    gap: 8rpx;
    padding: 24rpx 24rpx 36rpx 24rpx;
    width: 550rpx;
    font-family: PingFang SC;
    font-size: 28px;
    font-weight: normal;
    line-height: 42px;
    letter-spacing: 0em;
    color: #3d3d3d;
    background-image: url("https://fp.yangcong345.com/middle/1.0.0/tips-bg-04c4be1a898453ee5ea85f3a214da62a__w.png");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    position: relative;

    .hand-icon {
      width: 39rpx;
      height: 39rpx;
      flex-shrink: 0;
    }

    .highlight {
      color: #518aff;
    }
  }

  .qr-code-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 320px;
    height: 320px;
    background-image: url("https://fp.yangcong345.com/middle/1.0.0/qrcode-bg-ee57906af67a4f3ce70ca9f735f27d34__w.png");
    background-size: 100% 100%;
    background-repeat: no-repeat;

    .qr-code {
      width: 300rpx;
      height: 300rpx;
    }
  }
}
</style>
