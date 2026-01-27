<template>
  <scroll-view
    class="order-list"
    :scroll-y="true"
    :show-scrollbar="false"
    :enhanced="true"
    :refresher-enabled="true"
    :refresher-triggered="refreshing"
    :refresher-threshold="pullThreshold"
    @scrolltolower="onScrollToLower"
    @refresherrefresh="onRefresherRefresh"
  >
    <!-- 使用scroll-view的内置刷新器，不再需要自定义下拉容器 -->

    <view v-if="orders.length === 0 && !loading && !refreshing" class="empty-list">
      <image
        class="empty-list-icon"
        src="https://fp.yangcong345.com/middle/1.0.0/yanxueImg/empty230*160__w.png"
        alt="暂无订单数据"
      />
      <view class="empty-list-text">暂无订单数据</view>
    </view>

    <view
      v-for="order in orders"
      :key="order.id"
      class="order-item"
      @tap="handleOrderClick(order.id || '')"
    >
      <view class="order-info-left">
        <view class="order-number">订单号：{{ order.orderNumber }}</view>
        <view class="order-name">{{ order.goodName }}</view>
      </view>
      <view class="order-info-right">
        <view class="order-status" :class="getDisplayStatus(order).toLowerCase()">
          {{ getStatusText(order) }}
        </view>
        <view class="order-price">
          <span class="order-price-symbol">¥</span>{{ formatPriceFromCents(order.orderPrice) }}
        </view>
      </view>
    </view>

    <view v-if="loading && !refreshing" class="load-tip">加载中...</view>
    <view v-if="noMore && orders.length > 0" class="load-tip">没有更多了</view>
  </scroll-view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro from "@tarojs/taro"
import type { OrderInfo } from "@/api/order"
import { OrderStatus } from "@/api/order"
import { getStatusBarHeight } from "@/utils/statusBar"
import { formatPriceFromCents } from "@/utils/formatPrice"

// 定义组件属性
const props = defineProps<{
  orders: OrderInfo[]
  loading: boolean
  refreshing: boolean
  noMore: boolean
  hasFilterTabs: boolean
}>()

// 定义事件
const emit = defineEmits<{
  "load-more": []
  refresh: []
  "order-click": [orderId: string]
}>()

const pullThreshold = 60 // 下拉阈值，超过这个值松手后会触发刷新

// 设备信息相关
const statusBarHeight = getStatusBarHeight()
const scrollViewHeight = ref("100%")

// 计算scroll-view的高度
const calculateScrollViewHeight = () => {
  // 获取系统信息
  const systemInfo = Taro.getSystemInfoSync()
  const windowHeight = systemInfo.windowHeight
  const windowWidth = systemInfo.windowWidth

  // 计算rpx与px的转换比例
  const rpxToPxRatio = windowWidth / 750

  // 计算顶部区域高度
  // 状态栏高度
  const statusBarHeightPx = statusBarHeight
  // 导航栏高度(88rpx)
  const navBarHeightPx = 88 * rpxToPxRatio
  // 筛选区域高度(padding: 32rpx + 下拉框高度约60rpx = 92rpx)
  const filterSectionHeightPx = props.hasFilterTabs ? 92 * rpxToPxRatio : 0

  // 顶部总高度
  const topAreaHeightPx = statusBarHeightPx + navBarHeightPx + filterSectionHeightPx

  // 计算scroll-view的高度
  const scrollHeightPx = windowHeight - topAreaHeightPx

  // 设置scroll-view的高度
  scrollViewHeight.value = `${scrollHeightPx}px`

  // 调试信息
  console.log("计算的scroll-view高度:", {
    windowHeight,
    statusBarHeight: statusBarHeightPx,
    navBarHeight: navBarHeightPx,
    filterSectionHeight: filterSectionHeightPx,
    finalHeight: scrollHeightPx
  })
}

// 监听窗口大小变化
onMounted(() => {
  calculateScrollViewHeight()
  // 监听窗口大小变化
  Taro.onWindowResize(() => {
    calculateScrollViewHeight()
  })
})

