<template>
  <TabBarLayout
    tab-key="wode"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '优惠券领取' }"
  >
    <view class="coupon-page" :style="{ height: `calc(100vh - ${getNavBarHeight()}rpx)` }">
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

          <view v-else-if="coupons.length === 0" class="empty-container">
            <EmptyState
              title="暂无优惠券"
              description="暂无优惠券可以领取，敬请期待吧~"
              :show-button="false"
            />
          </view>

          <view v-else class="coupon-items">
            <view v-for="coupon in coupons" :key="coupon.id" class="coupon-item">
              <Coupon
                :amount="coupon.discountAmount"
                :title="coupon.name"
                :threshold-text="getThresholdText(coupon.minAmount)"
                :effective-time="getEffectiveTimeText(coupon)"
                :expire-time="getExpireTimeText(coupon)"
                :button-text="getButtonText(coupon)"
                :type="coupon.couponType"
                :disabled="coupon.receivedCount >= coupon.limitPerUser"
                :type-label="getTypeLabel(coupon.couponType)"
                :horizontal="true"
                @claim="handleClaimCoupon(coupon)"
              />
            </view>
          </view>
          <view v-if="!hasMore && coupons.length > 0" class="no-more">
            <text class="no-more-text">没有更多了</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </TabBarLayout>
</template>

<script setup>
import { ref, onMounted } from "vue"
import Taro from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import Coupon from "@/components/Coupon/index.vue"
import Loading from "@/components/Loading/index.vue"
import EmptyState from "@/components/EmptyState/index.vue"
import { getCouponList, claimCoupon } from "../service"
import { formatDateCustom } from "@/utils/formatDate"
import { getNavBarHeight } from "@/utils/statusBar"

// 响应式数据
const loading = ref(false)
const refreshing = ref(false)
const hasMore = ref(true)

// 优惠券列表
const coupons = ref([])

// 获取按钮文字
const getButtonText = coupon => {
  if (coupon.receivedCount >= coupon.limitPerUser) {
    return "已领取完"
  }
  return "立即领取"
}
const getThresholdText = minAmount => {
  if (minAmount > 0) {
    return `满${minAmount}元可用`
  } else {
    return "无门槛使用"
  }
}
const getExpireTimeText = coupon => {
  if (coupon.couponValidDays > 0) {
    return `领取后${coupon.couponValidDays}天内使用`
  }
  return formatDateCustom(coupon.validEndTime, "YYYY.MM.DD HH:mm")
}
const getEffectiveTimeText = coupon => {
  if (coupon.couponValidDays > 0) {
    return formatDateCustom(coupon.claimStartTime, "YYYY.MM.DD HH:mm")
  }
  return formatDateCustom(coupon.validStartTime, "YYYY.MM.DD HH:mm")
}

// 获取类型标签
const getTypeLabel = type => {
  switch (type) {
    case "common":
      return "通用券"
    case "good":
      return "商品券"
    default:
      return ""
  }
}
const isProcessing = ref(false)
// 处理优惠券领取
const handleClaimCoupon = async coupon => {
  if (isProcessing.value) return
  const now = new Date().getTime()
  const claimEndTimestamp = new Date(coupon.claimEndTime).getTime()
  if (coupon.receivedCount >= coupon.limitPerUser) {
    Taro.showToast({
      title: "该优惠券已达领取上限",
      icon: "none"
    })
    return
  }
  if (now > claimEndTimestamp) {
    Taro.showToast({
      title: "领取活动已结束",
      icon: "none"
    })
    await loadCoupons()
    return
  }
  isProcessing.value = true
  try {
    const result = await claimCoupon(coupon.id)
    if (result) {
      Taro.showToast({
        title: "领取成功",
        icon: "success"
      })
    }
    await loadCoupons()
    isProcessing.value = false
  } catch (error) {
    console.error("领取优惠券失败:", error)
    await loadCoupons()
    isProcessing.value = false
  }
}

// 加载优惠券数据
const loadCoupons = async () => {
  try {
    loading.value = true

    // 这里调用获取优惠券列表的API
    const response = await getCouponList()
    // const eg = {
    //   claimEndTime: "2025-10-31T08:00:00+08:00",
    //   claimStartTime: "2025-09-01T08:00:00+08:00",
    //   couponType: "good",
    //   couponValidDays: 0,
    //   discountAmount: 500,
    //   id: "7bb53cc1-a76d-42bf-a356-636fc15ce4d3",
    //   limitPerUser: 2,
    //   minAmount: 600,
    //   name: "大额优惠",
    //   pushType: "public",
    //   receivedCount: 0,
    //   validEndTime: "2025-10-31T08:00:00+08:00",
    //   validStartTime: "2025-09-04T08:00:00+08:00"
    // }

    coupons.value = response.list
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
.coupon-page {
  background: #f7f7f9;
  display: flex;
  flex-direction: column;
}

.scroll-container {
  flex: 1;
  height: 0; // 确保scroll-view能正确计算高度
}

.coupon-list {
  padding: 0 32rpx;
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

.no-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40rpx 0;

  .no-more-text {
    font-size: 24rpx;
    color: #cccccc;
  }
}
</style>
