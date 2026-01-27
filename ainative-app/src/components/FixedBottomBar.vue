<template>
  <view class="fixed-bottom-bar" @touchmove.stop.prevent @tap.stop.prevent @touchstart.stop.prevent>
    <view class="fixed-bottom-bar-content">
      <slot></slot>
    </view>
  </view>
</template>

<script setup lang="ts">
// 固定在底部的组件，考虑各种机型的安全距离
</script>

<style lang="less">
.fixed-bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background-color: #ffffff;
  // box-shadow: 0 -4px 10px 0 rgba(0, 0, 0, 0.05);
  padding-bottom: constant(safe-area-inset-bottom); /* iOS 11.0 */
  padding-bottom: env(safe-area-inset-bottom); /* iOS 11.2+ */
  box-shadow: 0px -4px 10px 0px rgba(0, 0, 0, 0.06);
  .fixed-bottom-bar-content {
    width: 100%;
    box-sizing: border-box;
  }
}
</style>
