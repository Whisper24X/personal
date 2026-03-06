<template>
  <tab-bar-layout
    tab-key="order-pending-appointment"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '订单详情', showBack: true }"
  >
    <Loading v-if="loading" :fullscreen="true" text="加载中..." />

    <view v-else class="pending-appointment-page">
      <view class="page-content">
        <!-- 购买成功状态 -->
        <OrderStatusHeader
          title="购买成功"
          :message="isDepositProduct ? '' : '可点击下方立即预约按钮前往预约'"
          :keyword="isDepositProduct ? '' : '立即预约'"
        />

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
      </view>

      <!-- 底部操作栏 -->
      <FixedBottomBar>
        <view class="bottom-actions">
          <UiButton
            class="contact-btn"
            type="hollow"
            transparent
            round
            theme="white"
            size="medium"
            border-color="black"
            @click="handleContactService"
          >
            联系客服
          </UiButton>
          <UiButton
            v-if="!isDepositProduct"
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

    <!-- 联系客服QR码弹窗 -->
    <UiModal
      v-model:visible="showContactServiceModal"
      title="联系客服"
      :left-button="false"
      :right-button="false"
      :close-icon="true"
    >
      <view class="qr-modal-content">
        <view class="qr-code-container">
          <image
            v-if="serviceQrCode"
            class="qr-code"
            :src="serviceQrCode"
            :show-menu-by-longpress="true"
          />
        </view>
      </view>
    </UiModal>
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import Taro from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import Loading from "@/components/Loading/index.vue"
import FixedBottomBar from "@/components/FixedBottomBar.vue"
import UiButton from "@/components/Ui/button/index.vue"
import UiModal from "@/components/Ui/modal/index.vue"
import InfoCard from "@/components/InfoCard/index.vue"
import InfoRow from "@/components/InfoRow/index.vue"
import GoodInfo from "@/pages/order/components/GoodInfo.vue"
import OrderStatusHeader from "@/pages/order/components/OrderStatusHeader.vue"
import { getOrderGoodInfo } from "@/api/order"
import { formatAmount } from "@/utils/priceCalculator"
import { centsToYuan } from "@/utils/formatPrice"
import { formatDateCustom } from "@/utils/formatDate"
import { useConfigStore } from "@/store/configStore"
import { trackClick } from "@/utils/analytics"

const router = Taro.useRouter()
const orderId = router.params.orderId as string
const fromPage = router.params.from as string // 来源页面: appointment(预约列表) 或 order(我的订单)

const loading = ref(true)
const orderData = ref<any>(null) // 接口返回的完整数据 { orderInfo, goodInfo, channelInfo }
const showContactServiceModal = ref(false)

// 使用全局配置
const configStore = useConfigStore()
const serviceQrCode = computed(() => configStore.defaultServiceQrCodeUrl)

// 兼容性访问
const orderInfo = computed(() => orderData.value?.orderInfo)
const goodInfo = computed(() => orderData.value?.goodInfo)

const isDepositProduct = computed(() => goodInfo.value?.goodType === "deposit")

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

// 联系客服
const handleContactService = () => {
  trackClick("contact_customer_service", { source_page: "待预约页" })
  showContactServiceModal.value = true
}

// 立即预约
const handleBookNow = () => {
  if (orderId) {
    Taro.navigateTo({
      url: `/pages/appointment/index/index?id=${orderId}&from=${fromPage || "order"}`
    })
  } else {
    Taro.showToast({ title: "订单信息异常", icon: "none" })
  }
}

onMounted(async () => {
  // 确保配置已加载
  if (!configStore.defaultServiceQrCodeUrl) {
    await configStore.fetchDefaultServiceQrCode()
  }
  fetchOrderInfo()
})
</script>

<style lang="less">
.pending-appointment-page {
  background: #f7f7f9;
  min-height: 100vh;
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.page-content {
  padding: 32rpx;
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

  .contact-btn {
    width: 208rpx;
    height: 88rpx;
  }

  .action-btn {
    width: 208rpx;
    height: 88rpx;
  }
}

.qr-modal-content {
  padding: 40rpx 0;
  text-align: center;

  .qr-code-container {
    display: flex;
    justify-content: center;

    .qr-code {
      width: 400rpx;
      height: 400rpx;
      border-radius: 16rpx;
      box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
    }
  }
}
</style>
