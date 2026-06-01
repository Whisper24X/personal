<template>
  <tab-bar-layout tab-key="product-detail" :show-tab-bar="false" :show-custom-nav-bar="false">
    <!-- 加载中 -->
    <view v-if="loading && (!goodInfo || !goodInfo.id)" class="loading">
      <Loading />
    </view>

    <!-- 订单详情内容 -->
    <view v-else class="detail-content">
      <!-- 返回按钮 -->
      <view class="back-button" :style="{ top: `${statusBarHeight}px` }" @tap="handleGoBack">
        <image class="back-icon" :src="backIcon" />
      </view>
      <!-- 商品图片轮播 -->
      <ProductImageSlider
        :main-images="goodInfo?.mainImage"
        :current-image-index="currentImageIndex"
        @image-change="handleImageChange"
      />

      <!-- 价格商品模块 -->
      <ProductPriceInfo
        :type="type"
        :good-info="goodInfo"
        :order-info="orderInfo"
        @claim-coupon="handleClaimCoupon"
      />

      <!-- 商品详情模块 -->
      <ProductDetailContent :good-info="goodInfo" />

      <!-- 底部操作按钮 -->
      <ProductActionButtons
        :type="type"
        :show-book-btn="showBookBtn"
        :order-info="orderInfo"
        :good-info="goodInfo"
        @book-now="handleBookNow"
        @book-record="handleBookRecord"
        @share="handleShare"
        @customer-service="handleCustomerService"
      />
    </view>

    <!-- 客服二维码弹框 -->
    <CustomerServiceModal v-model="showCustomerServiceModal" />

    <!-- 分享弹框 -->
    <ShareSheet
      v-model:show="showShareSheet"
      :good-info="goodInfo"
      :order-info="orderInfo"
      :user-info="userInfo"
      :type="type"
      :order-id="orderId"
      @close="handleCloseShare"
      @share-success="handleShareSuccess"
      @share-error="handleShareError"
    />

    <!-- 优惠券领取弹窗 -->
    <CouponClaimModal
      v-model:show="showCouponModal"
      :good-id="orderId"
      @claim-success="handleCouponClaimSuccess"
    />
  </tab-bar-layout>
</template>

<script>
import { ref, computed } from "vue"
import Taro from "@tarojs/taro"
import { getOrderGoodInfo, OrderStatus } from "@/api/order"
import { getGoodInfo, getGoodIdBySceneId } from "@/api/good"
import { useUserStore } from "@/store/userStore"
import Loading from "@/components/Loading/index.vue"
import CustomerServiceModal from "@/components/CustomerServiceModal/index.vue"
import ShareSheet from "./components/ShareSheet.vue"
import ProductImageSlider from "./components/ProductImageSlider.vue"
import ProductPriceInfo from "./components/ProductPriceInfo.vue"
import ProductDetailContent from "./components/ProductDetailContent.vue"
import ProductActionButtons from "./components/ProductActionButtons.vue"
import CouponClaimModal from "./components/CouponClaimModal.vue"
import { PAGE_TYPES, PAGE_TITLES, VALID_APPOINTMENT_STATUSES, ROUTES } from "./constants"
import { useDidShow } from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import { statusBarHeight } from "@/utils/style"
import backIcon from "@/assets/icons/back.png"
import { checkLoginStatus } from "@/api/auth"
import { centsToYuan } from "@/utils/formatPrice"
import { track, trackClick } from "@/utils/analytics"

