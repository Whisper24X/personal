<template>
  <tab-bar-layout
    tab-key="order-confirm-no-appointment"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '确认订单' }"
  >
    <Loading v-if="loading" :fullscreen="true" text="加载中..." />

    <view
      v-else
      class="order-confirm-content"
      :style="{
        height: `calc(100vh - ${getNavBarHeight()}rpx - 124rpx - env(safe-area-inset-bottom))`
      }"
    >
      <!-- 商品信息 -->
      <GoodInfo :good-info="goodInfo" />

      <InfoCard>
        <InfoRow label="商品总价">¥{{ totalPrice }}</InfoRow>
        <InfoRow label="优惠券">
          <view class="coupon-select" @tap="handleSelectCoupon">
            <view v-if="selectedCoupon" class="coupon-text">
              <text class="coupon-discount">-¥{{ selectedCoupon.discountAmount }}</text>
              <image
                class="arrow-icon"
                src="https://fp.yangcong345.com/middle/1.0.0/icon-right-a55af357bef0a85b0618e541ae4e35a5__w.png"
                mode="aspectFit"
              />
            </view>
            <view v-else class="coupon-text-disabled">
              <text>暂无可用</text>
            </view>
          </view>
        </InfoRow>
        <InfoRow label="订单备注">
          <view class="remark" @tap="remarkSheetVisible = true">
            <text>{{ remark || "备注信息（200字以内）" }}</text>
          </view>
        </InfoRow>
      </InfoCard>

      <!-- 协议勾选 -->
      <AgreementCheckbox
        v-model:checked="agreementChecked"
        prefix="我已阅读并同意"
        :agreements="agreements"
      />

      <view class="button-group">
        <OIButton
          class="submit-btn"
          type="default"
          size="huge"
          round
          shadow
          theme="yellow"
          :disabled="submitting || !agreementChecked"
          @click="handleSubmit"
        >
          立即支付¥{{ finalPrice }}
        </OIButton>
      </view>
    </view>

    <OISheet
      :show="remarkSheetVisible"
      title="备注"
      :safe-area="true"
      @click-close="remarkSheetVisible = false"
    >
      <view class="remark-sheet__container">
        <textarea v-model="remark" placeholder="备注" maxlength="200" class="remark-textarea" />
        <view class="remark-count">{{ remark.length }}/200</view>
      </view>
      <view class="remark-actions">
        <OIButton
          class="btn"
          type="default"
          size="huge"
          round
          shadow
          theme="yellow"
          @click="remarkSheetVisible = false"
        >
          保存
        </OIButton>
      </view>
    </OISheet>
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import Taro, { useRouter } from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import Loading from "@/components/Loading/index.vue"
import OIButton from "@/components/Ui/button/index.vue"
import OISheet from "@/components/Ui/sheet/index.vue"
import GoodInfo from "@/pages/order/components/GoodInfo.vue"
import InfoCard from "@/components/InfoCard/index.vue"
import InfoRow from "@/components/InfoRow/index.vue"
import AgreementCheckbox from "@/components/AgreementCheckbox/index.vue"
import { getNavBarHeight } from "@/utils/statusBar"
import { getGoodInfo } from "@/api/good"
import { createMiniProgramOrder } from "@/api/order"
import { getMyCouponList } from "@/pages/coupon/service"
import type { CouponInfo } from "@/pages/coupon/service"
import { payOrder, handlePaymentResult } from "@/services/paymentService"
import { calculateDiscountedPrice } from "@/utils/priceCalculator"
import { centsToYuan } from "@/utils/formatPrice"
import { track, trackClick } from "@/utils/analytics"
const router = useRouter()
const goodId = router.params.goodId as string

const loading = ref(true)
const submitting = ref(false)
const remarkSheetVisible = ref(false)
const remark = ref("")
const agreementChecked = ref(false)

const goodInfo = ref<any>(null)
const availableCoupons = ref<CouponInfo[]>([])
const selectedCoupon = ref<CouponInfo | null>(null)

// 协议列表
const agreements = computed(() => {
  // 优先使用后台返回的协议信息
  if (goodInfo.value?.purchaseAgreementLink) {
    return [
      {
        name: goodInfo.value.purchaseAgreementName || "《洋葱星球研学基地小程序付费协议》",
        url: goodInfo.value.purchaseAgreementLink
      }
    ]
  }
  // 如果后台没有返回,使用默认协议
  return [
    {
      name: "《洋葱星球研学基地小程序付费协议》",
      url: "https://7to12.yangcong345.com/onion-learning/user-setting/agreementGeneralPage?navTitle=%E6%B4%8B%E8%91%B1%E6%98%9F%E7%90%83%E7%A0%94%E5%AD%A6%E5%B0%8F%E7%A8%8B%E5%BA%8F%E4%BB%98%E8%B4%B9%E5%8D%8F%E8%AE%AE&agreementId=26"
    }
  ]
})

// 计算总价（固定数量为1）
const totalPrice = computed(() => {
  return centsToYuan(goodInfo.value?.price || 0)
})

// 计算最终价格（扣除优惠券）
const finalPrice = computed(() => {
  const discount = selectedCoupon.value?.discountAmount || 0
  return calculateDiscountedPrice(totalPrice.value, discount)
})

