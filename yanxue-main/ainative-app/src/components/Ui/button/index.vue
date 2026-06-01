<template>
  <view :class="buttonClasses" @tap="handleClick">
    <view class="oi-button-content">
      <text v-if="icon" :class="iconClasses">{{ icon }}</text>
      <slot></slot>
      <text v-if="showArrow" class="oi-button__right-arrow">></text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue"

interface Props {
  // 类型，普通按钮 or 纯文字链接 or 中空按钮（带边框）
  type?: "default" | "link" | "hollow"
  // 背景色是否透明，透明时可以展示下层的背景图或背景色
  transparent?: boolean
  // 是否显示右侧箭头
  showArrow?: boolean
  // 是否圆角按钮
  round?: boolean
  // 是否粗体
  bold?: "default" | "nomormal"
  borderColor?: string
  // 是否圆形按钮
  circle?: boolean
  // 是否禁用状态
  disabled?: boolean
  // 尺寸，依次为：超大、大、中、小
  size?: "huge" | "large" | "medium" | "small"
  // 图标
  icon?: string
  // 主题，仅对类型为default
  theme?: "yellow" | "blue" | "red" | "white" | "dark"
  // 是否是行级组件；默认是，表示块级组件
  inline?: boolean
  // 基础阴影
  shadow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: "default",
  transparent: false,
  showArrow: false,
  round: false,
  circle: false,
  bold: "default",
  borderColor: "",
  disabled: false,
  size: "medium",
  icon: "",
  theme: "yellow",
  inline: true,
  shadow: false
})

const emit = defineEmits<{
  (e: "click"): void
  (e: "disabledClick"): void
}>()

const buttonClasses = computed(() => {
  let classes = "oi-button"

  classes += ` oi-button__${props.type}`

  if (props.transparent) {
    classes += " oi-button__transparent"
  }

  classes += ` oi-button__${props.size}`

  if (props.type === "hollow") {
    classes += " ignore-px-to-vw"
  }

  if (props.bold === "default") {
    classes += ` oi-button__${props.bold}`
  }

  if (props.round) {
    classes += " oi-button__round"
  }
  if (props.circle) {
    classes += " oi-button__circle"
  }
  classes += ` oi-button__theme__${props.theme}`

  if (props.disabled) {
    classes += " oi-button__disabled"
  }
  if (props.shadow) {
    classes += " oi-button__shadow"
  }
  if (!props.circle && props.showArrow) {
    classes += " oi-button__show-arrow"
  }

  if (props.borderColor) {
    classes += ` oi-button__border-color__${props.borderColor}`
  }

  return classes + (props.inline ? " oi-button-inline" : "")
})

const iconClasses = computed(() => {
  let classes = "oi-button__icon"
  if (props.icon) {
    classes += " oi-button__icon--left"
  }
  return classes
})

const handleClick = (e: any) => {
  console.log("handleClick", e)
  if (props.disabled) {
    e.stopImmediatePropagation()
    emit("disabledClick")
  } else {
    emit("click")
  }
}
</script>

<style lang="less">
.oi-button {
  position: relative;
  display: block;
  border: none;
  outline: none;
  background: transparent;
  padding: 0;
  margin: 0;
  width: 100%;
  text-align: center;
  font-family: AlibabaPuHuiTi_2_105_Heavy;

  &.oi-button-inline {
    display: inline-block;
    width: auto;
  }

  &.oi-button__default {
    background-color: #ffd400;
    color: #393548;
  }

  &.oi-button__link {
    background-color: transparent;
    color: #007aff;
  }

  &.oi-button__hollow {
    background-color: transparent;
    border: 1px solid #007aff;
    color: #007aff;
  }

  &.oi-button__theme__yellow {
    background-color: #ffd400;
    color: #393548;
    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 50px;
      height: 88px;
      opacity: 0.3;
      background: url("@/assets/ycBtn-bg.png") no-repeat center center;
      background-size: 100% 100%;
    }
  }

  &.oi-button__theme__blue {
    background-color: #007aff;
    color: #ffffff;
  }

  &.oi-button__theme__red {
    background-color: #ff3b30;
    color: #ffffff;
  }

  &.oi-button__theme__white {
    background-color: #ffffff;
    color: #393548;
    border: 1px solid #e5e5e5;
  }

  &.oi-button__theme__dark {
    background-color: #333333;
    color: #ffffff;
  }

  &.oi-button__border-color__white {
    border: 1px solid #ffffff;
    color: #ffffff;
  }

  &.oi-button__border-color__red {
    border: 1px solid #ff3b30;
    color: #ff3b30;
  }

  &.oi-button__border-color__blue {
    border: 1px solid #007aff;
    color: #007aff;
  }

  &.oi-button__border-color__black {
    border: 1px solid #b8b4c7;
    color: #393548;
  }

  &.oi-button__border-color__gray {
    border: 1px solid #e5e5e5;
    color: #e5e5e5;
  }

  &.oi-button__border-color__yellow {
    border: 1px solid #ffd400;
  }

  &.oi-button__huge {
    padding: 20rpx 30rpx;
    font-size: 36rpx;
    border-radius: 12rpx;
  }

  &.oi-button__large {
    padding: 18rpx 28rpx;
    font-size: 32rpx;
    border-radius: 10rpx;
  }

  &.oi-button__medium {
    padding: 16rpx 24rpx;
    font-size: 32rpx;
    border-radius: 8rpx;
  }

  &.oi-button__small {
    padding: 12rpx 20rpx;
    font-size: 24rpx;
    border-radius: 6rpx;
  }

  &.oi-button__round {
    border-radius: 50rpx;
  }

  &.oi-button__circle {
    border-radius: 50%;
    width: 80rpx;
    height: 80rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &.oi-button__default {
    font-weight: bold;
  }

  &.oi-button__disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  &.oi-button__shadow {
    box-shadow: inset 0px 2px 2px 0px rgba(255, 255, 255, 0.302);
  }

  &.oi-button__show-arrow {
    position: relative;
    padding-right: 40rpx;
  }

  .oi-button-content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .oi-button__icon {
    margin-right: 10rpx;
  }

  .oi-button__right-arrow {
    margin-left: 10rpx;
  }
}
</style>
