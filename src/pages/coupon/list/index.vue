<template>
  <TabBarLayout
    tab-key="wode"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '我的优惠券' }"
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
        <!-- 优惠券分类标签 -->
        <view class="coupon-tabs">
          <Tabs v-model="activeTab" :default-active="0" @change="handleTabChange">
            <TabItem v-for="tab in tabs" :key="tab.key" :value="tab.key">
              <view class="coupon-tab-content">
                <text class="coupon-tab-text">{{ tab.label }}</text>
              </view>
            </TabItem>
          </Tabs>
        </view>

        <!-- 优惠券列表 -->
        <view class="coupon-list">
          <view v-if="loading" class="loading-container">
            <Loading />
          </view>

          <view v-else-if="filteredCoupons.length === 0" class="empty-container">
            <EmptyState
              title="暂无优惠券"
              description="您还没有优惠券，快去领取吧~"
              :show-button="true"
              button-text="去领取"
              @button-click="goToCouponCenter"
            />
          </view>

          <view v-else class="coupon-items">
            <view v-for="coupon in filteredCoupons" :key="coupon.id" class="coupon-item">
              <Coupon
                :amount="coupon.discountAmount"
                :title="coupon.couponName"
                :threshold-text="getThresholdText(coupon.minAmount)"
                :effective-time="formatDateCustom(coupon.claimTime, 'YYYY.MM.DD HH:mm')"
                :expire-time="formatDateCustom(coupon.expireTime, 'YYYY.MM.DD HH:mm')"
                :button-text="getButtonText(coupon)"
                :disabled="
                  coupon.status === 'expired' ||
                  coupon.status === 'used' ||
                  coupon.status === 'locked'
                "
                :type="coupon.couponType"
                :type-label="getTypeLabel(coupon.couponType)"
                :horizontal="true"
                @click="handleCouponClick(coupon)"
              />
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </TabBarLayout>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import Taro from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import Coupon from "@/components/Coupon/index.vue"
import Loading from "@/components/Loading/index.vue"
import EmptyState from "@/components/EmptyState/index.vue"
import Tabs from "@/components/Ui/tabs/index.vue"
import TabItem from "@/components/Ui/tabs/tab-item.vue"
import { getMyCouponList } from "../service"
import { formatDateCustom } from "@/utils/formatDate"
import { getNavBarHeight } from "@/utils/statusBar"
// 响应式数据
const loading = ref(false)
const refreshing = ref(false)
const activeTab = ref("unUsed")

// 优惠券列表
const coupons = ref([])

// 标签页配置
const tabs = ref([
  { key: "unUsed", label: "未使用" },
  { key: "usedAndExpired", label: "已使用/过期" }
])

const filteredCoupons = computed(() => {
  return coupons.value.filter(coupon => {
    switch (activeTab.value) {
      case "unUsed":
        return coupon.status === "unUsed"
      case "usedAndExpired":
        return ["used", "expired", "locked"].includes(coupon.status)
      default:
        return true
    }
  })
})

// 处理标签页变化
const handleTabChange = value => {
  activeTab.value = value
}

// 获取按钮文字
const getButtonText = coupon => {
  switch (coupon.status) {
    case "unUsed":
      return "立即使用"
    case "used":
      return "已使用"
    case "expired":
      return "已过期"
    case "locked":
      return "已使用"
    default:
      return "立即使用"
  }
}
const getThresholdText = minAmount => {
  if (minAmount > 0) {
    return `满${minAmount}元可用`
  } else {
    return "无门槛使用"
  }
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

// 处理优惠券点击
const handleCouponClick = coupon => {
  if (coupon.status === "unUsed") {
    // 跳转到优惠券商品列表页面
    Taro.navigateTo({
      url: `/pages/coupon/products/index?userCouponId=${coupon.id}&couponId=${coupon.couponId}&couponType=${coupon.couponType}`
    })
  }
}

// 加载优惠券数据
const loadCoupons = async () => {
  try {
    loading.value = true

    // 这里调用获取优惠券列表的API
    const response = await getMyCouponList()
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

// 跳转到优惠券中心
const goToCouponCenter = () => {
  Taro.navigateTo({
    url: "/pages/coupon/receiveList/index"
  })
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
  height: 100vh;
  background: #f7f7f9;
  display: flex;
  flex-direction: column;
}

.scroll-container {
  flex: 1;
  height: 0; // 确保scroll-view能正确计算高度
}

.coupon-tabs {
  background: #ffffff;

  .coupon-tab-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
  }

  .coupon-tab-text {
    font-size: 28rpx;
    line-height: 1;
  }

  .coupon-tab-badge {
    background: #ff4757;
    color: #ffffff;
    font-size: 20rpx;
    padding: 4rpx 8rpx;
    border-radius: 10rpx;
    min-width: 32rpx;
    text-align: center;
    line-height: 1;
  }
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
</style>
