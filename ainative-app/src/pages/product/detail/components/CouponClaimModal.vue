<template>
  <OlSheet title="领取优惠券" :show="show" :safe-area="true" @click-close="handleClose">
    <!-- 优惠券列表 -->
    <scroll-view class="coupon-list" :scroll-y="true" :show-scrollbar="false" :enhanced="true">
      <view v-if="loading" class="loading-container">
        <text class="loading-text">加载中...</text>
      </view>

      <view v-else-if="coupons.length === 0" class="empty-container">
        <text class="empty-text">暂无可领取的优惠券</text>
      </view>

      <view v-else class="coupon-items">
        <view
          v-for="coupon in coupons"
          :key="coupon.id"
          class="coupon-item"
          :class="{
            claimed: coupon.claimed,
            expired: isExpired(coupon),
            disabled: !coupon.isAllowClaim
          }"
        >
          <view class="coupon-left">
            <view class="coupon-amount-section">
              <text class="currency">¥</text>
              <text class="amount">{{ coupon.discountAmount || 0 }}</text>
            </view>
            <view class="coupon-threshold">
              {{ getThresholdText(coupon) }}
            </view>
          </view>

          <view class="coupon-right">
            <view class="coupon-info">
              <text class="coupon-name">{{ coupon.name || "优惠券" }}</text>
              <text class="coupon-time">到期时间：{{ getValidTimeText(coupon) }}</text>
            </view>

            <view
              class="claim-btn"
              :class="{
                claimed: coupon.claimed && coupon.receivedCount >= coupon.limitPerUser,
                expired: isExpired(coupon),
                disabled: !coupon.isAllowClaim
              }"
              @tap="handleClaimSingle(coupon)"
            >
              {{ getButtonText(coupon) }}
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </OlSheet>
</template>

<script>
import { defineComponent, ref, watch } from "vue"
import Taro from "@tarojs/taro"
import { getCouponList, claimCoupon } from "@/pages/coupon/service"
import OlSheet from "@/components/Ui/sheet/index.vue"
import { formatDateCustom } from "@/utils/formatDate"

export default defineComponent({
  name: "CouponClaimModal",
  components: {
    OlSheet
  },
  props: {
    show: {
      type: Boolean,
      default: false
    },
    goodId: {
      type: String,
      default: ""
    }
  },
  emits: ["update:show", "claim-success"],
  setup(props, { emit }) {
    const loading = ref(false)
    const coupons = ref([])

    // 获取优惠券列表
    const fetchCoupons = async () => {
      if (!props.goodId) return

      try {
        loading.value = true
        const res = await getCouponList({ goodId: props.goodId })
        if (res && res.list) {
          coupons.value = res.list.map(coupon => ({
            ...coupon,
            claimed: coupon.receivedCount > 0,
            isAllowClaim: true
          }))
        }
      } catch (error) {
        console.error("获取优惠券列表失败:", error)
        Taro.showToast({
          title: "获取优惠券失败",
          icon: "none"
        })
      } finally {
        loading.value = false
      }
    }

    // 监听弹窗显示状态
    watch(
      () => props.show,
      newShow => {
        if (newShow) {
          fetchCoupons()
        }
      }
    )

    // 关闭弹窗
    const handleClose = () => {
      emit("update:show", false)
    }

    // 判断优惠券是否过期
    const isExpired = coupon => {
      if (!coupon.claimEndTime) return false
      const endTime = new Date(coupon.claimEndTime).getTime()
      return Date.now() > endTime
    }

    // 获取门槛文本
    const getThresholdText = coupon => {
      const minAmount = coupon.minAmount || 0
      if (minAmount > 0) {
        return `满${minAmount}元可用`
      }
      return "无门槛使用"
    }

    // 获取有效期文本
    const getValidTimeText = coupon => {
      if (coupon.couponValidDays) {
        return `领取后${coupon.couponValidDays}天内有效`
      }
      if (coupon.validStartTime && coupon.validEndTime) {
        const end = formatDateCustom(coupon.validEndTime, "YYYY.MM.DD HH:mm")
        return `${end}`
      }
      return "长期有效"
    }

    // 获取按钮文本
    const getButtonText = coupon => {
      // 如果已领取且达到上限，显示"已领取"
      if (coupon.claimed && coupon.receivedCount >= coupon.limitPerUser) return "已领取"
      // 如果已领取但未达上限，显示"再次领取"
      if (coupon.claimed && coupon.receivedCount < coupon.limitPerUser) return "再次领取"
      if (isExpired(coupon)) return "已过期"
      if (!coupon.isAllowClaim) return "已抢光"
      return "立即领取"
    }

    // 领取单个优惠券
    const handleClaimSingle = async coupon => {
      // 检查是否可以领取
      // 如果已领取且达到上限，无法再领取
      if (coupon.claimed && coupon.receivedCount >= coupon.limitPerUser) {
        Taro.showToast({
          title: "该优惠券已领取完",
          icon: "none"
        })
        return
      }

      if (isExpired(coupon)) {
        Taro.showToast({
          title: "该优惠券已过期",
          icon: "none"
        })
        return
      }
      if (!coupon.isAllowClaim) {
        Taro.showToast({
          title: "该优惠券已抢光",
          icon: "none"
        })
        return
      }

      try {
        await claimCoupon(coupon.id)

        Taro.showToast({
          title: "领取成功",
          icon: "success"
        })

        // 领取成功后刷新优惠券列表
        await fetchCoupons()

        emit("claim-success", coupon)
      } catch (error) {
        console.error("领取优惠券失败:", error)

        Taro.showToast({
          title: error.message || "领取失败",
          icon: "none"
        })
      }
    }

    return {
      loading,
      coupons,
      handleClose,
      isExpired,
      getThresholdText,
      getValidTimeText,
      getButtonText,
      handleClaimSingle
    }
  }
})
</script>

