<template>
  <view class="image-uploader-advanced">
    <view class="uploader-container">
      <view v-for="(image, index) in images" :key="index" class="image-item">
        <view class="image-preview">
          <image class="uploaded-image" :src="image.url" mode="aspectFill" />
          <view class="image-overlay">
            <view class="delete-btn" @tap="removeImage(index)">
              <image
                class="delete-icon"
                src="https://fp.yangcong345.com/middle/1.0.0/yanxueImg/close_icon.png"
              />
            </view>
            <view v-if="image.uploading" class="uploading-overlay">
              <view class="loading-spinner"></view>
            </view>
          </view>
        </view>
      </view>

      <view
        v-if="images.length < maxCount"
        class="upload-box"
        :class="{ disabled: uploading }"
        :style="{
          width: images.length > 0 ? 'calc((100% - 28rpx) / 4)' : '100%'
        }"
        @tap="triggerUpload"
      >
        <image
          class="upload-icon"
          :src="
            uploading ? loadingIcon : 'https://fp.yangcong345.com/middle/1.0.0/yanxue/camera__w.png'
          "
        />
        <text class="upload-text">{{ uploadText }}</text>
        <text class="upload-count">{{ images.length }} / {{ maxCount }}</text>
      </view>
    </view>

    <!-- 上传进度提示 -->
    <view v-if="uploading && showProgress" class="upload-progress">
      <text class="progress-text">上传中... {{ uploadProgress }}%</text>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue"
import Taro from "@tarojs/taro"
import { handleTaroFileUpload, type UploadFile } from "@/utils/upload"

interface ImageItem extends UploadFile {
  uploading?: boolean
  progress?: number
}

interface Props {
  title?: string
  uploadText?: string
  maxCount?: number
  modelValue?: UploadFile[]
  enableCompress?: boolean
  compressOptions?: {
    quality: number
    maxSize: number
  }
  filePath?: string
  size?: number
  showProgress?: boolean
  autoUpload?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: "上传图片",
  uploadText: "添加图片",
  maxCount: 3,
  modelValue: () => [],
  enableCompress: true,
  compressOptions: () => ({
    quality: 0.85,
    maxSize: 1000
  }),
  filePath: "yanxue/feedback",
  size: 2 * 1024 * 1024, // 2MB
  showProgress: true,
  autoUpload: true
})

const emit = defineEmits<{
  (e: "update:modelValue", value: UploadFile[]): void
  (e: "updateUploading", value: boolean): void
  (e: "uploadSuccess", file: UploadFile): void
  (e: "uploadError", error: Error): void
  (e: "uploadProgress", progress: number): void
}>()

const images = ref<ImageItem[]>([...props.modelValue])
const uploading = ref<boolean>(false)
const uploadProgress = ref<number>(0)

// 图标资源
const loadingIcon = "https://fp.yangcong345.com/middle/1.0.0/yanxueImg/loading-icon__w.png"

// 监听上传状态变化
watch(
  () => uploading.value,
  newVal => {
    emit("updateUploading", newVal)
  }
)

// 监听 modelValue 变化
watch(
  () => props.modelValue,
  newVal => {
    images.value = newVal.map(item => ({ ...item, uploading: false, progress: 100 }))
  },
  { deep: true }
)

// 触发文件选择
const triggerUpload = () => {
  if (uploading.value) return

  Taro.chooseImage({
    count: props.maxCount - images.value.length,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
    success: res => {
      if (props.autoUpload) {
        handleImageUpload(res.tempFilePaths)
      } else {
        // 如果不自动上传，只添加临时图片
        addTempImages(res.tempFilePaths)
      }
    },
    fail: error => {
      console.error("选择图片失败:", error)
      Taro.showToast({
        title: "选择图片失败",
        icon: "none"
      })
    }
  })
}

// 添加临时图片（不上传）
const addTempImages = (tempFilePaths: string[]) => {
  const tempImages: ImageItem[] = tempFilePaths.map((path, index) => ({
    url: path,
    name: `temp_image_${Date.now()}_${index}.jpg`,
    size: 0,
    type: "image/jpeg",
    uploading: false,
    progress: 0
  }))

  images.value.push(...tempImages)
  emit("update:modelValue", images.value)
}

