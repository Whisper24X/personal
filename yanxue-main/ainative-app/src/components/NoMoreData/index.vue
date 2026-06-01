<template>
  <view class="no-more-container">
    <view class="no-more-content">
      <view class="line left-line"></view>
      <text class="no-more-text">暂无更多</text>
      <view class="line right-line"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
// 无需额外的逻辑，纯展示组件
</script>

<style lang="less">
.no-more-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40rpx 0;
}

.no-more-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 380rpx;
}

.line {
  height: 2rpx;
  background: #b8b4c7;
  flex: 1;
  max-width: 120rpx;
}

.left-line {
  margin-right: 24rpx;
}

.right-line {
  margin-left: 24rpx;
}

.no-more-text {
  font-size: 26rpx;
  color: #848096;
  font-weight: 400;
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
