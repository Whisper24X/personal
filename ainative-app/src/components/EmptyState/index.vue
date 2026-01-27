<template>
  <view class="empty-state">
    <image class="empty-icon" :src="icon" mode="aspectFit" />
    <text class="empty-title">{{ title }}</text>
    <text v-if="description" class="empty-description">{{ description }}</text>
    <oi-button
      v-if="buttonText"
      class="empty-button"
      type="default"
      theme="yellow"
      size="small"
      round
      @tap="$emit('buttonClick')"
    >
      {{ buttonText }}
    </oi-button>
  </view>
</template>

<script setup lang="ts">
import OiButton from "../Ui/button/index.vue"
interface Props {
  icon?: string
  title?: string
  description?: string
  buttonText?: string
}

const props = withDefaults(defineProps<Props>(), {
  icon: "https://fp.yangcong345.com/middle/1.0.0/yanxueImg/empty230*160__w.png",
  title: "暂无数据"
})

defineEmits<{
  buttonClick: []
}>()
</script>

<style lang="less">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 60rpx;

  .empty-icon {
    width: 320rpx;
    height: 240rpx;
    margin-bottom: 40rpx;
  }

  .empty-title {
    font-size: 32rpx;
    color: #999999;
    margin-bottom: 16rpx;
    text-align: center;
  }

  .empty-description {
    font-size: 28rpx;
    color: #cccccc;
    text-align: center;
    line-height: 1.5;
    margin-bottom: 40rpx;
  }
  .empty-button {
    width: 200rpx;
  }
}
</style>
