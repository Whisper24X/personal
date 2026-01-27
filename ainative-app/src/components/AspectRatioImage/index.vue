<template>
  <image
    :src="src"
    :style="imageStyle"
    :mode="mode"
    :class="imageClass"
    @load="onImageLoad"
    @error="onImageError"
  />
</template>

<script>
import { defineComponent, ref, computed } from "vue"

export default defineComponent({
  name: "AspectRatioImage",
  props: {
    // 图片地址
    src: {
      type: String,
      required: true
    },
    // 容器宽度
    containerWidth: {
      type: Number
    },
    // 图片模式
    mode: {
      type: String,
      default: "aspectFit"
    },
    // 自定义样式类
    imageClass: {
      type: String,
      default: ""
    },
    // 是否启用宽高比计算
    enableAspectRatio: {
      type: Boolean,
      default: true
    }
  },
  emits: ["load", "error"],
  setup(props, { emit }) {
    // 存储图片的宽高信息
    const imageDimensions = ref(null)
    // 是否加载完成
    const isLoaded = ref(false)
    // 是否加载失败
    const isError = ref(false)

    // 计算图片样式
    const imageStyle = computed(() => {
      if (!props.enableAspectRatio || !imageDimensions.value) {
        return {
          width: "100%",
          height: "auto"
        }
      }
      const { width, height } = imageDimensions.value
      console.log(width, height, 999)

      const aspectRatio = height / width
      const scaledHeight = props.containerWidth * aspectRatio
      console.log(props.containerWidth, scaledHeight, 999)

      return {
        width: `${props.containerWidth}px`,
        height: `${parseInt(scaledHeight)}px`
      }
    })
    // 图片加载完成事件
    const onImageLoad = event => {
      const { width, height } = event.detail
      imageDimensions.value = { width, height }
      isLoaded.value = true
      isError.value = false
      emit("load", { width, height, event })
    }

    // 图片加载错误事件
    const onImageError = event => {
      console.error("图片加载失败:", props.src, event)
      isError.value = true
      isLoaded.value = false
      // 设置默认尺寸
      imageDimensions.value = {
        width: props.containerWidth,
        height: 200
      }
      emit("error", event)
    }

    return {
      imageDimensions,
      isLoaded,
      isError,
      imageStyle,
      onImageLoad,
      onImageError
    }
  }
})
</script>

<style lang="less" scoped>
// 默认样式
image {
  display: block;
  background: #d8d8d8;
  border-radius: 8rpx;
  overflow: hidden;
}
</style>
