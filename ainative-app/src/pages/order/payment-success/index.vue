<template>
  <tab-bar-layout
    tab-key="order-payment-success"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '支付订单', showBack: true }"
    :custom-back="handleCustomBack"
  >
    <Loading v-if="loading" :fullscreen="true" text="加载中..." />

    <view v-else class="payment-success-page">
      <view class="page-content">
        <!-- 支付成功状态 -->
        <view class="payment-status">
          <image
            class="status-icon"
            src="https://fp.yangcong345.com/middle/1.0.0/icon-pay-success-89ea68d5a89e3d25320276c12073c5b2__w.png"
            mode="aspectFit"
          />
          <view class="status-text">支付成功</view>
          <view class="status-message">感谢您的购买，订单已处理完成</view>
        </view>

        <!-- 商品信息 -->
        <GoodInfo :good-info="goodInfo" />

        <!-- 订单详情 -->
        <InfoCard>
          <InfoRow label="订单编号">
            <view class="order-number-row">
              <text class="number">{{ orderInfo?.orderNumber }}</text>
              <text class="copy-btn" @tap="copyOrderNumber">复制</text>
            </view>
          </InfoRow>
          <InfoRow label="支付时间">{{
            formatDateTime(orderInfo?.paymentTime || orderInfo?.createdAt)
          }}</InfoRow>
          <InfoRow label="优惠券">
            <text v-if="discountAmount > 0" class="coupon-discount"
              >-¥{{ formatAmount(discountAmount) }}</text
            >
            <text v-else>无</text>
          </InfoRow>
          <InfoRow label="支付金额">
            <text class="payment-amount">¥{{ formatAmount(finalPrice) }}</text>
          </InfoRow>
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

        <!-- 群聊二维码 -->
        <GroupQrCode v-if="hasAppointmentInfo" :qr-code="groupChatQrCode" />

        <!-- 联系客服按钮 -->
        <view class="contact-service-section">
          <UiButton
            class="contact-service-btn"
            type="hollow"
            size="medium"
            round
            theme="yellow"
            border-color="black"
            @click="handleContactService"
          >
            联系客服
          </UiButton>
        </view>
      </view>

      <!-- 底部操作栏 -->
      <FixedBottomBar>
        <view class="bottom-actions">
          <UiButton
            class="action-btn"
            type="hollow"
            size="medium"
            round
            theme="white"
            border-color="black"
            @click="handleReturnHome"
          >
            返回首页
          </UiButton>
          <UiButton
            class="action-btn"
            type="hollow"
            size="medium"
            round
            theme="white"
            border-color="black"
            @click="handleViewOrder"
          >
            查看订单
          </UiButton>
          <UiButton
            v-if="!isAppointed"
            class="action-btn"
            type="default"
            size="medium"
            round
            shadow
            theme="yellow"
            @click="handleBookNow"
          >
            立即预约
          </UiButton>
        </view>
      </FixedBottomBar>
    </view>

    <!-- 客服弹框 -->
    <CustomerServiceModal v-model="showCustomerServiceModal" />
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import Taro from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import Loading from "@/components/Loading/index.vue"
import FixedBottomBar from "@/components/FixedBottomBar.vue"
import UiButton from "@/components/Ui/button/index.vue"
import InfoCard from "@/components/InfoCard/index.vue"
import InfoRow from "@/components/InfoRow/index.vue"
import GoodInfo from "@/pages/order/components/GoodInfo.vue"
import GroupQrCode from "@/components/GroupQrCode/index.vue"
import CustomerServiceModal from "@/components/CustomerServiceModal/index.vue"
import { getOrderGoodInfo } from "@/api/order"
import { getGroupQrCodeByAppointmentId } from "@/api/course"
import { formatAmount } from "@/utils/priceCalculator"
import { centsToYuan } from "@/utils/formatPrice"
import { formatDateCustom } from "@/utils/formatDate"
import { track } from "@/utils/analytics"

const router = Taro.useRouter()
const orderId = router.params.orderId as string
const appointmentId = router.params.appointmentId as string

const loading = ref(true)
const orderData = ref<any>(null) // 接口返回的完整数据 { orderInfo, goodInfo, channelInfo }
const groupChatQrCode = ref<string>("") // 群聊二维码
const showCustomerServiceModal = ref(false) // 客服弹框

// 自定义返回按钮行为
const handleCustomBack = () => {
  // 点击返回时跳转到订单列表页面
  Taro.redirectTo({
    url: "/pages/order/list/index"
  })
}

