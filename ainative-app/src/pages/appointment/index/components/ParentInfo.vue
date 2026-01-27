<template>
  <view class="parent-info">
    <view class="info-row">
      <view class="label">备注</view>
      <view class="value-wrapper">
        <view v-if="!textareaFocused" class="textarea-placeholder" @tap="handleTextareaClick">
          <text v-if="!form.parentRemark" class="placeholder">备注特殊要求、注意事项等</text>
          <text v-else class="textarea-value">{{ form.parentRemark }}</text>
        </view>
        <textarea
          v-else
          v-model="form.parentRemark"
          class="textarea-field"
          placeholder-class="placeholder"
          maxlength="500"
          placeholder="备注特殊要求、注意事项等"
          :focus="textareaFocused"
          @input="handleRemarkInput"
          @blur="handleTextareaBlur"
        ></textarea>
      </view>
    </view>

    <view v-if="verificationCodeType !== 'none'" class="info-row verification-code">
      <view class="label required">核销码</view>
      <view class="value-wrapper upload-wrapper">
        <view v-if="!verificationImageUrl" class="upload-btn" @tap="triggerUpload">
          <view class="upload-icon">+</view>
          <view class="upload-text">上传核销码</view>
        </view>
        <view v-else class="image-preview">
          <image :src="verificationImageUrl" mode="aspectFill" />
          <view class="delete-btn" @tap="removeImage">
            <text class="delete-icon">×</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import Taro from "@tarojs/taro"
import { fileUpload } from "@/utils/fileUpload"

export interface ParentInfoForm {
  parentAccompany: string
  verificationCode: string
  parentRemark: string
}

interface Props {
  modelValue: ParentInfoForm
  verificationCodeType: string
}

const props = defineProps<Props>()
const emit = defineEmits(["update:modelValue", "change"])

// 表单数据
const form = ref<ParentInfoForm>({
  parentAccompany: "unknown",
  verificationCode: "",
  parentRemark: ""
})

const verificationImageUrl = ref<string>("")
const uploading = ref<boolean>(false)
const textareaFocused = ref<boolean>(false)

// 处理点击 view 切换为 textarea
const handleTextareaClick = () => {
  textareaFocused.value = true
}

// 处理 textarea 失焦切换回 view
const handleTextareaBlur = () => {
  textareaFocused.value = false
}

// 处理备注输入
const handleRemarkInput = () => {
  console.log("备注输入变化:", form.value.parentRemark)
  // 强制触发表单更新
  form.value = { ...form.value }
}

// 监听props变化，更新表单数据
watch(
  () => props.modelValue,
  newValue => {
    if (newValue) {
      form.value = { ...newValue }
      if (newValue.verificationCode) {
        verificationImageUrl.value = newValue.verificationCode
      }
    }
  },
  { immediate: true, deep: true }
)

// 监听表单变化，更新父组件数据
watch(
  form,
  newValue => {
    console.log("newValue", newValue)
    emit("update:modelValue", { ...newValue })
    emit("change", { ...newValue })
  },
  { deep: true }
)

// 触发文件选择
const triggerUpload = async () => {
  if (uploading.value) return

  try {
    uploading.value = true

    // 使用文件上传工具
    const file = await fileUpload({
      filePath: "yanxue/verification-code",
      enableCompress: true,
      compressOptions: {
        quality: 85,
        maxSize: 1000
      },
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"]
    })

    form.value.verificationCode = file.url
    verificationImageUrl.value = file.url
  } catch (error) {
    console.error("上传失败:", error)
    Taro.showToast({
      title: "上传失败，请重试",
      icon: "none"
    })
  } finally {
    uploading.value = false
  }
}

// 移除图片
const removeImage = () => {
  verificationImageUrl.value = ""
  form.value.verificationCode = ""
}

// 提供一个公共方法用于外部设置核销码
const setVerificationCode = (url: string) => {
  if (url) {
    form.value.verificationCode = url
    verificationImageUrl.value = url
  }
}

// 暴露方法给父组件
defineExpose({
  setVerificationCode
})
</script>

<style lang="less">
.parent-info {
  display: flex;
  flex-direction: column;
  gap: 48rpx;
  width: 100%;

  .info-row {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .label {
      min-width: 240rpx;
      font-size: 28rpx;
      font-weight: 600;
      line-height: 28rpx;
      letter-spacing: normal;
      color: #393548;

      &.required::before {
        content: "*";
        color: #f56c6c;
        margin-right: 8rpx;
      }
    }

    .value-wrapper {
      flex: 1;
      align-self: flex-end;
      .placeholder {
        color: #b8b4c7;
      }
      .input-field {
        width: 100%;
        border: none;
        outline: none;
        font-size: 28rpx;
        color: #504b64;
        background: transparent;
        text-align: right;
      }

      .textarea-field {
        height: 120rpx;
        width: 100%;
        border: none;
        outline: none;
        font-size: 28rpx;
        color: #504b64;
        background: transparent;
        text-align: right;
      }

      .textarea-placeholder {
        min-height: 120rpx;
        width: 100%;
        font-size: 28rpx;
        text-align: right;
        display: flex;
        align-items: center;
        justify-content: flex-end;

        .placeholder {
          color: #b8b4c7;
        }

        .textarea-value {
          color: #504b64;
          word-break: break-all;
          white-space: pre-wrap;
        }
      }

      &.radio-group {
        display: flex;
        gap: 24rpx;
        align-items: center;
        justify-content: flex-end;

        .radio-item {
          display: flex;
          align-items: center;
          gap: 8rpx;

          .radio-label {
            font-size: 28rpx;
            font-weight: normal;
            line-height: 28rpx;
            letter-spacing: normal;
            color: #504b64;
          }
        }
      }
    }

    &.verification-code {
      align-items: flex-start;

      .upload-wrapper {
        display: flex;
        flex-direction: column;
        align-items: flex-end;

        .upload-btn {
          width: 200rpx;
          height: 200rpx;
          border: 2rpx dashed #dcdfe6;
          border-radius: 16rpx;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          cursor: pointer;

          .upload-icon {
            font-size: 48rpx;
            color: #909399;
            margin-bottom: 16rpx;
          }

          .upload-text {
            font-size: 24rpx;
            color: #909399;
          }
        }

        .image-preview {
          position: relative;
          width: 200rpx;
          height: 200rpx;
          border-radius: 16rpx;
          overflow: hidden;

          image {
            width: 100%;
            height: 100%;
          }

          .delete-btn {
            position: absolute;
            top: 0;
            right: 0;
            width: 48rpx;
            height: 48rpx;
            background-color: rgba(0, 0, 0, 0.5);
            border-radius: 0 0 0 16rpx;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;

            .delete-icon {
              font-size: 32rpx;
              color: #fff;
            }
          }
        }
      }
    }
  }
}
</style>
