<template>
  <el-dialog title="订单退款确认" v-model="dialogVisible" width="500px">
    <div class="refund-confirm-content">
      <p>您确定要将以下订单标记为已退款吗？</p>
      <p><strong>渠道订单编号：</strong>{{ form.orderNumber }}</p>
      <p><strong>商品名称：</strong>{{ form.goodName }}</p>
      <p><strong>订单金额：</strong>{{ formatMoney(form.orderPrice) }}</p>
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="danger" @click="handleSubmit" :loading="loading"
        >确认退款</el-button
      >
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, defineProps, defineEmits, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { updateOrderStatus } from '../../service'
import { formatMoney } from '@/utils/money'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  orderData: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:visible', 'success'])

const dialogVisible = ref(props.visible)
const loading = ref(false)

const form = reactive({
  id: '',
  orderNumber: '',
  goodName: '',
  orderPrice: 0,
})

watch(
  () => props.visible,
  (newVal) => {
    dialogVisible.value = newVal
    if (newVal && props.orderData) {
      form.id = props.orderData.id
      form.orderNumber = props.orderData.orderNumber
      form.goodName = props.orderData.goodName
      form.orderPrice = props.orderData.orderPrice
    }
  },
)

watch(
  () => dialogVisible.value,
  (newVal) => {
    emit('update:visible', newVal)
  },
)

const handleSubmit = async () => {
  try {
    loading.value = true

    await updateOrderStatus({
      id: form.id,
      status: 'refunded',
    })

    ElMessage.success('订单已标记为已退款')
    dialogVisible.value = false
    emit('success')
  } catch (error) {
    console.error('退款失败:', error)
    ElMessage.error('退款失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.refund-confirm-content {
  padding: 10px 0;
}

.refund-confirm-content p {
  margin: 10px 0;
  line-height: 1.5;
}
</style>