// 兼容性访问
const orderInfo = computed(() => orderData.value?.orderInfo)
const goodInfo = computed(() => orderData.value?.goodInfo)

// 计算属性
// 判断是否已预约（通过 courseAppointmentDraft 判断）
const isAppointed = computed(() => {
  return !!orderData.value?.courseAppointmentDraft && orderData.value?.courseAppointmentDraft?.date
})

const hasAppointmentInfo = computed(() => {
  // 预约信息从 courseAppointmentDraft 中获取
  return orderInfo.value?.date
})

const hasStudentInfo = computed(() => {
  return orderInfo.value?.studentName
})

const hasGuardianInfo = computed(() => {
  return orderInfo.value?.parentName || orderInfo.value?.parentPhone
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

// 优惠券折扣金额(单位:分,需要转换为元)
const discountAmount = computed(() => {
  return centsToYuan(orderData.value?.orderInfo?.discountAmount || 0)
})

// 最终应付价格
const finalPrice = computed(() => {
  return centsToYuan(orderData.value?.orderInfo?.orderPrice || 0)
})

// 格式化日期时间
const formatDateTime = (datetime: string) => {
  if (!datetime) return ""
  return formatDateCustom(datetime, "YYYY-MM-DD HH:mm")
}

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

      // 获取群聊二维码（仅当有预约ID时）
      if (appointmentId) {
        try {
          const qrCodeData = await getGroupQrCodeByAppointmentId(appointmentId)
          if (qrCodeData?.groupQrCode) {
            groupChatQrCode.value = qrCodeData.groupQrCode
          }
        } catch (error) {
          console.error("获取群聊二维码失败:", error)
        }
      }
      track(draft.date ? "booking_pay_success" : "no_booking_pay_success", {
        product_id: orderData.value.orderInfo.goodId,
        product_name: orderData.value.orderInfo.goodName,
        order_identity_document: orderData.value.orderInfo.id
      })
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

// 查看订单
const handleViewOrder = () => {
  if (!orderId) {
    Taro.showToast({ title: "订单信息异常", icon: "none" })
    return
  }

  // 根据是否已预约跳转到不同页面（通过 courseAppointmentDraft 判断）
  if (isAppointed.value) {
    // 已预约，跳转到订单详情-已预约页
    Taro.navigateTo({
      url: `/pages/order/appointed/index?orderId=${orderId}&from=order`
    })
  } else {
    // 未预约，跳转到订单详情-待预约页
    Taro.navigateTo({
      url: `/pages/order/pending-appointment/index?orderId=${orderId}&from=order`
    })
  }
}

// 返回首页
const handleReturnHome = () => {
  Taro.switchTab({
    url: "/pages/recommend/index/index"
  })
}

// 立即预约
const handleBookNow = () => {
  if (orderId) {
    Taro.navigateTo({
      url: `/pages/appointment/index/index?id=${orderId}&from=order`
    })
  } else {
    Taro.showToast({ title: "订单信息异常", icon: "none" })
  }
}

// 联系客服
const handleContactService = () => {
  showCustomerServiceModal.value = true
}

onMounted(() => {
  fetchOrderInfo()
})
</script>

<style lang="less">
.payment-success-page {
  background: #f7f7f9;
  min-height: 100vh;
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.page-content {
  padding: 32rpx;
}

.payment-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 50rpx;

  .status-icon {
    width: 80rpx;
    height: 80rpx;
    margin-bottom: 24rpx;
  }

  .status-text {
    font-family: PingFang SC;
    font-size: 40px;
    font-weight: 600;
    line-height: 40px;
    color: #3d3d3d;
    margin-bottom: 24rpx;
  }

  .status-message {
    font-family: PingFang SC;
    font-size: 28px;
    font-weight: normal;
    line-height: 28px;
    color: #3d3d3d;
  }
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

.coupon-discount {
  color: #fa5a66;
  font-weight: 600;
}

.payment-amount {
  color: #fa5a65;
  font-weight: 600;
}

.bottom-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 24rpx;
  padding: 24rpx 32rpx 24rpx 32rpx;

  .action-btn {
    width: 208rpx;
    height: 88rpx;
  }
}

.contact-service-section {
  margin-top: 32rpx;
  display: flex;
  justify-content: flex-end;

  .contact-service-btn {
    width: 200rpx;
    height: 80rpx;
  }
}
</style>
