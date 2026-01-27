<template>
  <el-dialog
    :title="config.title"
    v-model="dialogVisible"
    width="500px"
    :close-on-click-modal="false"
    @close="handleCancel"
  >
    <div class="import-content">
      <YcPcUpload
        ref="uploadRef"
        accept=".xlsx,.xls"
        :limit="2"
        :file-name-type="5"
        :env="uploadEnv"
        :file-path="config.filePath"
        :file-list="fileList"
        :get-token="fetchToken"
        :file-upload-end-handler="fileUploadEndHandler"
        :remove-handler="removeHandler"
        :file-list-select-handler="fileListSelectHandler"
      >
        <div class="upload-area">
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">
            <em>点击上传</em>
          </div>
        </div>
      </YcPcUpload>
      <div class="tip-container">
        <div class="el-upload__tip">只能上传 xlsx/xls 文件</div>
        <div class="template-download">
          <el-button
            type="primary"
            link
            :loading="downloading"
            @click="handleDownloadTemplate"
          >
            <el-icon><Download /></el-icon>
            下载导入模板
          </el-button>
        </div>
      </div>
      <div v-if="errorMessages.length" class="error-messages">
        <div class="error-title">导入失败原因：</div>
        <ul>
          <li v-for="(error, index) in errorMessages" :key="index">
            {{ error }}
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button
          type="primary"
          :loading="uploading"
          :disabled="!url"
          @click="handleConfirm"
        >
          确认导入
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { UploadFilled, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import YcPcUpload from '@guanghe-pub/yc-pc-upload-vue'
import '@guanghe-pub/yc-pc-upload-vue/dist/style.css'
import getUploadParams from '@/utils/getUploadParams'
import type { UploadFile } from '@guanghe-pub/yc-pc-upload-vue'
import { IMPORT_CONFIGS } from './config'
import type { ImportConfig } from './types'
import request from '@/service/axios.interceptor'

const props = defineProps<{
  modelValue: boolean
  type: keyof typeof IMPORT_CONFIGS
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const { fetchToken, uploadEnv } = getUploadParams()
const config = ref<ImportConfig>(IMPORT_CONFIGS[props.type])
const dialogVisible = ref(false)
const fileList = ref<UploadFile[]>([])
const uploading = ref(false)
const errorMessages = ref<string[]>([])
const downloading = ref(false)
const url = ref('')
const uploadRef = ref()

watch(
  () => props.modelValue,
  (val) => {
    dialogVisible.value = val
  },
)

watch(
  () => dialogVisible.value,
  (val) => {
    emit('update:modelValue', val)
  },
)

const fileUploadEndHandler = (file: UploadFile | null) => {
  if (file) {
    fileList.value = [file]
    url.value = file.url
  } else {
    fileList.value = []
    url.value = ''
  }
  errorMessages.value = []
}

const removeHandler = () => {
  fileList.value = []
  url.value = ''
  errorMessages.value = []
}

const fileListSelectHandler = () => {
  fileList.value = []
  url.value = ''
  errorMessages.value = []
}

const handleCancel = () => {
  removeHandler()
  dialogVisible.value = false
}

const handleConfirm = async () => {
  if (!url.value) {
    ElMessage.warning('请选择要导入的文件')
    return
  }
  uploading.value = true
  try {
    const res = await request.post(config.value.importApi, {
      fileUrl: url.value,
    })
    if (res.isSucceed) {
      ElMessage.success(config.value.successMessage)
      emit('success')
      handleCancel()
    } else {
      errorMessages.value = res.failureReasons || [config.value.errorMessage]
    }
  } catch (error) {
    console.error('导入失败：', error)
    ElMessage.error(config.value.errorMessage)
  } finally {
    uploading.value = false
  }
}

const handleDownloadTemplate = async () => {
  if (downloading.value) return

  downloading.value = true
  try {
    const link = document.createElement('a')
    link.href = config.value.templateUrl
    link.setAttribute('download', config.value.templateFileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('下载模板失败：', error)
    ElMessage.error('下载模板失败')
  } finally {
    downloading.value = false
  }
}
</script>

<style lang="scss" scoped>
.error-messages {
  margin-top: 20px;
  padding: 12px;
  background-color: #fff0f0;
  border-radius: 4px;

  .error-title {
    color: #f56c6c;
    font-weight: bold;
    margin-bottom: 8px;
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      color: #f56c6c;
      line-height: 1.6;
    }
  }
}

.upload-area {
  padding: 20px 0;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.3s;
  width: calc(var(--el-dialog-width) - var(--el-dialog-padding-primary) * 2);

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
  }
}
</style>
