<template>
  <view class="info-card">
    <view v-if="title" class="info-card__title">{{ title }}</view>
    <view class="info-card__body">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
interface Props {
  title?: string
}

withDefaults(defineProps<Props>(), {
  title: ""
})
</script>

<style lang="less">
.info-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
}

.info-card__title {
  font-family: PingFang SC;
  font-size: 32px;
  font-weight: 600;
  line-height: 32px;
  color: #393548;
  margin-bottom: 44rpx;
}
</style>
