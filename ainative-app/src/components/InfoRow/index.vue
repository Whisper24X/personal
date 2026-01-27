<template>
  <view class="info-row">
    <view class="label">{{ label }}</view>
    <view class="value">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
interface Props {
  label: string
}

defineProps<Props>()
</script>

<style lang="less">
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: PingFang SC;
  font-size: 28px;
  font-weight: 600;
  line-height: 28px;
  color: #393548;
  margin-bottom: 40rpx;
  &:last-child {
    margin-bottom: 0;
  }
  .label {
    font-family: PingFang SC;
    font-size: 28px;
    font-weight: normal;
    line-height: 28px;
    color: #848096;
  }
}
</style>
