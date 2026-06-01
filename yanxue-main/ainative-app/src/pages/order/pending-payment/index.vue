<template>
  <tab-bar-layout
    tab-key="order-pending-payment"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '继续付款', showBack: true }"
  >
    <Loading v-if="loading" :fullscreen="true" text="加载中..." />

    <view v-else class="pending-payment-page">
      <view class="page-content">
        <!-- 等待付款状态 -->
        <view class="payment-status">
          <image
            class="status-icon"
            src="https://fp.yangcong345.com/middle/1.0.0/icon-time-f3be16e44dbe221619be959097a06873__w.png"
            mode="aspectFit"
          />
          <view class="status-text">等待付款</view>
        </view>
        <view class="countdown-tip"
          >请于<text class="countdown-text">{{ countdownText }}</text
          >内付款，超时订单将自动关闭</view
        >

        <!-- 商品信息 -->
        <GoodInfo :good-info="goodInfo" />

        <!-- 订单价格信息 -->
        <InfoCard>
          <InfoRow label="商品总价">¥{{ formatAmount(originalPrice) }}</InfoRow>
          <InfoRow label="优惠券">
            <view v-if="discountAmount > 0" class="coupon-discount">
              -¥{{ formatAmount(discountAmount) }}
            </view>
            <view v-else class="coupon-no-available">暂无可用</view>
          </InfoRow>
          <InfoRow v-if="orderRemark" label="订单备注">
            <view class="order-remark">{{ orderRemark }}</view>
          </InfoRow>
        </InfoCard>

        <!-- 订单详情 -->
        <InfoCard>
          <InfoRow label="订单编号">
            <view class="order-number-row">
              <text class="number">{{ orderInfo?.orderNumber }}</text>
              <text class="copy-btn" @tap="copyOrderNumber">复制</text>
            </view>
          </InfoRow>
          <InfoRow label="创建时间">{{ formatDateTime(orderInfo?.createdAt) }}</InfoRow>
        </InfoCard>

        <!-- 预约信息 -->
        <InfoCard v-if="hasAppointmentInfo" title="预约信息">
          <InfoRow v-if="selectedCourseName" label="预约课程">{{ selectedCourseName }}</InfoRow>
          <InfoRow label="预约时间">{{ appointmentTime }}</InfoRow>
        </InfoCard>

        <!-- 营员信息 -->
        <InfoCard v-if="hasStudentInfo" title="营员信息">
          <InfoRow label="姓名">{{ orderInfo?.studentName }}</InfoRow>
        </InfoCard>

        <!-- 监护人信息 -->
        <InfoCard v-if="hasGuardianInfo" title="监护人信息">
          <InfoRow label="姓名">{{ orderInfo?.parentName }}</InfoRow>
          <InfoRow label="手机号">{{ orderInfo?.parentPhone }}</InfoRow>
        </InfoCard>
      </view>

      <!-- 底部操作栏 -->
      <FixedBottomBar>
        <view class="button-group">
          <view class="amount-section">
            <text class="amount-label">应付:</text>
            <text class="amount-value"
              ><text class="symbol">¥</text>{{ formatAmount(finalPrice) }}</text
            >
          </view>
          <view class="action-buttons">
            <view class="cancel-button" @tap="handleCancelOrder">取消订单</view>
            <OIButton
              class="pay-button"
              type="default"
              size="medium"
              round
              shadow
              theme="yellow"
              :disabled="submitting"
              @click="handlePay"
            >
              去支付
            </OIButton>
          </view>
        </view>
      </FixedBottomBar>
    </view>

    <!-- 取消订单确认弹窗 -->
    <OIModal
      v-model:visible="cancelModalVisible"
      title="确定取消订单吗？"
      content="取消后订单将无法恢复，请谨慎操作"
      left-button-text="继续支付"
      right-button-text="确定取消"
      @left-button-click="cancelModalVisible = false"
      @right-button-click="handleConfirmCancel"
    />
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from "vue"
import Taro from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import Loading from "@/components/Loading/index.vue"
import FixedBottomBar from "@/components/FixedBottomBar.vue"
import OIButton from "@/components/Ui/button/index.vue"
import OIModal from "@/components/Ui/modal/index.vue"
import InfoCard from "@/components/InfoCard/index.vue"
import InfoRow from "@/components/InfoRow/index.vue"
import GoodInfo from "@/pages/order/components/GoodInfo.vue"
import { getOrderGoodInfo, updateOrderStatus } from "@/api/order"
import { getCourseStockSelector } from "@/api/course"
import { payOrder, handlePaymentResult } from "@/services/paymentService"
import { formatAmount, add, isEqual } from "@/utils/priceCalculator"
import { centsToYuan } from "@/utils/formatPrice"
import { formatDateCustom } from "@/utils/formatDate"
import { track } from "@/utils/analytics"

