<template>
  <TabBarLayout
    tab-key="available-coupon"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '可用优惠券' }"
  >
    <view
      class="available-coupon-page"
      :style="{ height: `calc(100vh - ${getNavBarHeight()}rpx)` }"
    >
      <!-- 滚动容器 -->
      <scroll-view
        class="scroll-container"
        :scroll-y="true"
        :show-scrollbar="false"
        :enhanced="true"
        :refresher-enabled="true"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
      >
        <!-- 优惠券列表 -->
        <view class="coupon-list">
          <view v-if="loading" class="loading-container">
            <Loading />
          </view>

          <view v-else-if="availableCoupons.length === 0" class="empty-container">
            <EmptyState title="暂无可用优惠券" description="暂无可用优惠券" :show-button="false" />
          </view>

          <view v-else class="coupon-items">
            <view v-for="coupon in availableCoupons" :key="coupon.id" class="coupon-item">
              <Coupon
                :amount="coupon.discountAmount"
                :title="coupon.couponName"
                :threshold-text="getThresholdText(coupon.minAmount)"
                :effective-time="formatTime(getEffectiveTime(coupon))"
                :expire-time="formatTime(coupon.expireTime)"
                :button-text="selectedCouponId === coupon.id ? '已 选 择' : '点击选择'"
                :type="coupon.couponType"
                :type-label="getTypeLabel(coupon.couponType)"
                :horizontal="true"
                @click="handleSelectCoupon(coupon)"
              />
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </TabBarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import Taro, { useRouter } from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import Coupon from "@/components/Coupon/index.vue"
import Loading from "@/components/Loading/index.vue"
import EmptyState from "@/components/EmptyState/index.vue"
import { getMyCouponList } from "../service"
import type { CouponInfo } from "../service"
import { formatDateCustom } from "@/utils/formatDate"
import { getNavBarHeight } from "@/utils/statusBar"

const router = useRouter()
const goodId = router.params.goodId as string
const currentSelectedId = router.params.selectedCouponId as string

// 响应式数据
const loading = ref(false)
const refreshing = ref(false)
const selectedCouponId = ref(currentSelectedId || "")

// 优惠券列表
const allCoupons = ref<CouponInfo[]>([])

// 可用优惠券列表
const availableCoupons = computed(() => {
  return allCoupons.value.filter(coupon => coupon.status === "unUsed")
})

// 获取门槛文字
const getThresholdText = (minAmount: number) => {
  if (minAmount > 0) {
    return `满${minAmount}元可用`
  }
  return "无门槛使用"
}

// 获取类型标签
const getTypeLabel = (type: string) => {
  switch (type) {
    case "common":
      return "通用券"
    case "good":
      return "商品券"
    default:
      return ""
  }
}

// 获取生效时间
const getEffectiveTime = (coupon: CouponInfo) => {
  // 如果是领取后生效的优惠券，返回领取时间
  if (coupon.claimTime) {
    return coupon.claimTime
  }
  return coupon.validStartTime || ""
}

// 格式化时间
const formatTime = (time: string) => {
  if (!time) return ""
  return formatDateCustom(time, "YYYY.MM.DD HH:mm")
}

// 处理选择优惠券
const handleSelectCoupon = (coupon: CouponInfo) => {
  selectedCouponId.value = coupon.id
  // 返回到上一页，并携带选中的优惠券信息
  const pages = Taro.getCurrentPages()
  const prevPage = pages[pages.length - 2]

  if (prevPage) {
    // 通过事件总线或者全局状态传递数据
    const eventChannel = Taro.eventCenter
    eventChannel.trigger("selectCoupon", {
      couponId: selectedCouponId.value,
      discountAmount: selectedCouponId.value ? coupon.discountAmount : 0
    })
  }

  Taro.navigateBack()
}

// 加载优惠券数据
const loadCoupons = async () => {
  try {
    loading.value = true
    const response = await getMyCouponList(goodId)
    allCoupons.value = response.list || []
  } catch (error) {
    console.error("加载优惠券失败:", error)
    Taro.showToast({
      title: "加载失败",
      icon: "none"
    })
  } finally {
    loading.value = false
  }
}

// 下拉刷新
const onRefresh = async () => {
  refreshing.value = true
  try {
    await loadCoupons()
  } finally {
    refreshing.value = false
  }
}

// 页面加载时初始化
onMounted(() => {
  loadCoupons()
})
</script>

<style lang="less">
.available-coupon-page {
  background: #f7f7f9;
  display: flex;
  flex-direction: column;
}

.scroll-container {
  flex: 1;
  height: 0;
}

.coupon-list {
  padding: 32rpx;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}

.empty-container {
  padding: 80rpx 0;
}

.coupon-items {
  padding-top: 32rpx;
  .coupon-item {
    margin-bottom: 32rpx;

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
