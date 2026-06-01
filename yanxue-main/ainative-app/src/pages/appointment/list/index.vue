<template>
  <TabBarLayout
    tab-key="appointment"
    :show-tab-bar="true"
    :show-custom-nav-bar="true"
    :nav-bar-config="{
      title: '预约课程',
      theme: 'light',
      showBack: false
    }"
  >
    <view
      class="appointment-container"
      :style="{
        backgroundSize: `100% ${statusBarHeight * 2 + 88}rpx`
      }"
    >
      <!-- 轮播图区域 -->
      <swiper
        v-if="bannerList.length > 0"
        class="banner-swiper"
        :indicator-dots="bannerList.length > 1"
        indicator-active-color="#FFD633"
        indicator-color="#EFEEF3"
        :circular="true"
        :autoplay="true"
      >
        <swiper-item
          v-for="(item, index) in bannerList"
          :key="index"
          @tap="handleBannerClick(item)"
        >
          <image class="banner-image" :src="item.thumbnail" mode="aspectFill" />
        </swiper-item>
      </swiper>

      <!-- 订单列表区域 -->
      <view class="order-section">
        <view class="order-header">
          <FilterDropdown v-model="currentFilter" :options="filterOptions" @change="changeFilter" />
        </view>

        <!-- 订单列表 -->
        <Order-list
          :orders="orderList"
          :loading="loading"
          :refreshing="refreshing"
          :no-more="noMore"
          :has-banner="bannerList.length > 0"
          @load-more="onLoadMore"
          @refresh="onRefresh"
          @order-click="goToOrderDetail"
        />
      </view>
    </view>
  </TabBarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro, { useDidShow } from "@tarojs/taro"
import { getOrderList } from "@/api/order"
import { getTripConfig } from "@/api/tripConfig"
import type { OrderInfo } from "@/api/order"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import FilterDropdown from "@/components/FilterDropdown/index.vue"
import OrderList from "./components/OrderList.vue"

import { statusBarHeight } from "@/utils/style"

// Banner数据
interface BannerItem {
  id: string
  thumbnail: string
  title: string
  type: string
  url: string
}

const bannerList = ref<BannerItem[]>([])

// 订单列表和分页数据
const orderList = ref<OrderInfo[]>([])
const totalOrders = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const refreshing = ref(false)
const noMore = ref(false)

// 筛选相关 - 使用serviceStatus（服务状态）
const currentFilter = ref("pending")
const filterOptions = [
  { label: "待预约", value: "pending" },
  { label: "已预约", value: "success" },
  { label: "已出行", value: "completed" }
]

// 获取banner数据
const fetchBannerData = async () => {
  try {
    const response = await getTripConfig("tripWechatBaseConfig")
    const data = response?.list[0]?.data
    if (data) {
      // 筛选出type为orderBanner的数据
      const bannerData = data.filter(
        (item: BannerItem) => item.type === "orderBanner" && item.id && item.thumbnail
      )
      bannerList.value = bannerData
    }
  } catch (error) {
    console.error("获取banner数据失败:", error)
    Taro.showToast({
      title: "获取banner数据失败",
      icon: "none"
    })
  }
}

// 处理 banner 点击事件
const handleBannerClick = (item: BannerItem) => {
  if (item.url) {
    if (/^http/.test(item.url)) {
      // 如果是外部链接，使用webview打开
      Taro.navigateTo({
        url: `/pages/webview/index?url=${encodeURIComponent(item.url)}`
      })
    } else {
      Taro.navigateTo({
        url: item.url
      })
    }
  }
}

// 选择筛选项
const changeFilter = () => {
  refresh()
}

// 获取订单列表
const fetchOrders = async (isRefresh = false) => {
  try {
    if (isRefresh) {
      refreshing.value = true
      currentPage.value = 1
    } else {
      loading.value = true
    }

    const res = await getOrderList({
      page: currentPage.value,
      pageSize: pageSize.value,
      serviceStatus: currentFilter.value
        ? currentFilter.value
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
        : undefined
    })

    if (isRefresh) {
      orderList.value = res.orderList
    } else {
      orderList.value = [...orderList.value, ...res.orderList]
    }

    totalOrders.value = res.total
    noMore.value = orderList.value.length >= res.total
  } catch (error) {
    console.error("获取订单列表失败", error)
    Taro.showToast({
      title: "获取订单列表失败",
      icon: "none"
    })
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

// 加载更多
const onLoadMore = () => {
  if (loading.value || noMore.value) return
  currentPage.value++
  fetchOrders()
}

// 刷新
const onRefresh = () => {
  refresh()
}

const refresh = () => {
  if (loading.value || refreshing.value) return
  fetchOrders(true)
}

// 跳转到订单详情
const goToOrderDetail = (orderId: string) => {
  // 根据订单ID查找对应的订单信息
  const order = orderList.value.find(o => o.id === orderId)

  if (!order) {
    Taro.navigateTo({
      url: `/pages/product/detail/index?id=${orderId}`
    })
    return
  }

  // 预约课程页面只显示有服务状态的订单，根据serviceStatus判断
  // serviceStatus: 服务状态 - pending待预约, success已预约, completed已出行

  if (order.serviceStatus === "success") {
    // 已预约状态，跳转到已预约页面
    Taro.navigateTo({
      url: `/pages/order/appointed/index?orderId=${orderId}&from=appointment`
    })
  } else if (order.serviceStatus === "completed") {
    // 已出行状态，跳转到已完成页面
    Taro.navigateTo({
      url: `/pages/order/completed/index?orderId=${orderId}&from=appointment`
    })
  } else {
    // 待预约状态(serviceStatus === "pending")
    // 多日营没预约上属于异常情况，直接跳转到预约异常页面
    if (order.goodType === "multi") {
      Taro.navigateTo({
        url: `/pages/order/appointment-abnormal/index?orderId=${orderId}&from=appointment`
      })
    } else {
      // 单日营待预约，跳转到待预约页面
      Taro.navigateTo({
        url: `/pages/order/pending-appointment/index?orderId=${orderId}&from=appointment`
      })
    }
  }
}

// 使用新的API代替已废弃的getSystemInfoSync
const safeAreaBottom = ref(0)
const windowInfo = Taro.getWindowInfo()
safeAreaBottom.value = windowInfo.safeArea
  ? windowInfo.screenHeight - windowInfo.safeArea.bottom
  : 0

onMounted(() => {
  fetchBannerData()
})

useDidShow(() => {
  fetchOrders(true)
})
</script>

<style lang="less">
.appointment-container {
  // background-image: url("../../assets/navBar-bg.png");
  background-repeat: no-repeat;
  background-color: #f7f7f9;

  &::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 217px;
    height: 570px;
    background-image: url("https://fp.yangcong345.com/middle/1.0.0/reservation-bg__w.png");
    background-repeat: no-repeat;
    background-size: 100% 100%;
  }

  .banner-swiper {
    width: 686px;
    height: 296px;
    border-radius: 16px;
    margin: 32px auto 0 auto;

    .banner-image {
      width: 100%;
      height: 100%;
      border-radius: 16px;
    }
  }

  .order-section {
    padding: 32px 32px 0 32px;

    .order-header {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 32px;

      .filter {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

        .filter-text {
          font-size: 28px;
          color: #666666;
          margin-right: 8px;
        }

        .filter-icon {
          width: 24px;
          height: 24px;
        }
      }
    }
  }
}
</style>
