<template>
  <!-- 成功气泡样式 -->
  <view v-if="type === 'success-bubble'" class="claim-success-banner">
    <view class="banner-main" @click="handleClick">
      <view class="success-text-wrapper">
        <view class="success-title-wrapper">
          <image
            class="success-icon"
            src="https://fp.yangcong345.com/middle/1.0.0/duigou-icon-35ddbc2d069d82f6256ce9ff60ef81f3__w.png"
            mode="aspectFit"
          />
          <view class="success-title">{{ text }}</view></view
        >
        <view v-if="subText" class="success-desc">{{ subText }}</view>
      </view>
    </view>
    <view class="banner-arrow"></view>
  </view>

  <!-- 原有的促销横幅样式 -->
  <view
    v-else
    class="promo-banner"
    :class="[`promo-banner--${type}`, { 'promo-banner--clickable': clickable }]"
    :style="customStyle"
    @click="handleClick"
  >
    <!-- 左侧图标 -->
    <view v-if="showIcon" class="promo-icon">
      <image v-if="iconUrl" class="promo-icon-image" :src="iconUrl" mode="aspectFill" />
      <text v-else-if="iconText" class="promo-icon-text">{{ iconText }}</text>
    </view>

    <!-- 主要内容 -->
    <view class="promo-content">
      <text class="promo-text" :style="textStyle">{{ text }}</text>
      <text v-if="subText" class="promo-sub-text" :style="subTextStyle">{{ subText }}</text>
    </view>

    <!-- 右侧箭头或按钮 -->
    <view v-if="showArrow" class="promo-arrow">
      <text class="arrow-icon">›</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue"

interface Props {
  // 基础内容
  text?: string
  subText?: string

  // 图标相关
  showIcon?: boolean
  iconUrl?: string
  iconText?: string

  // 样式相关
  type?: "default" | "success" | "warning" | "error" | "info" | "success-bubble"
  backgroundColor?: string
  textColor?: string
  subTextColor?: string
  borderRadius?: string
  padding?: string
  margin?: string

  // 布局相关
  showArrow?: boolean
  clickable?: boolean

  // 自定义样式
  customStyle?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  text: "满500打九折,最多减300",
  subText: "",
  showIcon: true,
  iconUrl: "https://fp.yangcong345.com/middle/yanxue/gift-7aad9a9d262bd827b57f2f36913d4d2f.png",
  iconText: "",
  type: "default",
  backgroundColor: "",
  textColor: "",
  subTextColor: "",
  borderRadius: "",
  padding: "",
  margin: "",
  showArrow: false,
  clickable: false,
  customStyle: () => ({})
})

const emit = defineEmits<{
  click: [event: Event]
}>()

// 计算样式
const customStyle = computed(() => {
  const style: Record<string, any> = { ...props.customStyle }

  if (props.backgroundColor) style.backgroundColor = props.backgroundColor
  if (props.borderRadius) style.borderRadius = props.borderRadius
  if (props.padding) style.padding = props.padding
  if (props.margin) style.margin = props.margin

  return style
})

const textStyle = computed(() => {
  const style: Record<string, any> = {}
  if (props.textColor) style.color = props.textColor
  return style
})

const subTextStyle = computed(() => {
  const style: Record<string, any> = {}
  if (props.subTextColor) style.color = props.subTextColor
  return style
})

const handleClick = (event: Event) => {
  if (props.clickable) {
    emit("click", event)
  }
}
</script>

<style lang="less">
.promo-banner {
  display: flex;
  align-items: center;
  padding: 26rpx;
  margin: 32rpx;
  border-radius: 24rpx;
  justify-content: center;
  position: relative;
  transition: all 0.3s ease;

  // 默认类型样式
  &--default {
    background: #ffeaeb;

    .promo-text {
      color: #fa5a65;
    }
  }

  // 成功类型样式
  &--success {
    background: #e8f5e8;

    .promo-text {
      color: #52c41a;
    }
  }

  // 警告类型样式
  &--warning {
    background: #fff7e6;

    .promo-text {
      color: #fa8c16;
    }
  }

  // 错误类型样式
  &--error {
    background: #ffebe6;

    .promo-text {
      color: #ff4d4f;
    }
  }

  // 信息类型样式
  &--info {
    background: #e6f7ff;

    .promo-text {
      color: #1890ff;
    }
  }

  // 可点击样式
  &--clickable {
    cursor: pointer;

    &:active {
      opacity: 0.8;
      transform: scale(0.98);
    }
  }

  .promo-icon {
    margin-right: 8rpx;
    line-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    .promo-icon-image {
      width: 32rpx;
      height: 32rpx;
    }

    .promo-icon-text {
      font-size: 24rpx;
      font-weight: bold;
    }
  }

  .promo-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .promo-text {
    font-family: PingFang SC;
    font-size: 28rpx;
    line-height: 1.2;
    font-weight: 500;
  }

  .promo-sub-text {
    font-family: PingFang SC;
    font-size: 24rpx;
    line-height: 1.2;
    margin-top: 4rpx;
    opacity: 0.8;
  }

  .promo-arrow {
    margin-left: 8rpx;
    display: flex;
    align-items: center;
    justify-content: center;

    .arrow-icon {
      font-size: 32rpx;
      color: #999;
      font-weight: bold;
    }
  }
}

// 成功气泡样式
.claim-success-banner {
  margin: 32rpx 32rpx 48rpx 32rpx;
  position: relative;

  .banner-main {
    background: #fa5a65;
    border-radius: 24rpx;
    padding: 24rpx 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8rpx 24rpx rgba(255, 107, 122, 0.25);
    position: relative;
  }

  .success-text-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 28rpx;
    .success-title-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8rpx;
      .success-icon {
        width: 40rpx;
        height: 40rpx;
        min-width: 40rpx;
      }
      .success-title {
        font-family: PingFang SC;
        font-size: 32px;
        font-weight: 600;
        line-height: 32px;
        letter-spacing: 0.03em;
        color: #ffffff;
      }
    }

    .success-desc {
      font-family: PingFang SC;
      font-size: 28px;
      font-weight: normal;
      line-height: 28px;
      letter-spacing: 0.03em;
      color: #ffffff;
      opacity: 0.7;
    }
  }
  .banner-arrow {
    position: absolute;
    left: 50%;
    bottom: -16rpx;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 20rpx solid transparent;
    border-right: 20rpx solid transparent;
    border-top: 20rpx solid #ff5568;
  }
}
</style>
