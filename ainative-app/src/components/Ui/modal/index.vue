<template>
  <view v-if="visible" class="oi-modal__popup" :style="{ zIndex }">
    <view v-if="maskShow" class="oi-modal__mask" @tap="handleMaskClick"></view>
    <view class="oi-modal__main">
      <view v-if="title" class="oi-modal__header">{{ title }}</view>
      <text v-if="closeIcon" class="oi-modal__close" @tap="close('closeIcon')"></text>
      <view
        v-if="content"
        class="oi-modal__content"
        :class="{ 'oi-modal__content--no-title': !title }"
      >
        {{ content }}
      </view>
      <slot></slot>
      <view v-if="showFooter" class="oi-modal-footer">
        <view
          v-if="leftButton || rightButton"
          class="oi-modal__bottom-btn"
          :class="{ 'oi-modal__bottom-btn--vertical': buttonGroupVertical }"
        >
          <OnionButton
            v-if="leftButton"
            class="oi-modal_bottom-leftBtn"
            type="hollow"
            transparent
            round
            theme="white"
            size="medium"
            border-color="black"
            @click="handleLeftButtonClick"
          >
            {{ leftButtonText }}
          </OnionButton>
          <view v-if="leftButton && rightButton" class="oi-modal__bottom-interval"></view>
          <OnionButton
            v-if="rightButton"
            class="oi-modal_bottom-rightBtn"
            type="hollow"
            size="medium"
            round
            theme="yellow"
            border-color="yellow"
            shadow
            @click="handleRightButtonClick"
          >
            {{ rightButtonText }}
          </OnionButton>
        </view>
        <view v-if="subButton" class="oi-modal__other-btn" @tap="handleSubButtonClick">
          {{ subButtonText }}
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import OnionButton from "../button/index.vue"

interface Props {
  visible: boolean
  maskClickClose?: boolean
  maskShow?: boolean
  zIndex?: number
  title?: string
  content?: string
  leftButtonText?: string
  leftButton?: boolean
  rightButtonText?: string
  rightButton?: boolean
  subButton?: boolean
  subButtonText?: string
  buttonGroupVertical?: boolean
  closeIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  maskClickClose: true,
  maskShow: true,
  zIndex: 999,
  title: "",
  content: "",
  leftButtonText: "取消",
  leftButton: true,
  rightButtonText: "确定",
  rightButton: true,
  subButton: false,
  subButtonText: "",
  buttonGroupVertical: false,
  closeIcon: false
})

const emit = defineEmits<{
  (e: "update:visible", visible: boolean): void
  (e: "close", type: string): void
  (e: "leftButtonClick"): void
  (e: "rightButtonClick"): void
  (e: "subButtonClick"): void
}>()

const showFooter = computed(() => {
  return props.leftButton || props.rightButton || props.subButton
})

const close = (type: string = "") => {
  emit("update:visible", false)
  emit("close", type)
}

const handleMaskClick = () => {
  if (props.maskClickClose) {
    close("mask")
  }
}

const handleLeftButtonClick = () => {
  emit("leftButtonClick")
  close("leftButton")
}

const handleRightButtonClick = () => {
  emit("rightButtonClick")
  close("rightButton")
}

const handleSubButtonClick = () => {
  emit("subButtonClick")
  close("subButton")
}
</script>

<style lang="less">
.oi-modal__popup {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  .oi-modal__mask {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
  }

  .oi-modal__main {
    position: relative;
    overflow: hidden;
    width: 654rpx;
    min-height: 330rpx;
    max-height: 1064rpx;
    background-image: url(https://fp.yangcong345.com/middle/1.0.0/modal_main_bg.png);
    background-color: #ffffff;
    background-size: 140rpx auto;
    background-repeat: no-repeat;
    background-position: left -8rpx bottom;
    border-radius: 16rpx;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    animation: modalFadeIn 0.3s ease;
  }

  .oi-modal__header {
    position: relative;
    background: #826eff;
    font-size: 32rpx;
    font-weight: bold;
    line-height: 80rpx;
    height: 80rpx;
    color: #ffffff;
    padding-left: 32rpx;
    background: #826eff url(https://fp.yangcong345.com/middle/1.0.0/modal_title_bg.png) 0 / auto
      100% no-repeat;
    background-size: auto 100%;
    background-repeat: no-repeat;
    background-position: left center;
  }

  .oi-modal__close {
    position: absolute;
    top: 16rpx;
    right: 12rpx;
    width: 48rpx;
    height: 48rpx;
    background-size: 100% 100%;
    font-size: 40rpx;
    color: #999999;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .oi-modal__header + .oi-modal__close {
    background-image: url(https://fp.yangcong345.com/middle/1.0.0/modal_close.png);
  }

  .oi-modal__content {
    padding: 40rpx 56rpx 56rpx;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-size: 28rpx;
    color: #393548;
    line-height: 42rpx;
    flex: 1;
    text-align: center;

    word-wrap: break-word;
    white-space: pre-line;
    word-break: break-all;

    // rich-text 组件样式
    :deep(rich-text) {
      font-size: 22px;
      line-height: 36px;
    }

    &.oi-modal__content--no-title {
      padding: 80rpx 48rpx;
      font-size: 34rpx;
      line-height: 52rpx;
      text-align: center;
    }
  }

  .oi-modal-footer {
    height: 72px;
    padding-bottom: 48rpx;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    .oi-modal__bottom-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 10rpx;

      &.oi-modal__bottom-btn--vertical {
        flex-direction: column-reverse;

        .oi-modal__bottom-interval {
          margin-left: 24rpx;
          margin-top: 24rpx;
        }
      }
    }

    .oi-modal_bottom-leftBtn,
    .oi-modal_bottom-rightBtn {
      flex: 1;
      min-width: 220rpx;
      box-sizing: border-box;
    }

    .oi-modal__bottom-interval {
      margin-left: 24rpx;
      width: 0;
    }

    .oi-modal__other-btn {
      padding-top: 40rpx;
      text-align: center;
      font-size: 24rpx;
      color: #666666;
      line-height: 24rpx;
    }
  }
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media screen and (max-height: 1040rpx) and (orientation: landscape) {
  .oi-modal__main {
    max-height: 638rpx;
    max-width: 980rpx;
    min-width: 634rpx;
  }
}
</style>
