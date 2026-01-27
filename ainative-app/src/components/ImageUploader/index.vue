<template>
  <view class="image-uploader">
    <view class="uploader-container">
      <view v-for="(image, index) in images" :key="index" class="image-item">
        <view class="image-preview">
          <image class="uploaded-image" :src="image.url" mode="aspectFill" />
          <view class="delete-btn" @tap="removeImage(index)">
            <image
              class="delete-icon"
              src="https://fp.yangcong345.com/middle/1.0.0/yanxueImg/close_icon.png"
            />
          </view>
        </view>
      </view>

      <view v-if="images.length < maxCount" class="upload-box" @tap="triggerUpload">
        <image
          class="upload-icon"
          src="https://fp.yangcong345.com/middle/1.0.0/yanxue/camera__w.png"
        />
        <text class="upload-text">{{ uploadText }}</text>
        <text class="upload-count">{{ images.length }} / {{ maxCount }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import Taro from "@tarojs/taro"
import type { UploadFile } from "@/utils/upload"

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
  size: 2 * 1024 * 1024 // 2MB
})

const emit = defineEmits<{
  (e: "update:modelValue", value: UploadFile[]): void
  (e: "updateUploading", value: boolean): void
  (e: "uploadSuccess", file: UploadFile): void
  (e: "uploadError", error: Error): void
}>()

const images = ref<UploadFile[]>([...props.modelValue])
const uploading = ref<boolean>(false)

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
    images.value = [...newVal]
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
      handleImageUpload(res.tempFilePaths)
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

// 处理图片上传
const handleImageUpload = async (tempFilePaths: string[]) => {
  if (uploading.value) return

  try {
    uploading.value = true

    for (const tempFilePath of tempFilePaths) {
      if (images.value.length >= props.maxCount) {
        Taro.showToast({
          title: `最多只能上传${props.maxCount}张图片`,
          icon: "none"
        })
        break
      }

      // 模拟文件上传（实际项目中应该调用真实的上传接口）
      const mockUploadResult = await mockUploadImage(tempFilePath)

      const uploadFile: UploadFile = {
        url: mockUploadResult.url,
        name: `image_${Date.now()}.jpg`,
        size: 0,
        type: "image/jpeg"
      }

      images.value.push(uploadFile)
      emit("uploadSuccess", uploadFile)
    }

    emit("update:modelValue", [...images.value])
  } catch (error) {
    console.error("上传图片失败:", error)
    const errorObj = error instanceof Error ? error : new Error("上传失败")
    emit("uploadError", errorObj)
    Taro.showToast({
      title: "上传图片失败",
      icon: "none"
    })
  } finally {
    uploading.value = false
  }
}

// 模拟图片上传（实际项目中应该替换为真实的上传逻辑）
const mockUploadImage = async (tempFilePath: string): Promise<{ url: string }> => {
  // 模拟上传延迟
  await new Promise(resolve => setTimeout(resolve, 1000))
  // 返回临时路径作为示例（实际应该返回服务器URL）
  return { url: tempFilePath }
}

// 删除图片
const removeImage = (index: number) => {
  images.value.splice(index, 1)
  emit("update:modelValue", [...images.value])
}

// 清空所有图片
const clearImages = () => {
  images.value = []
  emit("update:modelValue", [])
}

// 暴露方法给父组件
defineExpose({
  clearImages,
  triggerUpload
})
</script>

<style lang="less" scoped>
.image-uploader {
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

        .delete-btn {
          position: absolute;
          top: 4rpx;
          right: 4rpx;
          width: 32rpx;
          height: 32rpx;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;

          .delete-icon {
            width: 20rpx;
            height: 20rpx;
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

      .upload-icon {
        width: 48rpx;
        height: 48rpx;
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
}
</style>
