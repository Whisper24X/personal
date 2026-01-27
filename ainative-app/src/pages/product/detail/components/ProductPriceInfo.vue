<template>
  <view class="price-product-module">
    <view class="price-section">
      <view class="price-row">
        <view class="price">
          <text class="price-after"
            >券后价<text class="price-after-symbol">¥</text
            ><text class="price-after-value">{{ displayPrice }}</text></text
          >
          <text class="price-before"
            >优惠前 <text class="price-before-symbol">¥</text
            ><text class="price-before-value">{{ originalPrice }}</text></text
          >
        </view>
        <!-- <view class="sales-volume">销量{{ salesVolume }}</view> -->
      </view>
      <view class="product-name">{{ productName }}</view>
    </view>

    <view v-if="coupons.length > 0" class="coupon-section">
      <view class="coupon-label">优惠券</view>
      <view class="coupon-tags">
        <view v-for="(coupon, index) in coupons" :key="index" class="coupon-tag">
          {{ coupon }}
        </view>
      </view>
      <view class="claim-btn" @tap="handleClaimCoupon">领券</view>
    </view>
  </view>
</template>

<script>
import { defineComponent, computed, ref, watch } from "vue"
import { formatPrice, centsToYuan } from "@/utils/formatPrice"
import { getCouponList } from "@/pages/coupon/service"
export default defineComponent({
  name: "ProductPriceInfo",
  props: {
    type: {
      type: String,
      default: "order"
    },
    goodInfo: {
      type: Object,
      default: () => null
    },
    orderInfo: {
      type: Object,
      default: () => null
    }
  },
  emits: ["claim-coupon"],
  setup(props, { emit }) {
    const couponList = ref([])

    const originalPrice = computed(() => {
      // 原价是商品价格(分转元)
      return formatPrice(centsToYuan(props.goodInfo?.price || 0))
    })

    const displayPrice = computed(() => {
      // 券后价 = 原价 - 最大优惠券金额
      const originalPriceValue = centsToYuan(props.goodInfo?.price || 0)
      const maxDiscountAmount = Math.max(
        ...couponList.value.map(coupon => coupon.discountAmount || 0),
        0
      )
      const finalPrice = originalPriceValue - maxDiscountAmount

      return props.type === "product"
        ? formatPrice(Math.max(finalPrice, 0)) // 确保价格不为负数
        : formatPrice(centsToYuan(props.orderInfo?.orderPrice || 0))
    })

    const productName = computed(() => {
      return props.goodInfo?.name || ""
    })

    // const salesVolume = computed(() => {
    //   // 模拟销量，实际项目中应该从商品信息中获取
    //   return 888
    // })

    const coupons = computed(() => {
      // 根据优惠券列表生成显示文本，只显示金额最大的两张券
      const sortedCoupons = [...couponList.value]
        .sort((a, b) => (b.discountAmount || 0) - (a.discountAmount || 0))
        .slice(0, 2) // 只取前两张（金额最大的两张）

      return sortedCoupons.map(coupon => {
        const minAmount = coupon.minAmount || 0
        const discountAmount = coupon.discountAmount || 0
        if (minAmount > 0) {
          return `满${minAmount}减${discountAmount}`
        } else {
          return `无门槛减${discountAmount}`
        }
      })
    })

    // 获取商品可用的优惠券列表
    const fetchCouponList = async goodId => {
      if (!goodId) return
      try {
        const res = await getCouponList({ goodId })
        if (res && res.list) {
          couponList.value = res.list
        }
      } catch (error) {
        console.error("获取优惠券列表失败:", error)
      }
    }

    // 监听商品信息变化，获取优惠券列表
    watch(
      () => props.goodInfo,
      newGoodInfo => {
        if (newGoodInfo && newGoodInfo.id) {
          fetchCouponList(newGoodInfo.id)
        }
      },
      { immediate: true }
    )

    const handleClaimCoupon = () => {
      emit("claim-coupon")
    }

    return {
      originalPrice,
      displayPrice,
      productName,
      // salesVolume,
      coupons,
      handleClaimCoupon
    }
  }
})
</script>

<style lang="less">
.price-product-module {
  position: relative;
  z-index: 2;
  padding: 32rpx;
  border-radius: 24px 24px 0px 0px;
  background: #fff;
  margin-top: -70px;

  .price-section {
    margin-bottom: 36rpx;

    .price-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 32rpx;
      align-items: flex-end;

      .price {
        .price-after {
          font-family: PingFang SC;
          font-size: 28px;
          line-height: 28px;
          color: #fa5a65;

          .price-after-symbol {
            margin-left: 8px;
            font-family: AlibabaPuHuiTi_2_105_Heavy;
            font-size: 28px;
          }

          .price-after-value {
            font-family: AlibabaPuHuiTi_2_105_Heavy;
            line-height: 58px;
            font-size: 58px;
          }
        }

        .price-before {
          margin-left: 24px;
          font-family: "PingFang SC", sans-serif;
          font-size: 28rpx;
          color: #848096;

          .price-before-symbol {
            font-size: 28rpx;
          }

          .price-before-value {
            font-size: 28rpx;
          }
        }
      }

      .sales-volume {
        font-family: "PingFang SC", sans-serif;
        font-size: 28rpx;
        color: #848096;
      }
    }

    .product-name {
      font-family: PingFang SC;
      font-size: 36px;
      font-weight: 600;
      line-height: 36px;
      letter-spacing: 0em;
      color: #393548;
    }
  }

  .coupon-section {
    display: flex;
    align-items: center;
    gap: 16rpx;

    .coupon-label {
      font-family: PingFang SC;
      font-size: 28px;
      font-weight: normal;
      line-height: 28px;
      letter-spacing: 0em;
      color: #393548;
    }

    .coupon-tags {
      display: flex;
      gap: 16rpx;
      flex: 1;
      overflow-x: auto;
      overflow-y: hidden;
      // 隐藏滚动条
      &::-webkit-scrollbar {
        display: none;
      }
      -ms-overflow-style: none;
      scrollbar-width: none;

      .coupon-tag {
        position: relative;
        padding: 11rpx 20rpx 13rpx 20rpx;
        background: rgba(250, 90, 101, 0.1);
        height: 48px;
        border-radius: 6px;
        font-family: PingFang SC;
        font-size: 24px;
        font-weight: 600;
        line-height: 24px;
        letter-spacing: 0em;
        color: #fa5a65;
        white-space: nowrap; // 文字不换行
        flex-shrink: 0; // 防止被压缩

        //左右增加两个向里面凹陷的半圆
        &::before {
          content: "";
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          left: -8px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
        }

        &::after {
          content: "";
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          right: -8px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
        }
      }
    }

    .claim-btn {
      height: 56rpx;
      border-radius: 8rpx;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 14rpx 32rpx;
      background: #fa5a65;
      font-family: PingFang SC;
      font-size: 28rpx;
      font-weight: 600;
      line-height: 28rpx;
      color: #fff;
    }
  }
}
</style>