export default {
  name: "OrderDetail",
  components: {
    TabBarLayout,
    Loading,
    CustomerServiceModal,
    ShareSheet,
    ProductImageSlider,
    ProductPriceInfo,
    ProductDetailContent,
    ProductActionButtons,
    CouponClaimModal
  },
  setup() {
    // 用户状态管理
    const userStore = useUserStore()
    const userInfo = computed(() => userStore.userInfo)

    const orderInfo = ref(null)
    const goodInfo = ref(null)
    const loading = ref(true)
    const currentImageIndex = ref(0)
    const showCustomerServiceModal = ref(false)
    const showShareSheet = ref(false)
    const showCouponModal = ref(false)

    // 获取路由参数
    const router = Taro.getCurrentInstance().router
    let orderId = router?.params?.id || ""
    let type = router?.params?.type || PAGE_TYPES.ORDER // 默认为订单类型
    let userCouponId = router?.params?.userCouponId || ""
    const enterSource = router?.params?.enterSource || ""
    // 用于存储场景ID
    const sceneId = ref("")
    const isFromScene = ref(false)

    // 扫二维码进入的页面，从当前页面参数中获取 scene
    const currentScene = router?.params?.scene || ""
    console.log("currentScene", currentScene)
    if (typeof currentScene === "string" && currentScene) {
      sceneId.value = currentScene
      type = PAGE_TYPES.PRODUCT
      isFromScene.value = true
      console.log("检测到场景ID:", sceneId.value)
    } else {
      // 如果当前页面参数没有 scene，则不是扫码进入
      isFromScene.value = false
    }
    // 页面类型判断
    const isProductType = computed(() => type === PAGE_TYPES.PRODUCT)
    const isOrderType = computed(() => type === PAGE_TYPES.ORDER)

    // 页面标题
    const pageTitle = computed(() => PAGE_TITLES[type] || PAGE_TITLES[PAGE_TYPES.ORDER])

    // 检查是否有可预约的课程
    const hasAvailableAppointments = computed(() => {
      return goodInfo.value?.content?.goodCategories?.some(category => {
        const appointmentCount =
          category?.courses?.filter(course => course?.isAppointment).length || 0
        return appointmentCount < (category?.useTimes || 0)
      })
    })

    // 订单状态是否有效（可预约状态）
    const isOrderStatusValid = computed(() => {
      if (!orderInfo.value) return false
      return VALID_APPOINTMENT_STATUSES.includes(orderInfo.value.status)
    })

    // 是否显示预约按钮
    // 计算库存状态（仅定金商品）
    const stockStatus = computed(() => {
      if (goodInfo.value?.goodType !== "deposit") {
        return null // 非定金商品，不显示库存状态
      }
      const stock = goodInfo.value?.stock
      if (stock === null || stock === undefined) {
        return "unlimited" // 无限库存
      }
      if (stock === 0) {
        return "soldOut" // 已售罄
      }
      return "available" // 有库存
    })

    const showBookBtn = computed(() => {
      // 定金商品：库存为0时不显示按钮
      // debugger
      if (goodInfo.value?.goodType === "deposit") {
        return true
      }

      if (isProductType.value) {
        // 商品页面：直接检查是否有可预约课程
        return hasAvailableAppointments.value
      }

      if (isOrderType.value) {
        // 订单页面：检查订单状态和可预约课程
        return isOrderStatusValid.value && hasAvailableAppointments.value
      }

      return false
    })

    // 通过场景ID获取真实商品ID
    const fetchRealGoodIdBySceneId = async sceneId => {
      try {
        console.log("🔍 通过场景ID获取真实商品ID:", sceneId)
        const res = await getGoodIdBySceneId(sceneId)
        console.log("场景ID API返回数据:", res)

        // 这里的scene是真实的商品id
        if (res && res.scene) {
          return res.scene
        } else {
          throw new Error("无法从场景ID获取真实商品ID")
        }
      } catch (error) {
        console.error("通过场景ID获取商品ID失败:", error)
        throw new Error(`场景ID解析失败: ${error.message}`)
      }
    }

    // 获取商品信息数据
    const fetchProductInfo = async (goodId = null) => {
      const targetId = goodId || orderId
      console.log("📦 获取商品信息，ID:", targetId)

      const res = await getGoodInfo(targetId)
      console.log("商品信息API返回数据:", res)

      // 新增：检测商品是否下架，下架即提示并自动返回上一页
      let info = res?.info
      if (info && info.status === "putOff") {
        Taro.showToast({
          title: "该商品已下架",
          icon: "none",
          duration: 2000,
          complete: () => {
            setTimeout(() => Taro.navigateBack({ delta: 1 }), 1800)
          }
        })
        return
      }

      if (res && res.data && res.data.info) {
        goodInfo.value = res.data.info
        orderInfo.value = null // 商品列表跳转没有订单信息
      } else if (res && res.info) {
        goodInfo.value = res.info
        orderInfo.value = null
      } else {
        throw new Error("返回数据格式不正确")
      }
      enterSource &&
        track("enter_product_detail", {
          product_name: goodInfo.value.name,
          product_id: goodInfo.value.id,
          enter_source: enterSource
        })
    }

    // 获取订单商品信息数据
    const fetchOrderInfo = async () => {
      const res = await getOrderGoodInfo(orderId)
      console.log("订单商品信息API返回数据:", res)

      if (res && res.data) {
        orderInfo.value = res.data.orderInfo
        goodInfo.value = res.data.goodInfo
      } else if (res && res.orderInfo) {
        orderInfo.value = res.orderInfo
        goodInfo.value = res.goodInfo
      } else {
        throw new Error("返回数据格式不正确")
      }
    }

    // 根据页面类型获取数据
    const fetchGoodDetail = async () => {
      try {
        loading.value = true

        // 如果是通过场景ID进入，需要先获取真实的商品ID
        if (isFromScene.value && sceneId.value) {
          console.log("🎯 检测到场景ID，开始获取真实商品ID")
          try {
            let realGoodId = await fetchRealGoodIdBySceneId(sceneId.value)
            console.log("✅ 成功获取真实商品ID:", realGoodId)
            realGoodId = realGoodId.replace("$", "")
            // 更新 orderId 为真实的商品ID
            orderId = realGoodId

            // 获取商品信息
            await fetchProductInfo(realGoodId)
            // Taro.showToast({
            //   title: "扫码成功",
            //   icon: "success",
            //   duration: 1500
            // })
          } catch (sceneError) {
            console.error("❌ 场景ID处理失败:", sceneError)
            Taro.showModal({
              title: "提示",
              content: `二维码解析失败: ${sceneError.message}`,
              showCancel: false,
              confirmText: "确定"
            })
            // 场景ID失败后，尝试返回首页或显示错误
            setTimeout(() => {
              Taro.switchTab({
                url: "/pages/recommend/index/index"
              })
            }, 2000)
            return
          }
        } else {
          // 常规流程：直接使用传入的ID
          if (isProductType.value) {
            await fetchProductInfo()
          } else if (isOrderType.value) {
            await fetchOrderInfo()
          }
        }
      } catch (error) {
        console.error("获取商品详情失败", error)
        Taro.showToast({
          title: "获取商品详情失败",
          icon: "none"
        })
      } finally {
        loading.value = false
      }
    }

    // 处理图片切换
    const handleImageChange = e => {
      currentImageIndex.value = e.detail.current
    }

    // 领券处理
    const handleClaimCoupon = () => {
      trackClick("coupon")
      showCouponModal.value = true
    }

    // 优惠券领取成功回调
    const handleCouponClaimSuccess = coupon => {
      console.log("优惠券领取成功:", coupon)
    }

    // 导航到预约页面
    const navigateToAppointment = () => {
      if (isProductType.value) {
        // 商品页面：根据isPushAppointmentInfo字段决定跳转
        if (goodInfo.value?.isPushAppointmentInfo === false) {
          // 无预约模式：直接跳转到无预约确认订单页面
          Taro.navigateTo({
            url: `${ROUTES.ORDER_CONFIRM_NO_APPOINTMENT}?goodId=${orderId}&userCouponId=${userCouponId}`
          })
        } else {
          // 有预约模式：保持原有逻辑
          Taro.navigateTo({
            url: `${ROUTES.ORDER_SUBMIT}?id=${orderId}&type=${PAGE_TYPES.PRODUCT}&userCouponId=${userCouponId}`
          })
        }
      } else if (isOrderType.value) {
        // 订单页面：只传递订单ID，添加from参数标识来自订单页面
        Taro.navigateTo({
          url: `${ROUTES.APPOINTMENT}?id=${orderId}&from=order`
        })
      }
    }

    // 导航到预约记录页面
    const navigateToAppointmentRecords = () => {
      Taro.navigateTo({
        url: ROUTES.APPOINTMENT_RECORDS
      })
    }

    // 立即预约
    const handleBookNow = () => {
      trackClick("book_now")
      navigateToAppointment()
    }

    // 预约记录
    const handleBookRecord = () => {
      navigateToAppointmentRecords()
    }

    // 分享
    const handleShare = () => {
      //分享前要求登录若未登录跳转登录
      if (!checkLoginStatus()) {
        Taro.showToast({
          title: "分享需要登录,跳转登录中",
          icon: "none",
          mask: true,
          complete: () => {
            setTimeout(() => Taro.navigateTo({ url: ROUTES.USER_LOGIN }), 1800)
          }
        })
        return
      }
      showShareSheet.value = true
    }

    // 关闭分享弹框
    const handleCloseShare = () => {
      showShareSheet.value = false
    }

    // 分享成功回调
    const handleShareSuccess = type => {
      console.log(`${type} 分享成功`)
    }

    // 分享失败回调
    const handleShareError = (type, error) => {
      console.error(`${type} 分享失败:`, error)
    }

    // 客服
    const handleCustomerService = () => {
      trackClick("contact_customer_service", { source_page: "商品详情页" })
      showCustomerServiceModal.value = true
    }

    // 返回按钮处理
    const handleGoBack = () => {
      if (isFromScene.value) {
        // 如果是扫码进入，直接跳转到首页
        Taro.switchTab({
          url: "/pages/recommend/index/index"
        })
      } else {
        // 否则正常返回上一页 若异常则返回首页
        Taro.navigateBack().catch(() => {
          Taro.switchTab({
            url: "/pages/recommend/index/index"
          })
        })
      }
    }

    // 页面分享配置
    const onShareAppMessage = () => {
      const shareTitle = goodInfo.value?.name || "商品详情"
      const shareDesc = `¥${
        isProductType.value
          ? centsToYuan(goodInfo.value?.price || 0)
          : centsToYuan(orderInfo.value?.orderPrice || 0)
      } - ${goodInfo.value?.name}`
      const shareImageUrl = goodInfo.value?.mainImage?.[0] || ""

      return {
        title: shareTitle,
        desc: shareDesc,
        path: `/pages/product/detail/index?id=${orderId}&type=${type}`,
        imageUrl: shareImageUrl
      }
    }

    // 朋友圈分享配置
    const onShareTimeline = () => {
      const shareTitle = goodInfo.value?.name || "商品详情"
      const shareImageUrl = goodInfo.value?.mainImage?.[0] || ""

      return {
        title: shareTitle,
        path: `/pages/product/detail/index?id=${orderId}&type=${type}`,
        imageUrl: shareImageUrl
      }
    }

    // 初始化
    // onMounted(() => {
    //   fetchGoodDetail()
    // })
    useDidShow(() => {
      fetchGoodDetail()
    })

    return {
      // 响应式数据
      orderInfo,
      goodInfo,
      userInfo,
      loading,
      currentImageIndex,
      showCustomerServiceModal,
      showShareSheet,
      showCouponModal,
      orderId,
      statusBarHeight,
      backIcon,
      // 计算属性
      pageTitle,
      isProductType,
      isOrderType,
      hasAvailableAppointments,
      isOrderStatusValid,
      showBookBtn,

      // 原始参数
      type,
      userCouponId,

      // 事件处理函数
      handleImageChange,
      handleClaimCoupon,
      handleCouponClaimSuccess,
      handleBookNow,
      handleBookRecord,
      handleShare,
      handleCloseShare,
      handleCustomerService,
      handleShareSuccess,
      handleShareError,
      handleGoBack,

      // 分享配置
      onShareAppMessage,
      onShareTimeline,

      // 常量
      OrderStatus
    }
  }
}
</script>

<style lang="less">
// 加载状态
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #666;
}

// 详情内容容器
.detail-content {
  padding-bottom: calc(136rpx + env(safe-area-inset-bottom, 0rpx));
  position: relative;
}

// 返回按钮
.back-button {
  position: fixed;
  left: 32rpx;
  z-index: 1000;
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  .back-icon {
    width: 48rpx;
    height: 48rpx;
  }
}
</style>
