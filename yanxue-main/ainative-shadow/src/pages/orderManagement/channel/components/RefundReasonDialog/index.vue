<template>
  <el-dialog title="退款详情" v-model="dialogVisible" width="500px">
    <el-form label-width="100px">
      <el-form-item label="订单编号">
        <el-input v-model="orderNumber" disabled />
      </el-form-item>
      <el-form-item label="商品名称">
        <el-input v-model="goodName" disabled />
      </el-form-item>
      <el-form-item label="退款金额">
        <el-input v-model="refundAmountDisplay" disabled />
      </el-form-item>
      <el-form-item label="退款原因">
        <el-input v-model="refundReason" type="textarea" :rows="4" disabled />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
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

const emit = defineEmits(['update:visible'])

const dialogVisible = ref(props.visible)
const orderNumber = ref('')
const goodName = ref('')
const refundReason = ref('')
const refundAmountDisplay = ref('')

watch(
  () => props.visible,
  (newVal) => {
    dialogVisible.value = newVal
    if (newVal && props.orderData) {
      orderNumber.value = props.orderData.orderNumber
      goodName.value = props.orderData.goodName
      refundReason.value = props.orderData.refundReason || '暂无退款原因'
      // 格式化退款金额（后端返回的是分）
      if (
        props.orderData.refundAmount !== undefined &&
        props.orderData.refundAmount !== null
      ) {
        refundAmountDisplay.value = formatMoney(props.orderData.refundAmount)
      } else {
        refundAmountDisplay.value = '--'
      }
    }
  },
)

watch(
  () => dialogVisible.value,
  (newVal) => {
    emit('update:visible', newVal)
  },
)
</script>

<style scoped></style>
