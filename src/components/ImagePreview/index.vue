<template>
  <view class="image-preview" v-if="visible" @tap="handleMaskClick">
    <swiper class="image-swiper" :current="currentIndex" @change="onSwiperChange" @tap.stop>
      <swiper-item v-for="(image, index) in images" :key="index">
        <view class="image-container">
          <image class="preview-image" :src="image" mode="aspectFit" @tap.stop />
        </view>
      </swiper-item>
    </swiper>

    <view class="image-indicator" @tap.stop>
      <text>{{ currentIndex + 1 }} / {{ images.length }}</text>
    </view>

    <view class="close-btn" @tap="close">
      <image
        class="close-icon"
        src="https://fp.yangcong345.com/middle/1.0.0/yanxueImg/close-white__w.png"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"

interface Props {
  visible: boolean
  images: string[]
  current?: number
}

const props = withDefaults(defineProps<Props>(), {
  current: 0
})

const emit = defineEmits<{
  close: []
}>()

const currentIndex = ref(props.current)

watch(
  () => props.current,
  newValue => {
    currentIndex.value = newValue
  }
)

const onSwiperChange = (e: any) => {
  currentIndex.value = e.detail.current
}

const handleMaskClick = () => {
  close()
}

const close = () => {
  emit("close")
}
</script>

<style lang="less">
.image-preview {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-swiper {
  width: 100%;
  height: 100%;
}

.image-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
}

.image-indicator {
  position: absolute;
  bottom: 100rpx;
  left: 50%;
  transform: translateX(-50%);
  padding: 16rpx 24rpx;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 24rpx;

  text {
    color: #ffffff;
    font-size: 28rpx;
  }
}

.close-btn {
  position: absolute;
  top: 60rpx;
  right: 60rpx;
  width: 64rpx;
  height: 64rpx;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  .close-icon {
    width: 32rpx;
    height: 32rpx;
  }
}
</style>
