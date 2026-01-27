<template>
  <el-dialog
    :title="title"
    v-model="dialogVisible"
    width="1000px"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="购买渠道" prop="channelId">
        <el-select
          v-model="form.channelId"
          placeholder="请选择渠道"
          style="width: 100%"
          :loading="channelLoading"
        >
          <el-option
            v-for="item in channelOptions.filter((item) => item.value !== '')"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="订单数据" prop="fileUrl">
        <FileUpload
          v-model="form.fileUrl"
          accept=".csv"
          file-path="order/csv"
          :tip-message="'只能上传csv文件'"
          @file-uploaded="handleFileUploaded"
          @file-removed="handleFileRemoved"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="loading"
        >确定</el-button
      >
    </template>
  </el-dialog>

  <!-- 成功消息弹出框 -->
  <OrderSuccessMessageDialog
    v-model:visible="successDialogVisible"
    :message="successMessage"
  />
</template>

<script setup lang="ts">
import { ref, reactive, defineProps, defineEmits, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import FileUpload from '@/components/FileUpload/index.vue'
import { importOrdersByCsvFile, getChannelList } from '../../service'
import { CHANNEL_OPTIONS } from '../../service.type'
import OrderSuccessMessageDialog from '../OrderSuccessMessageDialog/index.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:visible', 'success'])

const dialogVisible = ref(props.visible)
const loading = ref(false)
const channelLoading = ref(false)
const formRef = ref<FormInstance>()
const title = ref('导入订单数据')
const channelOptions = ref(CHANNEL_OPTIONS)

// 成功消息弹出框相关
const successDialogVisible = ref(false)
const successMessage = ref('')

const form = reactive({
  fileUrl: '',
  channelId: '',
})

const rules = {
  fileUrl: [{ required: true, message: '请上传CSV文件', trigger: 'change' }],
  channelId: [{ required: true, message: '请选择购买渠道', trigger: 'change' }],
}

watch(
  () => props.visible,
  (newVal) => {
    dialogVisible.value = newVal
    if (newVal) {
      loadChannelOptions()
    }
  },
)

watch(
  () => dialogVisible.value,
  (newVal) => {
    emit('update:visible', newVal)
  },
)

const handleClose = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
  form.fileUrl = ''
  form.channelId = ''
}

const handleFileUploaded = (file: any) => {
  form.fileUrl = file.url
}

const handleFileRemoved = () => {
  form.fileUrl = ''
}

const loadChannelOptions = async () => {
  try {
    channelLoading.value = true
    const res = await getChannelList()
    if (res && res.list && res.list.length > 0) {
      const options = res.list.map((item) => ({
        label: item.name,
        value: item.id,
      }))
      //小程序渠道不支持导入订单
      channelOptions.value = options.filter((item) => item.label !== '小程序')
    }
  } catch (error) {
    console.error('获取渠道列表失败:', error)
    ElMessage.error('获取渠道列表失败，请刷新页面重试')
  } finally {
    channelLoading.value = false
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    loading.value = true
    // 调用导入API
    const response = await importOrdersByCsvFile({
      fileUrl: form.fileUrl,
      channelId: form.channelId,
    })

    // 完成导入
    dialogVisible.value = false
    // 显示成功消息弹出框
    if (response?.message !== '商品:未在系统注册') {
      successMessage.value = response?.message || '文件导入成功'
      successDialogVisible.value = true
    } else {
      ElMessage.success('文件导入成功，无未注册商品')
    }
    emit('success')
  } catch (error: any) {
    console.error('导入失败:', error)

    // 使用可手动关闭的弹出框展示错误信息
    ElMessageBox.alert(
      error?.data?.message ||
        error?.response?.data?.message ||
        error?.message ||
        '请检查文件格式是否正确',
      '导入失败',
      {
        confirmButtonText: '确定',
        type: 'error',
      },
    )
  } finally {
    loading.value = false
  }
}
</script>
