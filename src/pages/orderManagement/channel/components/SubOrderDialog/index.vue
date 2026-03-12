<template>
  <el-dialog
    v-model="dialogVisible"
    title="子订单列表"
    width="90%"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div v-loading="loading" class="sub-order-content">
      <!-- 父订单信息 -->
      <div class="parent-order-info">
        <el-descriptions title="父订单信息" :column="3" border>
          <el-descriptions-item label="订单编号">
            {{ orderData?.id || '--' }}
          </el-descriptions-item>
          <el-descriptions-item label="渠道订单编号">
            {{ orderData?.orderNumber || '--' }}
          </el-descriptions-item>
          <el-descriptions-item label="商品名称">
            {{ orderData?.goodName || '--' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 子订单列表 -->
      <div class="sub-order-list">
        <h3>子订单列表（共 {{ subOrderList.length }} 条）</h3>
        <el-table
          :data="subOrderList"
          border
          stripe
          style="width: 100%"
          max-height="600"
        >
          <!-- 1. 渠道订单编号 -->
          <el-table-column
            prop="orderNumber"
            label="渠道订单编号"
            min-width="140"
            align="center"
            fixed="left"
          />

          <!-- 2. 渠道商品ID -->
          <el-table-column
            prop="channelGoodId"
            label="渠道商品ID"
            min-width="120"
            align="center"
          />

          <!-- 3. 商品名称 -->
          <el-table-column label="商品名称" min-width="150" align="center">
            <template #default>
              {{ orderData?.goodName || '--' }}
            </template>
          </el-table-column>

          <!-- 4. 商品类型 -->
          <el-table-column
            prop="goodType"
            label="商品类型"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              {{ getGoodTypeLabel(row.goodType || '') }}
            </template>
          </el-table-column>

          <!-- 5. 购买渠道 -->
          <el-table-column label="购买渠道" min-width="100" align="center">
            <template #default>
              {{ orderData?.channelName || '--' }}
            </template>
          </el-table-column>

          <!-- 6. 实付金额 -->
          <el-table-column
            prop="orderPrice"
            label="实付金额"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              {{ formatMoney(row.orderPrice) }}
            </template>
          </el-table-column>

          <!-- 7. 实收金额 -->
          <el-table-column
            prop="receiptAmount"
            label="实收金额"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              {{ formatMoney(row.receiptAmount) }}
            </template>
          </el-table-column>

          <!-- 8. 平台优惠金额 -->
          <el-table-column
            prop="platformDiscountAmount"
            label="平台优惠金额"
            min-width="120"
            align="center"
          >
            <template #default="{ row }">
              {{ getPlatformDiscountAmountDisplay(row) }}
            </template>
          </el-table-column>

          <!-- 9. 支付优惠金额 -->
          <el-table-column
            prop="paymentDiscountAmount"
            label="支付优惠金额"
            min-width="120"
            align="center"
          >
            <template #default="{ row }">
              {{ getPaymentDiscountAmountDisplay(row) }}
            </template>
          </el-table-column>

          <!-- 10. 店铺优惠金额 -->
          <el-table-column
            prop="shopDiscountAmount"
            label="店铺优惠金额"
            min-width="120"
            align="center"
          >
            <template #default="{ row }">
              {{ getShopDiscountAmountDisplay(row) }}
            </template>
          </el-table-column>

          <!-- 11. 保险费 -->
          <el-table-column
            prop="actualInsured"
            label="保险费"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              {{ getActualInsuredDisplay(row) }}
            </template>
          </el-table-column>

          <!-- 12. 达人佣金 -->
          <el-table-column
            prop="talentCommission"
            label="达人佣金"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              {{ getTalentCommissionDisplay(row) }}
            </template>
          </el-table-column>

          <!-- 13. 达人UID -->
          <el-table-column
            prop="talentUid"
            label="达人UID"
            min-width="120"
            align="center"
          >
            <template #default="{ row }">
              {{ row.talentUid || '--' }}
            </template>
          </el-table-column>

          <!-- 14. 达人名称 -->
          <el-table-column
            prop="talentName"
            label="达人名称"
            min-width="120"
            align="center"
          >
            <template #default="{ row }">
              {{ row.talentName || '--' }}
            </template>
          </el-table-column>

          <!-- 15. 平台手续费 -->
          <el-table-column
            prop="platformFee"
            label="平台手续费"
            min-width="110"
            align="center"
          >
            <template #default="{ row }">
              {{ getPlatformFeeDisplay(row) }}
            </template>
          </el-table-column>

          <!-- 16. 联系方式 -->
          <el-table-column
            prop="phone"
            label="联系方式"
            min-width="120"
            align="center"
          >
            <template #default="{ row }">
              {{ row.phone || '--' }}
            </template>
          </el-table-column>

          <!-- 17. 支付时间 -->
          <el-table-column
            prop="paymentTime"
            label="支付时间"
            min-width="160"
            align="center"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.paymentTime) }}
            </template>
          </el-table-column>

          <!-- 18. 参营时间 -->
          <el-table-column
            prop="campTime"
            label="参营时间"
            min-width="160"
            align="center"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.campTime) }}
            </template>
          </el-table-column>

          <!-- 19. 服务状态 -->
          <el-table-column
            prop="serviceStatus"
            label="服务状态"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.serviceStatus"
                :type="getServiceStatusType(row.serviceStatus)"
              >
                {{ getServiceStatusLabel(row.serviceStatus) }}
              </el-tag>
              <span v-else>--</span>
            </template>
          </el-table-column>

          <!-- 20. 订单状态 -->
          <el-table-column
            prop="status"
            label="订单状态"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>

          <!-- 21. 退款金额 -->
          <el-table-column
            prop="refundAmount"
            label="退款金额"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              {{ getRefundAmountDisplay(row) }}
            </template>
          </el-table-column>

          <!-- 22. 退款时间 -->
          <el-table-column
            prop="refundTime"
            label="退款时间"
            min-width="160"
            align="center"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.refundTime) }}
            </template>
          </el-table-column>

          

          <!-- 23. 创建时间 -->
          <el-table-column
            prop="createdAt"
            label="创建时间"
            min-width="160"
            align="center"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.createdAt) }}
            </template>
          </el-table-column>

          <!-- 24. 更新时间 -->
          <el-table-column
            prop="updatedAt"
            label="更新时间"
            min-width="160"
            align="center"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.updatedAt) }}
            </template>
          </el-table-column>
          <!-- 22.1 结算时间 -->
          <el-table-column
            prop="settlementTime"
            label="结算时间"
            min-width="160"
            align="center"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.settlementTime) }}
            </template>
          </el-table-column>
          <!-- 25. 订单编号 -->
          <el-table-column
            prop="id"
            label="订单编号"
            min-width="120"
            align="center"
          >
            <template #default="{ row }">
              {{ row.id || '--' }}
            </template>
          </el-table-column>

          <!-- 26. 商品ID -->
          <el-table-column
            prop="goodId"
            label="商品ID"
            min-width="120"
            align="center"
          />

          <!-- 27. 最后编辑人 -->
          <el-table-column
            prop="updatedBy"
            label="最后编辑人"
            min-width="120"
            align="center"
          >
            <template #default="{ row }">
              {{ row.updatedBy || '--' }}
            </template>
          </el-table-column>

          <!-- 其他补充字段 -->
          <el-table-column
            prop="parentOrderId"
            label="父订单ID"
            min-width="120"
            align="center"
          />
          <el-table-column
            prop="originOrderNumber"
            label="原始订单编号"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">
              {{ row.originOrderNumber || '--' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="channelId"
            label="渠道ID"
            min-width="120"
            align="center"
          />
          <el-table-column
            prop="paymentDeadline"
            label="支付截止时间"
            min-width="160"
            align="center"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.paymentDeadline) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="userCouponId"
            label="用户优惠券ID"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">
              {{ row.userCouponId || '--' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="parentRemark"
            label="家长备注"
            min-width="150"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.parentRemark || '--' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="payId"
            label="支付订单号"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">
              {{ row.payId || '--' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="refundId"
            label="退款单ID"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">
              {{ row.refundId || '--' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="refundReason"
            label="退款原因"
            min-width="150"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.refundReason || '--' }}
            </template>
          </el-table-column>
          <!-- <el-table-column
            prop="courseAppointmentDraft"
            label="预约草稿"
            min-width="150"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.courseAppointmentDraft || '--' }}
            </template>
          </el-table-column> -->
        </el-table>
      </div>

      <!-- 空状态 -->
      <el-empty
        v-if="!loading && subOrderList.length === 0"
        description="暂无子订单数据"
      />
    </div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getSubOrderList } from '../../service'
import type { OrderItem, SubOrderItem } from '../../service.type'
import {
  getStatusType,
  getStatusLabel,
  getServiceStatusType,
  getServiceStatusLabel,
  getGoodTypeLabel,
} from '../../service.type'
import { formatMoney } from '@/utils/money'
import dayjs from 'dayjs'

interface Props {
  visible: boolean
  orderData?: OrderItem
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  orderData: undefined,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const loading = ref(false)
const subOrderList = ref<SubOrderItem[]>([])

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

/**
 * 格式化日期时间
 */
const formatDateTime = (dateTimeString: string) => {
  if (!dateTimeString) return '--'
  return dayjs(dateTimeString).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * 获取优惠金额显示内容
 */
const getDiscountAmountDisplay = (row: SubOrderItem) => {
  if (
    row.discountAmount !== undefined &&
    row.discountAmount !== null &&
    row.discountAmount > 0
  ) {
    return formatMoney(row.discountAmount)
  }
  return '--'
}

/**
 * 获取平台优惠金额显示内容
 */
const getPlatformDiscountAmountDisplay = (row: SubOrderItem) => {
  if (
    row.platformDiscountAmount !== undefined &&
    row.platformDiscountAmount !== null &&
    row.platformDiscountAmount > 0
  ) {
    return formatMoney(row.platformDiscountAmount)
  }
  return '--'
}

/**
 * 获取支付优惠金额显示内容
 */
const getPaymentDiscountAmountDisplay = (row: SubOrderItem) => {
  if (
    row.paymentDiscountAmount !== undefined &&
    row.paymentDiscountAmount !== null &&
    row.paymentDiscountAmount > 0
  ) {
    return formatMoney(row.paymentDiscountAmount)
  }
  return '--'
}

/**
 * 获取店铺优惠金额显示内容
 */
const getShopDiscountAmountDisplay = (row: SubOrderItem) => {
  if (
    row.shopDiscountAmount !== undefined &&
    row.shopDiscountAmount !== null &&
    row.shopDiscountAmount > 0
  ) {
    return formatMoney(row.shopDiscountAmount)
  }
  return '--'
}

/**
 * 获取保险费显示内容
 */
const getActualInsuredDisplay = (row: SubOrderItem) => {
  if (
    row.actualInsured !== undefined &&
    row.actualInsured !== null &&
    row.actualInsured > 0
  ) {
    return formatMoney(row.actualInsured)
  }
  return '--'
}

/**
 * 获取达人佣金显示内容
 */
const getTalentCommissionDisplay = (row: SubOrderItem) => {
  if (
    row.talentCommission !== undefined &&
    row.talentCommission !== null &&
    row.talentCommission > 0
  ) {
    return formatMoney(row.talentCommission)
  }
  return '--'
}

/**
 * 获取平台手续费显示内容
 */
const getPlatformFeeDisplay = (row: SubOrderItem) => {
  if (
    row.platformFee !== undefined &&
    row.platformFee !== null &&
    row.platformFee > 0
  ) {
    return formatMoney(row.platformFee)
  }
  return '--'
}

/**
 * 获取退款金额显示内容
 */
const getRefundAmountDisplay = (row: SubOrderItem) => {
  if (
    row.refundAmount !== undefined &&
    row.refundAmount !== null &&
    row.refundAmount > 0
  ) {
    return formatMoney(row.refundAmount)
  }
  return '--'
}

/**
 * 加载子订单列表
 */
const loadSubOrders = async () => {
  if (!props.orderData?.id) {
    return
  }

  try {
    loading.value = true
    const res = await getSubOrderList({
      parentOrderId: props.orderData.id,
    })
    subOrderList.value = res.list || []
  } catch (error) {
    console.error('获取子订单列表失败:', error)
    ElMessage.error('获取子订单列表失败')
  } finally {
    loading.value = false
  }
}

/**
 * 关闭对话框
 */
const handleClose = () => {
  dialogVisible.value = false
  subOrderList.value = []
}

// 监听对话框显示状态
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      loadSubOrders()
    }
  },
)
</script>

<style scoped lang="scss">
.sub-order-content {
  min-height: 200px;

  .parent-order-info {
    margin-bottom: 20px;
  }

  .sub-order-list {
    h3 {
      margin-bottom: 15px;
      font-size: 16px;
      color: #303133;
      font-weight: 600;
    }
  }
}
</style>