// 获取要显示的状态值（直接使用status）
const getDisplayStatus = (order: OrderInfo): string => {
  return order.status || ""
}

// 订单状态处理
const getStatusText = (order: OrderInfo) => {
  const displayStatus = getDisplayStatus(order)

  switch (displayStatus) {
    case OrderStatus.PENDING_PAYMENT:
      return "待付款"
    case OrderStatus.PENDING:
      return "支付成功"
    case OrderStatus.CLOSED:
      return "交易关闭"
    case OrderStatus.REFUNDED:
      return "已退款"
    case OrderStatus.REFUNDING:
      return "退款中"
    case OrderStatus.FAILED_REFUND:
      return "退款失败"
    default:
      return displayStatus
  }
}

// 点击订单
const handleOrderClick = (orderId: string) => {
  emit("order-click", orderId)
}

// scroll-view的刷新事件处理
const onRefresherRefresh = () => {
  emit("refresh")
}

// 滚动到底部加载更多
const onScrollToLower = () => {
  if (!props.loading && !props.noMore) {
    emit("load-more")
  }
}
</script>

<style lang="less">
// 订单列表
.order-list {
  height: v-bind(scrollViewHeight);
  position: relative;
  box-sizing: border-box;
  padding: 0 32rpx 32rpx 32rpx;

  // 加载提示
  .load-tip {
    text-align: center;
    color: #888;
    padding: 20rpx 0;
    font-size: 28rpx;
  }

  // 空列表提示
  .empty-list {
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;

    .empty-list-icon {
      width: 460rpx;
      height: 320rpx;
    }

    .empty-list-text {
      font-family: "苹方-简", sans-serif;
      font-size: 28rpx;
      font-weight: normal;
      line-height: 36rpx;
      text-align: center;
      letter-spacing: normal;
      color: #504b64;
    }
  }

  // 订单项
  .order-item {
    border-radius: 16rpx;
    background: #fff;
    margin-bottom: 24rpx;
    height: 232rpx;
    padding: 40rpx 32rpx;
    display: flex;
    justify-content: space-between;
    position: relative;
    font-family: "PingFang SC", sans-serif;

    // 订单信息
    .order-info-left {
      flex: 1;
      min-width: 0;

      .order-number {
        max-width: 500rpx;
        font-size: 24rpx;
        font-weight: normal;
        line-height: 24rpx;
        letter-spacing: normal;
        color: #848096;
        margin-bottom: 32rpx;
      }

      .order-name {
        font-size: 36rpx;
        font-weight: 600;
        line-height: 36rpx;
        letter-spacing: normal;
        color: #393548;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .order-info-right {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-end;
      margin-left: 24rpx;

      // 订单状态
      .order-status {
        min-width: 96rpx;
        height: 46rpx;

        /* 自动布局 */
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 12rpx 16rpx;
        border-radius: 4rpx;
        background: #fff3e0;
        font-family: "PingFang SC", sans-serif;
        font-size: 22rpx;
        font-weight: normal;
        line-height: 22rpx;
        letter-spacing: -1rpx;

        &.pendingpayment {
          color: #f57927;
          background: #fff3e0;
        }

        &.pending {
          color: #38b89a;
          background: #e6faef;
        }

        &.success {
          color: #518aff;
          background: #eaf1ff;
        }

        &.completed {
          color: #38b89a;
          background: #e6faef;
        }

        &.refunded {
          color: #504b64;
          background: #f7f7f9;
        }
        &.refunding {
          color: #fa5a65;
          background: #fae6e6;
        }
        &.failedrefund {
          color: #fa5a65;
          background: #fae6e6;
        }

        &.closed {
          color: #999999;
          background: #f5f5f5;
        }
      }

      .order-price {
        // font-family: "AlibabaPuHuiTi_2_115_Black", sans-serif;
        font-weight: 900;
        font-size: 40rpx;
        color: #393548;

        .order-price-symbol {
          font-weight: 600;
          font-size: 32rpx;
          font-family: "PingFang SC", sans-serif;
        }
      }
    }
  }
}
</style>
