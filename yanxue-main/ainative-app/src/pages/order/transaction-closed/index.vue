<template>
  <tab-bar-layout
    tab-key="order-transaction-closed"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '交易关闭', showBack: true }"
  >
    <Loading v-if="loading" :fullscreen="true" text="加载中..." />

    <view v-else class="transaction-closed-page">
      <view class="page-content">
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
          <InfoRow label="创建时间">{{ formatDateTime(orderInfo?.createdAt) }}</InfoRow>
          <InfoRow label="商品总价">¥{{ formatAmount(originalPrice) }}</InfoRow>
          <InfoRow label="订单备注">
            <view class="order-remark">{{ orderRemark || "无" }}</view>
          </InfoRow>
        </InfoCard>
      </view>

      <!-- 底部操作栏 -->
      <FixedBottomBar>
        <view class="bottom-actions">
          <UiButton
            class="order-again-btn"
            type="default"
            size="medium"
            round
            shadow
            theme="yellow"
            :disabled="submitting"
            @click="handleOrderAgain"
          >
            再来一单
          </UiButton>
        </view>
      </FixedBottomBar>
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
import InfoCard from "@/components/InfoCard/index.vue"
import InfoRow from "@/components/InfoRow/index.vue"
import GoodInfo from "@/pages/order/components/GoodInfo.vue"
import { getOrderGoodInfo } from "@/api/order"
import { formatDateCustom } from "@/utils/formatDate"
import { formatAmount } from "@/utils/priceCalculator"
import { centsToYuan } from "@/utils/formatPrice"

const router = Taro.useRouter()
const orderId = router.params.orderId as string

const loading = ref(true)
const submitting = ref(false)
const orderData = ref<any>(null) // 接口返回的完整数据 { orderInfo, goodInfo, channelInfo }

// 兼容性访问
const orderInfo = computed(() => orderData.value?.orderInfo)
const goodInfo = computed(() => orderData.value?.goodInfo)

// 商品原价
const originalPrice = computed(() => {
  return centsToYuan(orderData.value?.goodInfo?.price || 0)
})

// 订单备注
const orderRemark = computed(() => {
  return orderData.value?.orderInfo?.parentRemark || ""
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

// 再来一单
const handleOrderAgain = async () => {
  try {
    submitting.value = true

    // 重新获取订单信息,确保商品状态是最新的
    const data = await getOrderGoodInfo(orderId)

    if (!data?.goodInfo?.id) {
      Taro.showToast({ title: "商品信息异常", icon: "none" })
      return
    }

    // 检查商品是否已上架
    if (data.goodInfo.status !== "putOn") {
      Taro.showToast({ title: "该商品已下架", icon: "none" })
      return
    }

    // 跳转到商品详情页
    Taro.navigateTo({
      url: `/pages/product/detail/index?id=${data.goodInfo.id}&type=product`
    })
  } catch (e) {
    console.error("获取商品信息失败", e)
    Taro.showToast({ title: "获取商品信息失败", icon: "none" })
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchOrderInfo()
})
</script>

<style lang="less">
.transaction-closed-page {
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

// 订单价格信息样式
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

.bottom-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 24rpx;
  padding: 24rpx 32rpx 24rpx 32rpx;

  .order-again-btn {
    width: 208rpx;
    height: 88rpx;
  }
}
</style>
