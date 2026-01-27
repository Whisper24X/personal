<template>
  <el-dialog
    title="操作退款"
    v-model="dialogVisible"
    width="500px"
    @close="handleClose"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
      <el-form-item label="订单编号">
        <el-input v-model="form.orderNumber" disabled />
      </el-form-item>
      <el-form-item label="商品名称">
        <el-input v-model="form.goodName" disabled />
      </el-form-item>
      <el-form-item label="实付金额">
        <el-input v-model="displayOrderPrice" disabled />
      </el-form-item>
      <el-form-item label="退款原因" prop="refundReason">
        <el-input
          v-model="form.refundReason"
          type="textarea"
          :rows="4"
          placeholder="请输入退款原因"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="退款金额" prop="refundAmount">
        <el-input
          v-model="form.refundAmount"
          placeholder="请输入退款金额（元）"
          type="number"
          :min="0"
          :max="form.orderPrice"
          step="0.01"
        />
        <div class="tip">温馨提示：退款金额不得大于实付金额</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="loading"
        >确认退款</el-button
      >
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { miniProgramOrderRefund } from '../../service'
import type { OrderItem } from '../../service.type'
import { formatMoney } from '@/utils/money'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  orderData: {
    type: Object as () => OrderItem | undefined,
    default: () => undefined,
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
  orderPrice: 0,
  payId: '',
  refundReason: '',
  refundAmount: '',
})

const displayOrderPrice = computed(() => {
  return formatMoney(form.orderPrice)
})

// 验证退款金额
const validateRefundAmount = (_rule: any, value: any, callback: any) => {
  if (!value) {
    callback(new Error('请输入退款金额'))
    return
  }
  const amount = Number.parseFloat(value)
  if (isNaN(amount)) {
    callback(new Error('请输入有效的退款金额'))
    return
  }
  if (amount <= 0) {
    callback(new Error('退款金额必须大于0'))
    return
  }
  // 将用户输入的元金额与订单金额（已转为元）进行比较
  const orderPriceInYuan = form.orderPrice / 100
  if (amount > orderPriceInYuan) {
    callback(new Error('退款金额不得大于实付金额'))
    return
  }
  callback()
}

const rules: FormRules = {
  refundReason: [
    { required: true, message: '请输入退款原因', trigger: 'blur' },
    { max: 200, message: '退款原因不能超过200个字符', trigger: 'blur' },
  ],
  refundAmount: [
    { required: true, validator: validateRefundAmount, trigger: 'blur' },
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
      form.orderPrice = props.orderData.orderPrice
      form.payId = props.orderData.payId || ''
      form.refundReason = ''
      form.refundAmount = ''
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
}

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    loading.value = true
    
    // 将用户输入的退款金额从元转换为分（提交给后端）
    const refundAmountInCents = Math.round(Number.parseFloat(form.refundAmount) * 100)
    
    await miniProgramOrderRefund({
      orderId: form.id,
      payId: form.payId,
      refundReason: form.refundReason,
      refundAmount: refundAmountInCents,
    })

    ElMessage.success('退款申请已提交，微信商户将进行退款处理')
    dialogVisible.value = false
    emit('success')
  } catch (error) {
    console.error('退款失败:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
</style>