// 处理图片上传
const handleImageUpload = async (tempFilePaths: string[]) => {
  if (uploading.value) return

  try {
    uploading.value = true
    uploadProgress.value = 0

    const totalFiles = tempFilePaths.length
    let completedFiles = 0

    for (let i = 0; i < tempFilePaths.length; i++) {
      const tempFilePath = tempFilePaths[i]

      if (images.value.length >= props.maxCount) {
        Taro.showToast({
          title: `最多只能上传${props.maxCount}张图片`,
          icon: "none"
        })
        break
      }

      // 添加上传中的图片项
      const uploadingImage: ImageItem = {
        url: tempFilePath,
        name: `image_${Date.now()}_${i}.jpg`,
        size: 0,
        type: "image/jpeg",
        uploading: true,
        progress: 0
      }

      images.value.push(uploadingImage)
      emit("update:modelValue", images.value)

      try {
        // 模拟上传进度
        const progressInterval = setInterval(() => {
          const currentImage = images.value.find(img => img.url === tempFilePath)
          if (currentImage && currentImage.uploading) {
            currentImage.progress = Math.min((currentImage.progress || 0) + 10, 90)
          }
        }, 200)

        // 模拟上传延迟
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))

        clearInterval(progressInterval)

        // 模拟上传结果
        const uploadResult = await mockUploadImage(tempFilePath)

        // 更新图片项
        const imageIndex = images.value.findIndex(img => img.url === tempFilePath)
        if (imageIndex !== -1) {
          images.value[imageIndex] = {
            url: uploadResult.url,
            name: `image_${Date.now()}_${i}.jpg`,
            size: uploadResult.size || 0,
            type: "image/jpeg",
            uploading: false,
            progress: 100
          }
        }

        completedFiles++
        uploadProgress.value = Math.round((completedFiles / totalFiles) * 100)
        emit("uploadProgress", uploadProgress.value)
        emit("uploadSuccess", images.value[imageIndex])
      } catch (error) {
        // 上传失败，移除该图片项
        const imageIndex = images.value.findIndex(img => img.url === tempFilePath)
        if (imageIndex !== -1) {
          images.value.splice(imageIndex, 1)
        }

        const errorObj = error instanceof Error ? error : new Error("上传失败")
        emit("uploadError", errorObj)
        console.error("上传图片失败:", error)
      }
    }

    emit("update:modelValue", images.value)

    if (completedFiles > 0) {
      Taro.showToast({
        title: `成功上传${completedFiles}张图片`,
        icon: "success"
      })
    }
  } catch (error) {
    console.error("批量上传失败:", error)
    const errorObj = error instanceof Error ? error : new Error("批量上传失败")
    emit("uploadError", errorObj)
    Taro.showToast({
      title: "上传图片失败",
      icon: "none"
    })
  } finally {
    uploading.value = false
    uploadProgress.value = 0
  }
}

// 模拟图片上传（实际项目中应该替换为真实的上传逻辑）
const mockUploadImage = async (tempFilePath: string): Promise<{ url: string; size?: number }> => {
  // 模拟上传延迟
  await new Promise(resolve => setTimeout(resolve, 1000))
  // 返回临时路径作为示例（实际应该返回服务器URL）
  return {
    url: tempFilePath,
    size: Math.floor(Math.random() * 1000000) + 100000 // 模拟文件大小
  }
}

// 删除图片
const removeImage = (index: number) => {
  images.value.splice(index, 1)
  emit("update:modelValue", images.value)
}

// 清空所有图片
const clearImages = () => {
  images.value = []
  emit("update:modelValue", [])
}

// 重新上传失败的图片
const retryUpload = async () => {
  const failedImages = images.value.filter(img => img.uploading)
  if (failedImages.length > 0) {
    const tempPaths = failedImages.map(img => img.url)
    await handleImageUpload(tempPaths)
  }
}

// 暴露方法给父组件
defineExpose({
  clearImages,
  triggerUpload,
  retryUpload
})
</script>

<style lang="less" scoped>
.image-uploader-advanced {
  width: 100%;

  .uploader-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8rpx;

    .image-item {
      width: calc((100% - 28rpx) / 4);
      height: 72rpx;
      border-radius: 8rpx;
      position: relative;
      overflow: hidden;

      .image-preview {
        width: 100%;
        height: 100%;
        border-radius: 8rpx;
        overflow: hidden;
        position: relative;

        .uploaded-image {
          width: 100%;
          height: 100%;
        }

        .image-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;

          .delete-btn {
            position: absolute;
            top: 4rpx;
            right: 4rpx;
            width: 32rpx;
            height: 32rpx;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;

            .delete-icon {
              width: 20rpx;
              height: 20rpx;
            }
          }

          .uploading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;

            .loading-spinner {
              width: 24rpx;
              height: 24rpx;
              border: 2rpx solid #ffffff;
              border-top: 2rpx solid transparent;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            }
          }
        }
      }
    }

    .upload-box {
      width: 100%;
      height: 160rpx;
      border-radius: 12rpx;
      display: flex;
      flex-direction: column;
      gap: 12rpx;
      justify-content: center;
      align-items: center;
      background: #f7f7f9;
      border: 2rpx dashed #e0e0e0;
      margin-top: 16rpx;
      transition: all 0.3s;

      &.disabled {
        opacity: 0.6;
        background: #f0f0f0;
      }

      .upload-icon {
        width: 48rpx;
        height: 48rpx;
        animation: pulse 2s infinite;
      }

      .upload-text {
        font-size: 28rpx;
        color: #666666;
        line-height: 1;
        font-weight: 500;
      }

      .upload-count {
        font-size: 24rpx;
        color: #999999;
        line-height: 1;
      }
    }
  }

  .upload-progress {
    margin-top: 16rpx;
    padding: 16rpx;
    background: #f8f8f8;
    border-radius: 8rpx;

    .progress-text {
      display: block;
      font-size: 24rpx;
      color: #666;
      margin-bottom: 8rpx;
    }

    .progress-bar {
      width: 100%;
      height: 4rpx;
      background: #e0e0e0;
      border-radius: 2rpx;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #007aff, #00d4ff);
        border-radius: 2rpx;
        transition: width 0.3s ease;
      }
    }
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}
</style>
