<template>
  <TabBarLayout
    tab-key="wode"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: isFromScan ? '领取优惠券' : '可用商品' }"
    :custom-back="handleBack"
  >
    <view class="products-page" :style="{ height: `calc(100vh - ${getNavBarHeight()}rpx)` }">
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
        <!-- 扫码领取成功提示 -->
        <PromoBanner
          v-if="claimSuccess && isFromScan"
          type="success-bubble"
          text="恭喜您，优惠券领取成功啦！"
          :sub-text="promoText"
        />

        <!-- 促销横幅 -->
        <PromoBanner
          v-if="!claimSuccess && couponInfo && !isFromScan && !showCouponEmpty"
          :text="promoText"
        />

        <!-- 优惠券已抢光空状态 -->
        <view v-if="showCouponEmpty" class="empty-container">
          <EmptyState
            icon="https://fp.yangcong345.com/middle/1.0.0/coupon-empty-fb8e4dd07faecbbd136f8b204ce696a7__w.png"
            title="来晚了,优惠券已被领取完"
            :show-button="false"
          />
        </view>

        <!-- 商品列表 -->
        <view v-else class="products-list">
          <view v-if="loading" class="loading-container">
            <Loading />
          </view>

          <view v-else-if="products.length === 0" class="empty-container">
            <EmptyState
              title="暂无商品"
              description="该优惠券暂无可用的商品"
              :show-button="false"
            />
          </view>

          <ProductList
            v-else
            :products="products"
            :show-sales="true"
            layout="grid"
            type="coupon"
            :user-coupon-id="userCouponId"
          />
        </view>

        <!-- 没有更多数据提示 -->
        <NoMoreData v-if="products.length > 0 && !showCouponEmpty" />
      </scroll-view>
    </view>
  </TabBarLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import Taro from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import ProductList from "@/components/ProductList/index.vue"
import Loading from "@/components/Loading/index.vue"
import EmptyState from "@/components/EmptyState/index.vue"
import NoMoreData from "@/components/NoMoreData/index.vue"
import PromoBanner from "@/components/PromoBanner/index.vue"
import {
  getCouponAdaptGoodInfoList,
  claimCoupon,
  getCouponDetail,
  type CouponInfo,
  type ProductInfo
} from "@/pages/coupon/service"
import { getNavBarHeight } from "@/utils/statusBar"
import { checkLoginStatus } from "@/api/auth"

// 常量定义
const STORAGE_KEY_PREFIX = "claimed_coupon_"
const SCANCODE_TIME_KEY_PREFIX = "scancode_time_"

// URL参数类型
interface UrlParams {
  couponId: string
  fromScan: boolean
  scancodeTime: string
}

// 响应式数据
const loading = ref(false)
const refreshing = ref(false)
const claimSuccess = ref(false)
const isFromScan = ref(false)
const showCouponEmpty = ref(false)

// 优惠券信息
const couponInfo = ref<CouponInfo | null>(null)

// 用户优惠券ID
const userCouponId = ref<string>("")

// 商品列表
const products = ref<ProductInfo[]>([])

// 计算属性：促销横幅文案
const promoText = computed(() => {
  if (!couponInfo.value) return ""

  const discountAmount = couponInfo.value.discountAmount || 0
  const minAmount = couponInfo.value.minAmount || 0

  if (minAmount === 0) {
    // 无门槛
    return `下单立减${discountAmount}元，无任何门槛`
  } else {
    // 有门槛
    return `消费满${minAmount}元时，付款直接抵扣${discountAmount}元`
  }
})

// 保存扫码时间到本地存储
const saveScancodeTime = (couponId: string, scancodeTime: string): void => {
  if (!couponId || !scancodeTime) {
    return
  }
  try {
    const storageKey = `${SCANCODE_TIME_KEY_PREFIX}${couponId}`
    Taro.setStorageSync(storageKey, scancodeTime)
  } catch (error) {
    console.error("保存扫码时间失败:", error)
  }
}

// 从本地存储获取扫码时间
const getScancodeTimeFromStorage = (couponId: string): string | null => {
  if (!couponId) {
    return null
  }
  try {
    const storageKey = `${SCANCODE_TIME_KEY_PREFIX}${couponId}`
    const scancodeTime = Taro.getStorageSync(storageKey)
    return scancodeTime || null
  } catch (error) {
    console.error("读取扫码时间失败:", error)
    return null
  }
}

