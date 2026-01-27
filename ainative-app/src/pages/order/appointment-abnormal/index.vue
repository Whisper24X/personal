<template>
  <tab-bar-layout
    tab-key="order-appointment-abnormal"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '支付订单', showBack: true }"
    :custom-back="handleCustomBack"
  >
    <Loading v-if="loading" :fullscreen="true" text="加载中..." />

    <view v-else class="appointment-abnormal-page">
      <view class="page-content">
        <!-- 预约异常头 -->
        <view class="abnormal-status-header">
          <image
            class="status-icon"
            src="https://fp.yangcong345.com/middle/1.0.0/icon-appointment-abnormal-5d1b505a88a7fddf8442ae2b1398464d__w.png"
            mode="aspectFit"
          />
          <view class="status-text abnormal">预约异常</view>
        </view>

        <view class="abnormal-desc">
          由于研学活动太过火爆，在您支付完成的瞬间，最后一个名额已被其他用户锁定，导致未能成功为您预约！
        </view>
        <view class="abnormal-hint">
          <text class="highlight">请您不必担心，您的支付我们已经收到！</text>
          <br />由于活动太火爆，很抱歉影响了您的体验，请您截图本页面，点击页面下方【联系客服】按钮联系我们，我们将为您协调增加场次或优先安排后续名额。
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
      </view>

      <!-- 底部操作栏 -->
      <FixedBottomBar>
        <view class="bottom-actions">
          <UiButton
            class="action-btn"
            type="default"
            size="medium"
            round
            shadow
            theme="yellow"
            @click="handleContactService"
          >
            联系客服
          </UiButton>
        </view>
      </FixedBottomBar>

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
    </view>
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
import { getOrderGoodInfo } from "@/api/order"
import { formatAmount } from "@/utils/priceCalculator"
import { centsToYuan } from "@/utils/formatPrice"
import { formatDateCustom } from "@/utils/formatDate"
import { useConfigStore } from "@/store/configStore"
import { trackClick } from "@/utils/analytics"

const router = Taro.useRouter()
const orderId = router.params.orderId as string
const fromPage = router.params.from as string // 来源页面：appointment(预约列表) 或 order(我的订单)

const loading = ref(true)
const orderData = ref<any>(null)
const showContactServiceModal = ref(false)

// 使用全局配置
const configStore = useConfigStore()
const serviceQrCode = computed(() => configStore.defaultServiceQrCodeUrl)

const orderInfo = computed(() => orderData.value?.orderInfo)
const goodInfo = computed(() => orderData.value?.goodInfo)

const discountAmount = computed(() => {
  return centsToYuan(orderData.value?.orderInfo?.discountAmount || 0)
})
const finalPrice = computed(() => {
  return centsToYuan(orderData.value?.orderInfo?.orderPrice || 0)
})

const formatDateTime = (datetime: string) => {
  if (!datetime) return ""
  return formatDateCustom(datetime, "YYYY-MM-DD HH:mm")
}

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

const handleContactService = () => {
  trackClick("contact_customer_service", { source_page: "预约异常页" })
  showContactServiceModal.value = true
}

const handleCustomBack = () => {
  // 根据来源页面决定返回位置
  if (fromPage === "appointment") {
    Taro.switchTab({ url: "/pages/appointment/list/index" })
  } else {
    Taro.redirectTo({ url: "/pages/order/list/index" })
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
.appointment-abnormal-page {
  background: #f7f7f9;
  min-height: 100vh;
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}
.page-content {
  padding: 32rpx;
}
.abnormal-status-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24rpx;
  .status-icon {
    width: 132rpx;
    height: 88rpx;
    margin-bottom: 24rpx;
  }
  .status-text.abnormal {
    font-family: PingFang SC;
    font-size: 40px;
    font-weight: 600;
    line-height: 40px;
    letter-spacing: 0em;
    color: #fa5a65;
  }
}
.abnormal-desc {
  font-family: PingFang SC;
  font-size: 28px;
  line-height: 42px;
  color: #848096;
  margin-bottom: 40rpx;
  text-align: left;
}
.abnormal-hint {
  margin-bottom: 32rpx;
  text-align: left;
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  padding: 24px 32px;
  gap: 16px;
  background: #e4eeff;
  font-family: PingFang SC;
  font-size: 26px;
  line-height: 40px;
  color: #504b64;
  .highlight {
    color: #518aff;
    font-family: PingFang SC;
    font-size: 32px;
    font-weight: 600;
    line-height: 48px;
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
    width: 100%;
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
