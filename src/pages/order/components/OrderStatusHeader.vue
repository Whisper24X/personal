<template>
  <view class="order-status-header">
    <image class="status-icon" :src="iconUrl" :style="iconStyle" mode="aspectFit" />
    <view class="status-text">{{ title }}</view>
    <view v-if="message" class="status-message">
      <template v-if="keyword && message.includes(keyword)">
        <text>{{ messageParts.before }}</text>
        <text class="highlight">{{ messageParts.keyword }}</text>
        <text>{{ messageParts.after }}</text>
      </template>
      <template v-else>{{ message }}</template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue"

interface Props {
  title: string
  message?: string
  keyword?: string
  iconUrl?: string
  iconWidth?: string
  iconHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  message: "",
  keyword: "",
  iconUrl:
    "https://fp.yangcong345.com/middle/1.0.0/icon-pay-success-89ea68d5a89e3d25320276c12073c5b2__w.png",
  iconWidth: "80rpx",
  iconHeight: "80rpx"
})

const iconStyle = computed(() => {
  return {
    width: props.iconWidth,
    height: props.iconHeight
  }
})

// 分割消息文本,用于高亮关键词
const messageParts = computed(() => {
  if (!props.keyword || !props.message) {
    return { before: "", keyword: "", after: "" }
  }

  const index = props.message.indexOf(props.keyword)
  if (index === -1) {
    return { before: props.message, keyword: "", after: "" }
  }

  return {
    before: props.message.substring(0, index),
    keyword: props.keyword,
    after: props.message.substring(index + props.keyword.length)
  }
})
</script>

<style lang="less">
.order-status-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 50rpx;

  .status-icon {
    margin-bottom: 24rpx;
  }

  .status-text {
    font-family: PingFang SC;
    font-size: 40px;
    font-weight: 600;
    line-height: 40px;
    color: #3d3d3d;
  }

  .status-message {
    margin-top: 24rpx;
    font-family: PingFang SC;
    font-size: 28px;
    font-weight: normal;
    line-height: 28px;
    color: #3d3d3d;

    .highlight {
      color: #fea345;
    }
  }
}
</style>