// 检查用户登录状态
const judgeCheckLoginStatus = () => {
  if (!checkLoginStatus()) {
    // 未登录，如果是扫码进入，直接跳转到登录页并保留参数（包括扫码时间）
    const params = getUrlParams()
    let redirectUrl = `/pages/coupon/products/index?couponId=${params.couponId || ""}&fromScan=true`
    // 如果有扫码时间，也传递过去
    if (params.scancodeTime) {
      redirectUrl += `&scancode_time=${params.scancodeTime}`
    }
    Taro.redirectTo({
      url: `/pages/user/login/index?redirect=${encodeURIComponent(redirectUrl)}`
    })
    return false
  }
  return true
}

// 检查本地存储中是否已领取过该优惠券（通过扫码时间判断是否是同一次扫码）
const checkClaimedCoupon = (couponId: string, scancodeTime: string): string | null => {
  if (!couponId) {
    return null
  }

  // 如果没有扫码时间，尝试从存储中获取
  let finalScancodeTime = scancodeTime
  if (!finalScancodeTime) {
    finalScancodeTime = getScancodeTimeFromStorage(couponId) || ""
  }

  if (!finalScancodeTime) {
    return null
  }

  try {
    const storageKey = `${STORAGE_KEY_PREFIX}${couponId}_${finalScancodeTime}`
    const claimedId = Taro.getStorageSync(storageKey)
    return claimedId || null
  } catch (error) {
    console.error("读取本地存储失败:", error)
    return null
  }
}

// 保存领取成功的优惠券ID到本地存储（使用扫码时间作为唯一标识）
const saveClaimedCoupon = (couponId: string, userCouponId: string, scancodeTime: string): void => {
  if (!couponId || !userCouponId) {
    return
  }

  // 如果没有扫码时间，尝试从存储中获取
  let finalScancodeTime = scancodeTime
  if (!finalScancodeTime) {
    finalScancodeTime = getScancodeTimeFromStorage(couponId) || ""
  }

  if (!finalScancodeTime) {
    return
  }

  try {
    const storageKey = `${STORAGE_KEY_PREFIX}${couponId}_${finalScancodeTime}`
    Taro.setStorageSync(storageKey, userCouponId)
  } catch (error) {
    console.error("保存本地存储失败:", error)
  }
}

// 自动领取优惠券
const autoClaimCoupon = async (couponId: string, scancodeTime: string): Promise<string | false> => {
  try {
    loading.value = true
    const result = await claimCoupon(couponId)

    if (result?.id) {
      // 领取成功，保存到本地存储（使用扫码时间作为唯一标识）
      saveClaimedCoupon(couponId, result.id, scancodeTime)
      claimSuccess.value = true
      Taro.showToast({
        title: "领取成功",
        icon: "success",
        duration: 2000
      })
      return result.id
    } else {
      throw new Error("领取失败")
    }
  } catch (error: any) {
    console.error("领取优惠券失败:", error)
    showCouponEmpty.value = true
    // 处理错误信息
    const errorMsg = error?.message || error?.errMsg || "领取失败"

    if (errorMsg.includes("已领取") || errorMsg.includes("已达领取上限")) {
      // 如果已经领取过，尝试从本地存储获取（使用扫码时间判断）
      if (scancodeTime) {
        const claimedId = checkClaimedCoupon(couponId, scancodeTime)
        if (claimedId) {
          saveClaimedCoupon(couponId, claimedId, scancodeTime)
          claimSuccess.value = true
          return claimedId
        }
      }
      Taro.showToast({
        title: "您已经领取过该优惠券了",
        icon: "none"
      })
    } else if (errorMsg.includes("已抢光") || errorMsg.includes("库存不足")) {
      Taro.showToast({
        title: "优惠券已抢光",
        icon: "none"
      })
    } else if (errorMsg.includes("已过期") || errorMsg.includes("活动已结束")) {
      Taro.showToast({
        title: "活动已结束",
        icon: "none"
      })
    } else {
      Taro.showToast({
        title: errorMsg,
        icon: "none"
      })
    }
    return false
  } finally {
    loading.value = false
  }
}

// 加载优惠券详情
const loadCouponDetail = async (couponId: string): Promise<CouponInfo | null> => {
  try {
    const res = await getCouponDetail(couponId)
    couponInfo.value = res.couponInfo
    return res.couponInfo
  } catch (error) {
    console.error("加载优惠券详情失败:", error)
    Taro.showToast({
      title: "加载优惠券详情失败",
      icon: "none"
    })
    return null
  }
}

