<template>
  <view class="super-image-container" :style="containerStyle">
    <image
      v-if="!isBase64 && !loading"
      class="super-image"
      :src="src"
      :mode="mode"
      :lazy-load="lazyLoad"
      :show-menu-by-longpress="showMenuByLongpress"
      :style="imageStyle"
      @error="handleError"
      @load="handleLoad"
    />
    <image
      v-else-if="isBase64 && !loading"
      class="super-image"
      :src="base64Data"
      :mode="mode"
      :style="imageStyle"
      @error="handleError"
      @load="handleLoad"
    />
    <view v-if="loading" class="loading-container">
      <view class="loading-spinner"></view>
    </view>
    <view v-if="error && !loading" class="error-container">
      <text class="error-text">{{ errorText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"
import Taro from "@tarojs/taro"

interface Props {
  src: string
  mode?:
    | "scaleToFill"
    | "aspectFit"
    | "aspectFill"
    | "widthFix"
    | "heightFix"
    | "top"
    | "bottom"
    | "center"
    | "left"
    | "right"
    | "top left"
    | "top right"
    | "bottom left"
    | "bottom right"
  lazyLoad?: boolean
  showMenuByLongpress?: boolean
  width?: string | number
  height?: string | number
  radius?: string | number
  toBase64?: boolean
  fallbackSrc?: string
  errorText?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: "aspectFill",
  lazyLoad: true,
  showMenuByLongpress: false,
  width: "100%",
  height: "auto",
  radius: "0",
  toBase64: false,
  fallbackSrc: "",
  errorText: "图片加载失败"
})

const emit = defineEmits(["load", "error"])

const loading = ref(false)
const error = ref(false)
const base64Data = ref("")
const isBase64 = ref(false)

// 计算样式
const containerStyle = computed(() => {
  return {
    width: typeof props.width === "number" ? `${props.width}px` : props.width,
    height: typeof props.height === "number" ? `${props.height}px` : props.height
  }
})

const imageStyle = computed(() => {
  return {
    width: "100%",
    height: "100%",
    borderRadius: typeof props.radius === "number" ? `${props.radius}px` : props.radius
  }
})

// 处理图片加载成功
const handleLoad = e => {
  loading.value = false
  error.value = false
  emit("load", e)
}

// 处理图片加载失败
const handleError = e => {
  loading.value = false
  error.value = true
  emit("error", e)

  // 如果有备用图片，则使用备用图片
  if (props.fallbackSrc) {
    // 避免循环调用
    if (props.src !== props.fallbackSrc) {
      Taro.getImageInfo({
        src: props.fallbackSrc,
        success: () => {
          error.value = false
        },
        fail: () => {
          error.value = true
        }
      })
    }
  }
}

// 将图片转换为 Base64
const convertToBase64 = async (imagePath: string) => {
  console.log("convertToBase64", imagePath)
  loading.value = true

  try {
    // 先获取图片信息
    const imageInfo = await Taro.getImageInfo({
      src: imagePath
    })

    // 如果是网络图片，需要先下载
    let localPath = imageInfo.path
    if (imagePath.startsWith("http")) {
      const downloadResult = await Taro.downloadFile({
        url: imagePath
      })
      localPath = downloadResult.tempFilePath
    }

    // 读取本地文件内容
    const fileContent = await Taro.getFileSystemManager().readFileSync(localPath, "base64")

    // 获取图片类型
    const imageType = localPath.substring(localPath.lastIndexOf(".") + 1).toLowerCase()
    const mimeType = `image/${imageType === "jpg" ? "jpeg" : imageType}`

    // 拼接 Base64 数据
    base64Data.value = `data:${mimeType};base64,${fileContent}`
    isBase64.value = true
    loading.value = false
  } catch (err) {
    console.error("转换图片到 Base64 失败:", err)
    error.value = true
    loading.value = false
  }
}

// 监听 src 变化
watch(
  () => props.src,
  newSrc => {
    if (newSrc) {
      error.value = false
      if (props.toBase64) {
        convertToBase64(newSrc)
      } else {
        isBase64.value = false
      }
    }
  },
  { immediate: true }
)

// 监听 toBase64 变化
watch(
  () => props.toBase64,
  newValue => {
    if (newValue && props.src && !isBase64.value) {
      convertToBase64(props.src)
    }
  }
)

onMounted(() => {
  if (props.src) {
    if (props.toBase64) {
      convertToBase64(props.src)
    }
  }
})
</script>

<style lang="less">
.super-image-container {
  position: relative;
  overflow: hidden;

  .super-image {
    display: block;
  }

  .loading-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #f5f5f5;

    .loading-spinner {
      width: 30px;
      height: 30px;
      border: 3px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: #1890ff;
      animation: spin 1s ease-in-out infinite;
    }
  }

  .error-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #f5f5f5;

    .error-text {
      font-size: 12px;
      color: #999;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
}
</style>
