<template>
  <view class="image-uploader">
    <view class="uploader-container">
      <view v-for="(image, index) in images" :key="image.uid || index" class="image-item">
        <view class="image-preview">
          <image :src="image.url" alt="uploaded-image" />
          <!-- 上传进度显示 -->
          <view v-if="image.status === 'uploading'" class="upload-progress">
            <view class="progress-text">{{ image.percentage }}%</view>
            <view class="progress-bar">
              <view class="progress-fill" :style="{ width: image.percentage + '%' }"></view>
            </view>
          </view>
          <!-- 上传失败提示 -->
          <view v-if="image.status === 'fail'" class="upload-fail" @tap="retryUpload(index)">
            <text>上传失败，点击重试</text>
          </view>
          <view class="delete-btn" @tap="removeImage(index)"></view>
        </view>
      </view>

      <view
        v-if="images.length < maxCount"
        class="upload-box"
        :style="{
          width: images.length > 0 ? 'calc((100% - 28px) / 4)' : '100%'
        }"
        @tap="triggerUpload"
      >
        <image
          class="upload-icon"
          src="https://fp.yangcong345.com/middle/1.0.0/yanxue/camera__w.png"
          alt="upload-icon"
        />
        <view class="upload-text">{{ uploadText }}</view>
        <view class="upload-count">{{ images.length }} / {{ maxCount }}</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import Taro from "@tarojs/taro"
// 使用新的 fileUpload 工具
import { courseEvaluationImageUpload, type UploadFile } from "../../../../utils/fileUpload"

const props = defineProps({
  title: {
    type: String,
    default: "上传图片"
  },
  uploadText: {
    type: String,
    default: "添加图片"
  },
  maxCount: {
    type: Number,
    default: 3
  },
  modelValue: {
    type: Array as () => UploadFile[],
    default: () => []
  }
})

const emit = defineEmits(["update:modelValue", "updateUploading"])

const images = ref<UploadFile[]>([...props.modelValue])
const uploading = ref<boolean>(false)
watch(
  () => uploading.value,
  newVal => {
    emit("updateUploading", newVal)
  }
)

// 触发文件选择
const triggerUpload = async () => {
  if (uploading.value) return

  try {
    uploading.value = true

    // 检查是否已达到最大上传数量
    if (images.value.length >= props.maxCount) {
      Taro.showToast({
        title: `最多只能上传${props.maxCount}张图片`,
        icon: "none"
      })
      return
    }

    // 使用新的 fileUpload 工具进行课程评价图片上传
    const files = await courseEvaluationImageUpload({
      count: props.maxCount - images.value.length, // 计算还能上传多少张
      limit: props.maxCount - images.value.length,
      compressOptions: {
        quality: 85, // 压缩质量，整数，取值范围：0-100
        maxSize: 1000,
        width: 800,
        height: 600
      }
    })

    // 添加新上传的文件到列表中
    images.value.push(...files)
    emit("update:modelValue", [...images.value])

    // 显示上传成功提示
    if (files.length > 0) {
      Taro.showToast({
        title: `成功上传${files.length}张图片`,
        icon: "success",
        duration: 2000
      })
    }
  } catch (error) {
    console.error("上传图片失败", error)
    // 错误提示已经在 courseEvaluationImageUpload 内部处理了
  } finally {
    uploading.value = false
  }
}

// 删除图片
const removeImage = (index: number) => {
  images.value.splice(index, 1)
  emit("update:modelValue", [...images.value])
}

// 重试上传失败的文件
const retryUpload = async (index: number) => {
  const file = images.value[index]
  if (!file || file.status !== "fail") return

  try {
    uploading.value = true
    file.status = "uploading"
    file.percentage = 0

    // 重新上传单个文件
    const retryFile = await courseEvaluationImageUpload({
      count: 1,
      limit: 1,
      compressOptions: {
        quality: 85, // 压缩质量，整数，取值范围：0-100
        maxSize: 1000,
        width: 800,
        height: 600
      }
    })

    if (retryFile.length > 0) {
      // 替换失败的文件
      images.value[index] = retryFile[0]
      emit("update:modelValue", [...images.value])

      Taro.showToast({
        title: "重试上传成功",
        icon: "success"
      })
    }
  } catch (error) {
    console.error("重试上传失败", error)
    file.status = "fail"
  } finally {
    uploading.value = false
  }
}
</script>

<style lang="less">
.image-uploader {
  width: 100%;

  .uploader-container {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;

    .image-item {
      width: 124rpx;
      max-height: 124rpx;
      border-radius: 7.68rpx;
      position: relative;
      overflow: hidden;

      .image-preview {
        width: 100%;
        height: 100%;
        border-radius: 8rpx;
        overflow: hidden;
        position: relative;

        image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .delete-btn {
          position: absolute;
          top: 4rpx;
          right: 4rpx;
          width: 32rpx;
          height: 32rpx;
          background: url("https://fp.yangcong345.com/middle/1.0.0/yanxue/close__w.png");
          background-size: 32rpx 32rpx;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .upload-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8rpx;
          display: flex;
          flex-direction: column;
          gap: 4rpx;

          .progress-text {
            font-size: 12rpx;
            text-align: center;
          }

          .progress-bar {
            width: 100%;
            height: 4rpx;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 2px;
            overflow: hidden;

            .progress-fill {
              height: 100%;
              background: #4caf50;
              transition: width 0.3s ease;
            }
          }
        }

        .upload-fail {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(244, 67, 54, 0.9);
          color: white;
          padding: 8rpx;
          text-align: center;
          font-size: 12rpx;
          cursor: pointer;
          transition: background-color 0.2s ease;

          &:active {
            background: rgba(244, 67, 54, 1);
          }
        }
      }
    }

    .upload-box {
      width: 100%;
      height: 144rpx;
      border-radius: 7.68rpx;
      display: flex;
      flex-direction: column;
      gap: 8rpx;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      font-family: "PingFang SC", sans-serif;
      font-size: 22rpx;
      line-height: 22rpx;
      background: #f7f7f9;

      .upload-icon {
        width: 32rpx;
        height: 32rpx;
      }

      .upload-text {
        color: #848096;
      }

      .upload-count {
        color: #b8b4c7;
      }
    }
  }
}
</style>
