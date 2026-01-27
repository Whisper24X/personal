<template>
  <swiper
    v-if="mainImages && mainImages.length > 0"
    class="image-slider"
    :indicator-dots="mainImages.length > 1"
    :current="currentImageIndex"
    @change="handleImageChange"
  >
    <swiper-item v-for="(img, index) in mainImages" :key="index">
      <image :src="img" mode="widthFix" class="slider-image" />
    </swiper-item>
  </swiper>
</template>

<script>
import { defineComponent } from "vue"

export default defineComponent({
  name: "ProductImageSlider",
  props: {
    mainImages: {
      type: Array,
      default: () => []
    },
    currentImageIndex: {
      type: Number,
      default: 0
    }
  },
  emits: ["image-change"],
  setup(props, { emit }) {
    const handleImageChange = e => {
      emit("image-change", e.detail.current)
    }

    return {
      handleImageChange
    }
  }
})
</script>

<style lang="less">
.image-slider {
  width: 100%;
  height: 563rpx;

  .slider-image {
    width: 100%;
  }
}
</style>
