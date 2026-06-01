<template>
  <view class="agreement-checkbox">
    <view class="checkbox-wrapper" @tap="handleCheckboxClick">
      <image
        class="checkbox-icon"
        :src="
          checked
            ? 'https://fp.yangcong345.com/middle/1.0.0/yanxueImg/check32__w.png'
            : 'https://fp.yangcong345.com/middle/1.0.0/yanxueImg/uncheck32__w.png'
        "
        mode="aspectFit"
      />
    </view>
    <view class="agreement-text">
      <text @tap="handleCheckboxClick">{{ prefix }}</text>
      <block v-for="(agreement, index) in agreements" :key="index">
        <text class="agreement-link" @tap.stop="handleAgreementClick(agreement)">{{
          agreement.name
        }}</text>
        <text v-if="index < agreements.length - 1">{{ separator }}</text>
      </block>
      <text @tap="handleCheckboxClick">{{ suffix }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import Taro from "@tarojs/taro"

interface Agreement {
  name: string // 协议名称
  url?: string // 协议链接(外部链接)
  path?: string // 协议路径(小程序内部页面)
}

interface Props {
  checked?: boolean // 是否已勾选
  disabled?: boolean // 是否禁用
  prefix?: string // 前置文本
  suffix?: string // 后置文本
  separator?: string // 协议之间的分隔符
  agreements: Agreement[] // 协议列表
}

interface Emits {
  (e: "change", value: boolean): void
  (e: "update:checked", value: boolean): void
  (e: "agreementClick", agreement: Agreement): void
}

const props = withDefaults(defineProps<Props>(), {
  checked: false,
  disabled: false,
  prefix: "我已阅读并同意",
  suffix: "",
  separator: "、"
})

const emit = defineEmits<Emits>()

// 处理复选框点击
const handleCheckboxClick = () => {
  if (props.disabled) return

  const newValue = !props.checked
  emit("update:checked", newValue)
  emit("change", newValue)
}

// 处理协议点击
const handleAgreementClick = (agreement: Agreement) => {
  emit("agreementClick", agreement)

  // 如果有URL
  if (agreement.url) {
    // 判断是否为小程序内部路径（以 / 开头）
    if (agreement.url.startsWith("/")) {
      Taro.navigateTo({
        url: agreement.url
      })
    } else {
      // 外部链接，跳转到webview页面
      Taro.navigateTo({
        url: `/pages/webview/index?url=${encodeURIComponent(agreement.url)}&title=${encodeURIComponent(agreement.name)}`
      })
    }
  }
  // 如果有内部路径，直接跳转
  else if (agreement.path) {
    Taro.navigateTo({
      url: agreement.path
    })
  }
}
</script>

<style lang="less">
.agreement-checkbox {
  display: flex;
  align-items: center;
  gap: 8rpx;

  .checkbox-wrapper {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    .checkbox-icon {
      width: 24rpx;
      height: 24rpx;
    }
  }

  .agreement-text {
    flex: 1;
    font-size: 22px;
    font-weight: normal;
    line-height: 22px;
    letter-spacing: 0.28px;
    color: #393548;

    .agreement-link {
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 6rpx;
    }
  }
}
</style>
