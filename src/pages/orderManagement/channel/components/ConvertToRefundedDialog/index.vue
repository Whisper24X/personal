<template>
  <el-dialog
    title="将订单状态转为已退款"
    v-model="dialogVisible"
    width="500px"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="订单编号">
        <span>{{ form.orderNumber }}</span>
      </el-form-item>
      <el-form-item label="商品名称">
        <span>{{ form.goodName }}</span>
      </el-form-item>
      <el-form-item label="操作原因" prop="reason">
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="4"
          placeholder="请输入操作原因"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="danger" @click="handleSubmit" :loading="loading"
        >确认</el-button
      >
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { convertOrderToRefunded } from '../../service'
import type { OrderItem } from '../../service.type'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  orderData: {
    type: Object as () => OrderItem | undefined,
    default: undefined,
  },
})

const emit = defineEmits(['update:visible', 'success'])

const dialogVisible = ref(props.visible)
const loading = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  id: '',
  orderNumber: '',
  goodName: '',
  reason: '',
})

const rules: FormRules = {
  reason: [
    { required: true, message: '请输入操作原因', trigger: 'blur' },
    { max: 200, message: '操作原因不能超过200个字符', trigger: 'blur' },
  ],
}

watch(
  () => props.visible,
  (newVal) => {
    dialogVisible.value = newVal
    if (newVal && props.orderData) {
      form.id = props.orderData.id
      form.orderNumber = props.orderData.orderNumber
      form.goodName = props.orderData.goodName
      form.reason = ''
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
  formRef.value?.resetFields()
  form.id = ''
  form.orderNumber = ''
  form.goodName = ''
  form.reason = ''
}

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    loading.value = true

    await convertOrderToRefunded({
      id: form.id,
      reason: form.reason,
    })

    ElMessage.success('订单状态已转为已退款')
    dialogVisible.value = false
    emit('success')
  } catch (error) {
    console.error('操作失败:', error)
    ElMessage.error('操作失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped></style>
