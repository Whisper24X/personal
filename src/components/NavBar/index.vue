<template>
  <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="nav-content">
      <view v-if="showBack" class="nav-left" @tap="handleBack">
        <image
          class="back-icon"
          src="https://fp.yangcong345.com/middle/1.0.0/yanxueImg/arrow-left__w.png"
        />
      </view>

      <view class="nav-center">
        <slot name="center">
          <text class="nav-title">{{ title }}</text>
        </slot>
      </view>

      <view class="nav-right">
        <slot name="right"></slot>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro from "@tarojs/taro"

interface Props {
  title?: string
  showBack?: boolean
  background?: string
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  showBack: true,
  background: "#ffffff",
  color: "#333333"
})

const emit = defineEmits<{
  back: []
}>()

const statusBarHeight = ref(20)

onMounted(() => {
  try {
    const systemInfo = Taro.getSystemInfoSync()
    statusBarHeight.value = systemInfo.statusBarHeight || 20
  } catch (e) {
    console.error("获取状态栏高度失败", e)
  }
})

const handleBack = () => {
  emit("back")
  Taro.navigateBack()
}
</script>

<style lang="less">
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: var(--nav-bg, #ffffff);
  border-bottom: 1rpx solid #f0f0f0;
}

.nav-content {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 32rpx;
  position: relative;
}

.nav-left,
.nav-right {
  width: 80rpx;
  display: flex;
  align-items: center;
  z-index: 2;
}

.nav-left {
  justify-content: flex-start;

  .back-icon {
    width: 48rpx;
    height: 48rpx;
  }
}

.nav-right {
  justify-content: flex-end;
}

.nav-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;

  .nav-title {
    font-size: 32rpx;
    font-weight: 600;
    color: var(--nav-color, #333333);
  }
}
</style>