<style lang="less">
.coupon-list {
  max-height: 1000rpx;
  overflow-y: auto;
}

.loading-container,
.empty-container {
  padding: 120rpx 0;
  text-align: center;

  .loading-text,
  .empty-text {
    font-size: 28rpx;
    color: #848096;
  }
}

.coupon-items {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  padding: 48rpx 32rpx;
}

.coupon-item {
  position: relative;
  display: flex;
  background: #ffffff;
  box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.1);
  border-radius: 20rpx;
  overflow: hidden;
  &.disabled {
    position: relative;
    &::before {
      content: "";
      position: absolute;
      top: 5rpx;
      right: 147rpx;
      width: 100rpx;
      height: 100rpx;
      background: url(https://fp.yangcong345.com/middle/1.0.0/outOfStock-77ed045ae6b2f388130607945d69462c__w.png)
        no-repeat center center;
      background-size: 100rpx 100rpx;
    }
  }

  .coupon-left {
    margin: 4rpx;
    border-radius: 20rpx 0 0 20rpx;
    width: 196rpx;
    padding: 34rpx 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgba(250, 90, 101, 0.06);
    border-right: 2px dashed rgba(250, 90, 101, 0.2);

    .coupon-amount-section {
      display: flex;
      align-items: baseline;
      margin-bottom: 16rpx;

      .currency {
        font-family: Avenir Next LT Pro;
        font-size: 28px;
        font-weight: 500;
        line-height: 28px;
        color: #fa5a65;
      }

      .amount {
        font-family: AlibabaPuHuiTi_2_105_Heavy;
        font-size: 48px;
        font-weight: 900;
        line-height: 48px;
        color: #fa5a65;
        margin-right: 4px;
      }
    }

    .coupon-threshold {
      font-family: PingFang SC;
      font-size: 22px;
      line-height: 30px;
      color: #fa5a65;
      text-align: center;
    }
  }

  .coupon-right {
    flex: 1;
    padding: 0 24rpx 0 32rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .coupon-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 24rpx;

      .coupon-name {
        //超过两行使用省略号
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        line-height: 1.3;
        font-family: PingFang SC;
        font-size: 32px;
        font-weight: 600;
        line-height: 32px;
        color: #393548;
      }

      .coupon-time {
        font-family: PingFang SC;
        font-size: 22px;
        font-weight: normal;
        line-height: 22px;
        color: #848096;
        line-height: 1.2;
      }
    }

    .claim-btn {
      margin-left: 16rpx;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 12px 24px;
      border-radius: 174px;
      background: #ffd633;
      font-family: PingFang SC;
      font-size: 24px;
      font-weight: 600;
      line-height: 24px;
      color: #393548;
      &.claimed,
      &.expired,
      &.disabled {
        color: #b8b4c7;
        background: #efeef3;
      }
    }
  }
  // 缺口样式 - 使用伪元素和径向渐变实现
  &::before,
  &::after {
    content: "";
    z-index: 1;
    position: absolute;

    border-radius: 50%;
    width: 22rpx;
    height: 22rpx;
    left: 189rpx;
    background: radial-gradient(circle at center, #f7f7f9 0, #f7f7f9 10rpx, transparent 10rpx);
  }

  &::before {
    transform: translateY(-50%);
    top: 0;
  }

  &::after {
    transform: translateY(50%);
    bottom: 0;
  }
}
</style>
