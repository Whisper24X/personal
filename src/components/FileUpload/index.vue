<template>
  <div class="file-upload-container">
    <YcPcUpload ref="uploadRef" :accept="accept" :limit="limit" :file-name-type="fileNameType" :env="uploadEnv"
      :file-path="filePath" :file-list="fileList" :get-token="fetchToken"
      :file-upload-end-handler="fileUploadEndHandler" :remove-handler="removeHandler"
      :file-list-select-handler="fileListSelectHandler" :show-file-list="showFileList" :list-type="listType"
      :hide-button-when-reached-limit="hideButtonWhenReachedLimit">
      <template #trigger>
        <slot name="trigger">
          <div class="upload-area" :style="{
            border:
              listType === 'picture-card' ? 'none' : '1px dashed #d9d9d9',
          }">
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              <em>{{ placeholder || '点击上传' }}</em>
            </div>
          </div>
        </slot>
      </template>
    </YcPcUpload>
    <div class="tip-container">
      <div class="el-upload__tip">{{ tipMessage }}</div>
      <slot name="extra"></slot>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import YcPcUpload from '@guanghe-pub/yc-pc-upload-vue'
import '@guanghe-pub/yc-pc-upload-vue/dist/style.css'
import getUploadParams from '@/utils/getUploadParams'
import type { UploadFile } from '@guanghe-pub/yc-pc-upload-vue'

const props = defineProps({
  modelValue: {
    type: [String, Object],
    default: '',
  },
  accept: {
    type: String,
    default: '.doc,.docx,.pdf',
  },
  limit: {
    type: Number,
    default: 1,
  },
  fileNameType: {
    type: Number,
    default: 5,
  },
  filePath: {
    type: String,
    default: 'contract',
  },
  placeholder: {
    type: String,
    default: '',
  },
  tipMessage: {
    type: String,
    default: '支持的文件格式: doc, docx, pdf',
  },
  showFileList: {
    type: Boolean,
    default: true,
  },
  listType: {
    type: String,
    default: 'text',
  },
  hideButtonWhenReachedLimit: {
    type: Boolean,
    default: false,
  },
})
const emit = defineEmits<{
  (e: 'update:modelValue', value: string | UploadFile): void
  (e: 'file-uploaded', file: UploadFile): void
  (e: 'file-removed'): void
}>()

const { fetchToken, uploadEnv } = getUploadParams()
const fileList = ref<UploadFile[]>([])
const uploadRef = ref()

// 维护内部文件列表状态
watch(
  () => props.modelValue,
  (newValue) => {
    if (!newValue) {
      fileList.value = []
    } else if (typeof newValue === 'string') {
      // 处理字符串URL
      fileList.value = [
        {
          name: newValue.split('/').pop() || '文件',
          url: newValue,
          uid: Date.now().toString(),
        },
      ]
    } else if (Array.isArray(newValue)) {
      // 处理数组
      fileList.value = newValue.map((item) => ({
        name: item?.name || item.split('/').pop(),
        url: item.url || item,
        uid: Date.now().toString(),
      }))
    } else if (typeof newValue === 'object') {
      // 处理文件对象
      fileList.value = [newValue]
    }
  },
  { immediate: true },
)

// 文件上传完成处理
const fileUploadEndHandler = (file: UploadFile | null) => {
  if (file) {
    if (props.limit === 1) {
      fileList.value = [file]
      emit('update:modelValue', file)
    } else {
      fileList.value.push(file)
      emit(
        'update:modelValue',
        fileList.value.map((item: UploadFile) => item.url),
      )
    }
    emit('file-uploaded', file)
  } else {
    fileList.value = []
    emit('update:modelValue', '')
  }
}

// 移除文件处理
const removeHandler = (file: UploadFile) => {
  if (props.limit === 1) {
    fileList.value = []
    emit('update:modelValue', '')
  } else {
    fileList.value = fileList.value.filter(
      (item: UploadFile) => item.url !== file.url,
    )
    emit(
      'update:modelValue',
      fileList.value.map((item: UploadFile) => item.url),
    )
  }
  emit('file-removed')
}

// 选择文件处理
const fileListSelectHandler = () => {
  if (props.limit === 1) {
    fileList.value = []
    emit('update:modelValue', '')
  }
}

// 公开的方法
defineExpose({
  clearFiles: removeHandler,
  getFileList: () => fileList.value,
  uploadRef,
})
</script>

<style lang="scss" scoped>
.file-upload-container {
  .upload-area {
    padding: 20px 0;
    border: 1px dashed #d9d9d9;
    border-radius: 6px;
    cursor: pointer;
    text-align: center;
    transition: border-color 0.3s;
    width: 100%;

    &:hover {
      border-color: var(--el-color-primary);
    }

    .el-icon--upload {
      font-size: 28px;
      color: #8c939d;
      margin-bottom: 8px;
    }

    .el-upload__text {
      color: #606266;
      font-size: 14px;

      em {
        color: var(--el-color-primary);
        font-style: normal;
      }
    }
  }

  .tip-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;

    .el-upload__tip {
      color: #909399;
      font-size: 12px;
    }
  }
}
</style>
