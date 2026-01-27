<template>
  <el-dialog
    title="导入手机号"
    v-model="dialogVisible"
    width="1000px"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="手机号数据" prop="fileUrl">
        <FileUpload
          v-model="form.fileUrl"
          accept=".xlsx"
          file-path="order/phone-xlsx"
          :tip-message="'只支持上传xlsx格式文件，文件需包含订单编号和手机号两列'"
          @file-uploaded="handleFileUploaded"
          @file-removed="handleFileRemoved"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, defineProps, defineEmits, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import FileUpload from '@/components/FileUpload/index.vue'
import { importPhonesByCsvFile } from '../../service'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:visible', 'success'])

const dialogVisible = ref(props.visible)
const formRef = ref<FormInstance>()

const form = reactive({
  fileUrl: '',
})

const rules = {
  fileUrl: [
    { required: true, message: '请上传CSV,XLS,文件', trigger: 'change' },
  ],
}

watch(
  () => props.visible,
  (newVal) => {
    dialogVisible.value = newVal
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
}

const handleFileUploaded = (file: any) => {
  form.fileUrl = file.url
}

const handleFileRemoved = () => {
  form.fileUrl = ''
}

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    // 调用导入手机号API
    const response = await importPhonesByCsvFile({
      fileUrl: form.fileUrl,
    })

    // 完成导入
    dialogVisible.value = false
    ElMessage.success('手机号导入成功')
    emit('success')
  } catch (error: any) {
    console.error('导入手机号失败:', error)

    // 使用可手动关闭的弹出框展示错误信息
    ElMessageBox.alert(
      error?.response?.data?.message ||
        error?.message ||
        '请检查文件格式是否正确',
      '导入手机号失败',
      {
        confirmButtonText: '确定',
        type: 'error',
      },
    )
  }
}
</script>