// 加载商品数据
const loadProducts = async (): Promise<void> => {
  if (!couponInfo.value?.id) {
    console.warn("优惠券ID不存在，无法加载商品列表")
    loading.value = false
    return
  }

  try {
    loading.value = true

    // 调用新接口：通过优惠券ID查询适用的商品列表
    const res = await getCouponAdaptGoodInfoList(couponInfo.value.id)

    if (res?.list) {
      // 将接口返回的数据格式转换为ProductList组件需要的格式
      products.value = res.list.map(item => ({
        goodId: item.goodId,
        goodName: item.goodName,
        price: item.price,
        mainImage: item.mainImage?.[0] || "",
        detailImages: item.detailImages || []
      }))
    } else {
      products.value = []
    }
  } catch (error) {
    console.error("加载商品失败:", error)
    Taro.showToast({
      title: "加载失败",
      icon: "none"
    })
    products.value = []
  } finally {
    loading.value = false
  }
}

// 下拉刷新
const onRefresh = async () => {
  refreshing.value = true
  try {
    await loadProducts()
  } finally {
    refreshing.value = false
  }
}

// 处理返回按钮点击
const handleBack = () => {
  if (isFromScan.value) {
    // 如果是扫码进入，直接跳转到首页
    Taro.switchTab({
      url: "/pages/recommend/index/index"
    })
  } else {
    // 否则正常返回上一页
    Taro.navigateBack()
  }
}

// 获取URL参数
const getUrlParams = (): UrlParams => {
  const instance = Taro.getCurrentInstance()
  const params = instance?.router?.params || {}
  // 优先从常规参数中获取（用于登录后返回的场景）
  let couponId = params.couponId || ""
  let fromScan = false
  const fromScanParam = params.fromScan as string | boolean | undefined
  if (fromScanParam === "true" || fromScanParam === true) {
    fromScan = true
  }
  let scancodeTime = params.scancode_time || params.scancodeTime || ""

  // 如果没有，尝试从扫码参数中解析（扫码场景）
  if (!couponId && params.q) {
    try {
      const q = decodeURIComponent(decodeURIComponent(params.q))
      couponId = q.split("couponId=")[1]?.split("&")[0] || ""
    } catch (error) {
      console.error("解析扫码参数失败:", error)
    }
  }

  // 判断是否来自扫码
  if (!fromScan) {
    fromScan = !!(params.scancode_time || params.scancodeTime)
  }

  // 获取扫码时间（用于判断是否是同一次扫码）
  if (!scancodeTime && fromScan) {
    scancodeTime = params.scancode_time || params.scancodeTime || ""
  }

  // 如果从 URL 参数中获取到了扫码时间，保存到本地存储
  if (scancodeTime && couponId) {
    saveScancodeTime(couponId, scancodeTime)
  }

  return {
    couponId: couponId || "",
    fromScan,
    scancodeTime: scancodeTime || ""
  }
}

// 页面加载时初始化
onMounted(async () => {
  if (!judgeCheckLoginStatus()) {
    return
  }

  const { couponId, scancodeTime, fromScan } = getUrlParams()
  isFromScan.value = fromScan

  if (!couponId) {
    Taro.showToast({
      title: "优惠券ID不存在",
      icon: "none"
    })
    setTimeout(() => {
      Taro.navigateBack()
    }, 1000)
    return
  }

  // 加载优惠券详情
  const detail = await loadCouponDetail(couponId)
  if (!detail) {
    return
  }

  // 如果是扫码进入，处理自动领取逻辑
  if (isFromScan.value) {
    // 确保扫码时间已保存到存储（防止后续丢失）
    let finalScancodeTime = scancodeTime
    if (finalScancodeTime) {
      saveScancodeTime(couponId, finalScancodeTime)
    } else {
      // 如果 URL 中没有，尝试从存储中恢复
      const storedTime = getScancodeTimeFromStorage(couponId)
      if (storedTime) {
        finalScancodeTime = storedTime
      }
    }

    // 先检查本地存储，避免重复领取（使用扫码时间作为唯一标识）
    const claimedId = checkClaimedCoupon(couponId, finalScancodeTime)
    if (claimedId) {
      // 已经领取过（同一次扫码），直接使用已保存的ID
      userCouponId.value = claimedId
      claimSuccess.value = true
    } else {
      // 未领取过（或不同次扫码），执行自动领取
      const claimResult = await autoClaimCoupon(couponId, finalScancodeTime)
      if (claimResult) {
        userCouponId.value = claimResult
      }
    }
  }

  // 加载商品数据
  await loadProducts()
})
</script>

<style lang="less">
.products-page {
  height: 100vh;
  background: #f7f7f9;
  display: flex;
  flex-direction: column;
}

.scroll-container {
  flex: 1;
  height: 0;
}

// 商品列表
.products-list {
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
</style>