const fetchGoodInfo = async () => {
  try {
    const res = await getGoodInfo(goodId)
    goodInfo.value = res.info
    track("enter_no_booking_confirm", {
      product_name: goodInfo.value.name,
      product_id: goodInfo.value.id,
      camp_type: goodInfo.value.goodType === "multi" ? "多日营" : "单日营"
    })
  } catch (e) {
    console.error("获取商品信息失败", e)
    Taro.showToast({ title: "获取商品信息失败", icon: "none" })
  } finally {
    loading.value = false
  }
}

// 加载可用优惠券
const loadAvailableCoupons = async () => {
  try {
    const res = await getMyCouponList(goodId)
    const coupons = res.list || []
    // 过滤出未使用的优惠券
    availableCoupons.value = coupons.filter(c => c.status === "unUsed")

    // 自动选择优惠金额最大的优惠券
    if (availableCoupons.value.length > 0) {
      const maxDiscountCoupon = availableCoupons.value.reduce((prev, current) => {
        return (current.discountAmount || 0) > (prev.discountAmount || 0) ? current : prev
      })
      selectedCoupon.value = maxDiscountCoupon
    }
  } catch (e) {
    console.error("获取优惠券失败", e)
  }
}

// 处理选择优惠券
const handleSelectCoupon = () => {
  if (availableCoupons.value.length === 0) {
    Taro.showToast({ title: "暂无可用优惠券", icon: "none" })
    return
  }

  Taro.navigateTo({
    url: `/pages/coupon/available/index?goodId=${goodId}&selectedCouponId=${
      selectedCoupon.value?.id || ""
    }`
  })
}

const handleSubmit = async () => {
  if (!agreementChecked.value) {
    Taro.showToast({
      title: "请先同意相关协议",
      icon: "none"
    })
    return
  }
  trackClick("pay_now")
  try {
    submitting.value = true

    // 第一步:创建订单(无预约模式，固定数量为1)
    const result = await createMiniProgramOrder({
      goodId,
      goodNums: 1,
      parentRemark: remark.value || undefined,
      userCouponId: selectedCoupon.value?.id || undefined
    })
    console.log("订单创建成功:", result)

    const orderId = result.orderId

    // 第二步:发起支付
    const paymentResult = await payOrder(orderId)

    // 第三步:处理支付结果
    await handlePaymentResult(paymentResult, orderId)
    // 支付成功后不重置 submitting，保持按钮禁用状态直到页面跳转
  } catch (error) {
    console.error("提交订单失败", error)
    const errorMessage = error.message || "提交订单失败，请重试"

    // 检查是否是优惠券相关错误
    if (
      errorMessage.includes("优惠券") ||
      errorMessage.includes("coupon") ||
      errorMessage.includes("过期")
    ) {
      // 刷新优惠券列表
      await loadAvailableCoupons()
      Taro.showToast({
        title: "优惠券已过期，请重新选择",
        icon: "none",
        duration: 2000
      })
    } else {
      Taro.showToast({ title: errorMessage, icon: "none" })
    }

    submitting.value = false
  }
}

onMounted(() => {
  fetchGoodInfo()
  loadAvailableCoupons()

  // 监听优惠券选择事件
  const eventChannel = Taro.eventCenter
  eventChannel.on("selectCoupon", (data: any) => {
    if (data.couponId) {
      // 找到选中的优惠券
      const coupon = availableCoupons.value.find(c => c.id === data.couponId)
      if (coupon) {
        selectedCoupon.value = coupon
      }
    } else {
      selectedCoupon.value = null
    }
  })
})
</script>

<style lang="less">
.order-confirm-content {
  overflow-y: auto;
  padding: 32rpx;
  .button-group {
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom) + 32rpx);
    right: 32rpx;
    .submit-btn {
      width: calc(100vw - 64rpx);
    }
  }
  /* .remark 预留，如需自定义展示样式可在此扩展 */
  .remark {
    color: #848096;
    font-family: PingFang SC;
    font-weight: 400;
    font-size: 28px;
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .coupon-select {
    display: flex;
    align-items: center;

    .coupon-text {
      display: flex;
      align-items: center;
      font-family: PingFang SC;
      font-weight: 400;
      font-size: 28px;

      .coupon-discount {
        color: #fa5a66;
        font-weight: 600;
      }

      .arrow-icon {
        width: 24rpx;
        height: 24rpx;
        margin-left: 8rpx;
      }
    }

    .coupon-text-disabled {
      display: flex;
      align-items: center;
      color: #848096;
      font-family: PingFang SC;
      font-weight: 400;
      font-size: 28px;
    }
  }
}
.remark-sheet__container {
  position: relative;
  padding: 48rpx 32rpx 32rpx 32rpx;
}

.remark-textarea {
  width: 100%;
  min-height: 260rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-sizing: border-box;
}

.remark-count {
  position: absolute;
  text-align: right;
  color: #848096;
  margin-top: 8rpx;
  bottom: 64rpx;
  right: 64rpx;
}

.remark-actions {
  border-top: 2px solid #efeef3;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  .btn {
    width: 100%;
  }
}
</style>
