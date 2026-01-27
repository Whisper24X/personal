<template>
  <TabBarLayout
    tab-key="order"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{
      title: '我的订单',
      theme: 'light',
      showBack: true
    }"
    :custom-back="handleBack"
  >
    <view class="order-list-page">
      <!-- 筛选区域 -->
      <view class="filter-section">
        <FilterDropdown v-model="currentFilter" :options="filterOptions" @change="changeFilter" />
      </view>

      <!-- 订单列表组件 -->
      <MyOrderList
        :orders="orderList"
        :loading="loading"
        :refreshing="refreshing"
        :no-more="noMore"
        :has-filter-tabs="true"
        @load-more="onLoadMore"
        @refresh="onRefresh"
        @order-click="goToOrderDetail"
      />
    </view>
  </TabBarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro, { useDidShow } from "@tarojs/taro"
import { getOrderList } from "@/api/order"
import type { OrderInfo } from "@/api/order"
import MyOrderList from "./components/MyOrderList.vue"
import FilterDropdown from "@/components/FilterDropdown/index.vue"
import TabBarLayout from "@/components/TabBarLayout/index.vue"

// 获取路由参数
const router = Taro.useRouter()
const statusParam = router.params.status as string

// 筛选选项
const filterOptions = [
  { label: "全部订单", value: "" },
  { label: "待付款", value: "pendingPayment" },
  { label: "支付成功", value: "pending" },
  { label: "交易关闭", value: "closed" },
  { label: "已退款", value: "refunded" },
  { label: "退款中", value: "refunding,failedRefund" }
]

// 当前筛选条件，如果有路由参数则使用路由参数
const currentFilter = ref(statusParam || "")

// 订单列表数据
const orderList = ref<OrderInfo[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const refreshing = ref(false)
const noMore = ref(false)

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
      status: currentFilter.value
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

// 切换筛选
const changeFilter = () => {
  refresh()
}

// 加载更多
const onLoadMore = () => {
  if (loading.value || noMore.value) return
  currentPage.value++
  fetchOrders()
}

// 下拉刷新
const onRefresh = () => {
  refresh()
}

// 刷新
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

  // 优先根据订单支付状态(status)判断
  // status: 订单支付状态 - pendingPayment待支付, pending支付成功, closed订单关闭, refunded已退款, refunding退款中, failedRefund退款失败
  // 旧订单兼容: status也可能是 success(已预约), completed(已出行)

  if (order.status === "pendingPayment") {
    // 待付款状态，跳转到待付款页面
    Taro.navigateTo({
      url: `/pages/order/pending-payment/index?orderId=${orderId}`
    })
  } else if (order.status === "closed") {
    // 交易关闭状态，跳转到交易关闭页面
    Taro.navigateTo({
      url: `/pages/order/transaction-closed/index?orderId=${orderId}`
    })
  } else if (order.status === "refunded") {
    // 已退款状态，跳转到已退款页面
    Taro.navigateTo({
      url: `/pages/order/refunded/index?orderId=${orderId}`
    })
  } else if (["refunding", "failedRefund"].includes(order.status)) {
    // 退款中和退款失败，都跳转到退款中页面
    Taro.navigateTo({
      url: `/pages/order/refunding/index?orderId=${orderId}`
    })
  } else if (order.status === "pending") {
    // 支付成功，根据服务状态(serviceStatus)判断
    // serviceStatus: 服务状态 - pending待预约, success已预约, completed已出行

    if (order.serviceStatus === "success") {
      // 已预约状态，跳转到已预约页面
      Taro.navigateTo({
        url: `/pages/order/appointed/index?orderId=${orderId}&from=order`
      })
    } else if (order.serviceStatus === "completed") {
      // 已出行状态，跳转到已完成页面
      Taro.navigateTo({
        url: `/pages/order/completed/index?orderId=${orderId}&from=order`
      })
    } else {
      // 待预约状态(serviceStatus === "pending" 或无serviceStatus)
      // 多日营没预约上属于异常情况，直接跳转到预约异常页面
      if (order.goodType === "multi") {
        Taro.navigateTo({
          url: `/pages/order/appointment-abnormal/index?orderId=${orderId}&from=order`
        })
      } else {
        // 单日营待预约，跳转到待预约页面
        Taro.navigateTo({
          url: `/pages/order/pending-appointment/index?orderId=${orderId}&from=order`
        })
      }
    }
  } else if (order.status === "success") {
    // 旧订单兼容: status为success(已预约)，跳转到已预约页面
    Taro.navigateTo({
      url: `/pages/order/appointed/index?orderId=${orderId}&from=order`
    })
  } else if (order.status === "completed") {
    // 旧订单兼容: status为completed(已出行)，跳转到已完成页面
    Taro.navigateTo({
      url: `/pages/order/completed/index?orderId=${orderId}&from=order`
    })
  } else {
    // 其他状态，跳转到商品详情页面
    Taro.navigateTo({
      url: `/pages/product/detail/index?id=${orderId}`
    })
  }
}

// 处理返回按钮
const handleBack = () => {
  //切换到用户中心Tab
  Taro.switchTab({
    url: "/pages/user/profile/index"
  })
}

// 页面显示时刷新数据
useDidShow(() => {
  fetchOrders(true)
})

onMounted(() => {
  fetchOrders(true)
})
</script>

<style lang="less">
.order-list-page {
  background-color: #f7f7f9;

  // 筛选区域
  .filter-section {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 32rpx 32rpx;
    margin-bottom: 0;
  }
}
</style>