const router = Taro.useRouter()
const orderId = router.params.orderId as string

const loading = ref(true)
const submitting = ref(false)
const cancelModalVisible = ref(false)
const orderData = ref<any>(null) // 接口返回的完整数据 { orderInfo, goodInfo, channelInfo }
const countdown = ref(0) // 倒计时秒数
let countdownTimer: ReturnType<typeof setInterval> | null = null

// 兼容性访问
const orderInfo = computed(() => orderData.value?.orderInfo)
const goodInfo = computed(() => orderData.value?.goodInfo)

// 计算属性
const countdownText = computed(() => {
  const hours = Math.floor(countdown.value / 3600)
  const minutes = Math.floor((countdown.value % 3600) / 60)
  const seconds = countdown.value % 60

  if (hours > 0) {
    return `${hours}小时${minutes}分钟${seconds}秒`
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`
  } else {
    return `${seconds}秒`
  }
})

const hasAppointmentInfo = computed(() => {
  // 预约信息从 courseAppointmentDraft 中获取
  return orderInfo.value?.date
})

const hasStudentInfo = computed(() => {
  // 营员信息可能在订单的扩展字段中，暂时保留兼容逻辑
  return orderInfo.value?.studentName
})

const hasGuardianInfo = computed(() => {
  // 监护人信息从 orderInfo.phone 获取
  return orderInfo.value?.parentName && orderInfo.value?.parentPhone
})

const appointmentTime = computed(() => {
  // 从 courseAppointmentDraft 获取，只使用 date 和 period
  if (orderInfo.value?.date) {
    return `${orderInfo.value.date} ${orderInfo.value.period || ""}`
  }
  return ""
})

// 获取选中的课程名称
const selectedCourseName = computed(() => {
  const draft = orderData.value?.courseAppointmentDraft
  if (!draft?.courseId || !goodInfo.value?.content?.goodCategories?.[0]?.courses) {
    return ""
  }

  const course = goodInfo.value.content.goodCategories[0].courses.find(
    (c: any) => c.courseId === draft.courseId
  )
  return course?.courseName || ""
})

// 商品原价
const originalPrice = computed(() => {
  return centsToYuan(orderData.value?.goodInfo?.price || 0)
})

// 优惠券折扣金额(单位:分,需要转换为元)
const discountAmount = computed(() => {
  return centsToYuan(orderData.value?.orderInfo?.discountAmount || 0)
})

// 最终应付价格
const finalPrice = computed(() => {
  return centsToYuan(orderData.value?.orderInfo?.orderPrice || 0)
})

// 订单备注
const orderRemark = computed(() => {
  return orderData.value?.orderInfo?.parentRemark || ""
})

// 获取订单信息
const fetchOrderInfo = async () => {
  try {
    const data = await getOrderGoodInfo(orderId)

    if (data) {
      orderData.value = data

      // 从预约草稿中获取预约信息（这些字段不存在于 orderInfo 中）
      const draft = data.courseAppointmentDraft
      if (draft && draft?.date) {
        // 将预约草稿信息合并到 orderInfo 中用于显示
        if (!orderData.value.orderInfo) {
          orderData.value.orderInfo = {}
        }
        orderData.value.orderInfo.studentName = draft.studentName
        orderData.value.orderInfo.parentName = draft.parentName
        orderData.value.orderInfo.parentPhone = draft.parentPhone
        orderData.value.orderInfo.date = draft.date
        orderData.value.orderInfo.period = draft.period
      }
      track(draft.date ? "enter_booking_pending_payment" : "enter_no_booking_pending_payment", {
        product_id: orderData.value.orderInfo.goodId,
        product_name: orderData.value.orderInfo.goodName,
        order_identity_document: orderData.value.orderInfo.id
      })

      // 设置倒计时
      if (data.orderInfo?.paymentDeadline) {
        // 使用订单的支付截止时间
        const expireTime = new Date(data.orderInfo.paymentDeadline)
        const now = new Date()
        const remainingSeconds = Math.max(
          0,
          Math.floor((expireTime.getTime() - now.getTime()) / 1000)
        )
        countdown.value = remainingSeconds
      } else if (data.orderInfo?.createdAt) {
        // 兜底：假设订单创建后24小时内有效
        const createdAt = new Date(data.orderInfo.createdAt)
        const expireTime = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000)
        const now = new Date()
        const remainingSeconds = Math.max(
          0,
          Math.floor((expireTime.getTime() - now.getTime()) / 1000)
        )
        countdown.value = remainingSeconds
      }

      startCountdown()
    } else {
      throw new Error("返回数据格式不正确")
    }
  } catch (e) {
    console.error("获取订单信息失败", e)
    Taro.showToast({ title: "获取订单信息失败", icon: "none" })
  } finally {
    loading.value = false
  }
}

// 开始倒计时
const startCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }

  countdownTimer = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
    } else {
      // 倒计时结束，订单自动关闭
      clearInterval(countdownTimer!)
      countdownTimer = null
      handleOrderExpired()
    }
  }, 1000)
}

// 订单过期处理：先取消订单，再跳转交易关闭页
const handleOrderExpired = async () => {
  try {
    await updateOrderStatus({ orderId, status: "closed" })
  } catch (e) {
    console.error("订单过期更新状态失败", e)
  } finally {
    Taro.redirectTo({
      url: `/pages/order/transaction-closed/index?orderId=${orderId}`
    })
  }
}

// 复制订单号
const copyOrderNumber = () => {
  if (orderInfo.value?.orderNumber) {
    Taro.setClipboardData({
      data: orderInfo.value.orderNumber,
      success: () => {
        Taro.showToast({ title: "已复制到剪贴板", icon: "success" })
      }
    })
  }
}

// 取消订单
const handleCancelOrder = () => {
  cancelModalVisible.value = true
}

// 确认取消订单
const handleConfirmCancel = async () => {
  try {
    submitting.value = true
    // 调用取消订单API
    await updateOrderStatus({ orderId, status: "closed" })
    // 跳转到交易关闭页面
    Taro.redirectTo({
      url: `/pages/order/transaction-closed/index?orderId=${orderId}`
    })
  } catch (e: any) {
    console.error("取消订单失败", e)
    Taro.showToast({ title: e.message || "取消订单失败，请重试", icon: "none" })
  } finally {
    submitting.value = false
    cancelModalVisible.value = false
  }
}

// 去支付
const handlePay = async () => {
  if (submitting.value) return

  try {
    submitting.value = true
    // 支付前校验：商品是否上架、课程库存、订单金额是否一致
    const isValid = await validateOrderBeforePay()
    if (!isValid) {
      // 校验失败，已在校验函数中处理后续（关闭订单并跳转）
      submitting.value = false
      return
    }
    const result = await payOrder(orderId)
    await handlePaymentResult(result, orderId)
    // 支付成功后不重置 submitting，保持按钮禁用状态直到页面跳转
  } catch (e: any) {
    console.error("支付失败", e)
    Taro.showToast({ title: e.message || "支付失败，请重试", icon: "none", mask: true })
    submitting.value = false
  }
}

// 格式化日期时间
const formatDateTime = (datetime: string) => {
  if (!datetime) return ""
  return formatDateCustom(datetime, "YYYY-MM-DD HH:mm")
}

onMounted(() => {
  fetchOrderInfo()
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})

// 支付前校验
const validateOrderBeforePay = async (): Promise<boolean> => {
  try {
    const latest = await getOrderGoodInfo(orderId)
    if (!latest) return await handleInvalidAndClose()

    // 1) 商品是否上架（依据接口：status: putOff/putOn/pending/delete）
    const good = latest.goodInfo || {}
    const isOnShelf = good.status === "putOn"
    if (!isOnShelf) {
      return await handleInvalidAndClose()
    }

    // 2) 关联课程是否有库存（通过课程库存接口）
    const draft = latest.courseAppointmentDraft
    if (draft && draft.courseId && draft.date) {
      try {
        const goodType =
          (latest.goodInfo as any)?.goodType ||
          (latest.orderInfo as any)?.goodType ||
          draft.courseType
        const isMultiCamp = goodType === "multi"

        if (!isMultiCamp) {
          if (!draft.period) return await handleInvalidAndClose()
          const resp = await getCourseStockSelector({
            courseId: draft.courseId,
            startDate: draft.date,
            endDate: draft.date
          })
          const items = resp?.items || []
          const target = items.find(
            (it: any) => it.date === draft.date && it.period === draft.period
          )
          if (!target) return await handleInvalidAndClose()
          const remain = typeof target.stockRemain === "number" ? target.stockRemain : target.stock
          if (!(typeof remain === "number" && remain > 0)) return await handleInvalidAndClose()
        } else {
          const dateStr = String(draft.date)
          if (!dateStr.includes("到")) return await handleInvalidAndClose()
          const [startRaw, endRaw] = dateStr.split("到")
          const startDate = String(startRaw || "").trim()
          const endDate = String(endRaw || startRaw || "").trim()
          if (!startDate || !endDate) return await handleInvalidAndClose()
          const resp = await getCourseStockSelector({
            courseId: draft.courseId,
            startDate,
            endDate
          })
          const items = resp?.items || []
          const anyAvailable = items.some((it: any) => {
            const remain = typeof it.stockRemain === "number" ? it.stockRemain : it.stock
            return typeof remain === "number" && remain > 0
          })
          if (!anyAvailable) return await handleInvalidAndClose()
        }
      } catch {
        return await handleInvalidAndClose()
      }
    }

    // 3) 订单金额+优惠金额是否与商品原价一致（使用金额工具方法）
    const latestPrice = latest.goodInfo?.price
    const currentOrderPay = orderData.value?.orderInfo?.orderPrice
    const currentDiscount = orderData.value?.orderInfo?.discountAmount || 0
    if (
      typeof latestPrice === "number" &&
      typeof currentOrderPay === "number" &&
      typeof currentDiscount === "number"
    ) {
      if (!isEqual(latestPrice, add(currentOrderPay, currentDiscount))) {
        return await handleInvalidAndClose()
      }
    }

    return true
  } catch {
    // 接口异常也视为校验失败，避免错误支付
    return await handleInvalidAndClose()
  }
}

const handleInvalidAndClose = async (): Promise<boolean> => {
  try {
    await updateOrderStatus({ orderId, status: "closed" })
  } catch (e) {
    // 即使更新失败，也不中断用户流转
    console.error("更新订单为交易关闭失败", e)
  }
  Taro.showToast({
    title: "商品信息已变更，请重新下单",
    icon: "none",
    duration: 2000,
    complete: () => {
      setTimeout(
        () => Taro.redirectTo({ url: `/pages/order/transaction-closed/index?orderId=${orderId}` }),
        1800
      )
    }
  })

  return false
}
</script>

<style lang="less">
.pending-payment-page {
  background: #f7f7f9;
  min-height: 100vh;
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.page-content {
  padding: 32rpx;
}

// 等待付款状态
.payment-status {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32rpx;

  .status-icon {
    width: 48rpx;
    height: 48rpx;
    margin-right: 24rpx;
  }

  .status-text {
    font-family: PingFang SC;
    font-size: 36px;
    font-weight: 600;
    line-height: 36px;
    color: #fa5a65;
  }
}

.countdown-tip {
  text-align: center;
  font-family: PingFang SC;
  font-size: 28px;
  font-weight: normal;
  line-height: 28px;
  color: #393548;
  margin-bottom: 44rpx;
  line-height: 1.5;
  .countdown-text {
    color: #fa5a65;
  }
}

// 订单信息样式
.coupon-discount {
  color: #fa5a66;
  font-weight: 600;
}

.coupon-no-available {
  color: #999;
}

.order-remark {
  color: #393548;
  word-break: break-all;
  text-align: right;
}

.order-number-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
  .number {
    max-width: 350rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .copy-btn {
    font-family: PingFang SC;
    font-size: 28px;
    color: #848096;
  }
}

// 底部操作栏
.button-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx 24rpx 32rpx;

  .amount-section {
    display: flex;
    align-items: baseline;

    .amount-label {
      font-family: PingFang SC;
      font-weight: 400;
      font-size: 28px;
      margin-right: 8rpx;
    }

    .amount-value {
      font-family: AlibabaPuHuiTi_2_105_Heavy;
      font-size: 48px;
      color: #fa5a65;
      .symbol {
        font-size: 28rpx;
      }
    }
  }

  .action-buttons {
    display: flex;
    gap: 24rpx;

    .cancel-button {
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-family: PingFang SC;
      font-size: 32px;
      font-weight: normal;
      line-height: 32px;
      color: #848096;
    }

    .pay-button {
      min-width: 140rpx;
      height: 88rpx;
      line-height: 72rpx;
      padding: 26rpx 63rpx;
    }
  }
}
</style>
