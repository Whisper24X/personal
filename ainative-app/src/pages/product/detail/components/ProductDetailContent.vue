<template>
  <view class="detail-module">
    <view class="section-title">商品详情</view>
    <!-- 详情图片 -->
    <view v-if="detailImages.length" class="detail-images">
      <view class="images-container">
        <AspectRatioImage
          v-for="(img, index) in detailImages"
          :key="index"
          :src="img"
          :container-width="containerWidth"
          image-class="detail-image"
          @load="onImageLoad($event, index)"
          @error="onImageError($event, index)"
        />
      </view>
    </view>
  </view>
</template>

<script>
import { defineComponent, computed } from "vue"
import AspectRatioImage from "@/components/AspectRatioImage/index.vue"
import { getDeviceWidth } from "@/utils/style"
export default defineComponent({
  name: "ProductDetailContent",
  components: {
    AspectRatioImage
  },
  props: {
    goodInfo: {
      type: Object,
      default: () => null
    }
  },
  setup(props) {
    // 图片加载完成事件
    const onImageLoad = (event, index) => {
      console.log(`图片 ${index} 加载完成:`, event)
    }

    // 图片加载错误事件
    const onImageError = (event, index) => {
      console.error(`图片 ${index} 加载失败:`, event)
    }

    // 详情图片
    const detailImages = computed(() => {
      return props.goodInfo?.detailImages || []
    })

    const containerWidth = getDeviceWidth()
    return {
      onImageLoad,
      onImageError,
      containerWidth,
      detailImages
    }
  }
})
</script>

<style lang="less">
.detail-module {
  margin-top: 32rpx;
  background: #fff;

  // 标题样式
  .section-title {
    padding: 32rpx;
    font-family: PingFang SC;
    font-size: 32px;
    font-weight: 600;
    line-height: 32px;
    letter-spacing: 0em;
    color: #393548;
  }
  // 详情图片
  .detail-images {
    margin-bottom: 24rpx;
    .images-container {
      font-size: 0;
      line-height: 0;

      .detail-image {
        width: 100%;
        background: #d8d8d8;
        display: block;
        overflow: hidden;
      }
    }
  }
}
</style>
