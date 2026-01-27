<template>
  <view class="good-info-section">
    <view class="good-card">
      <view class="good-image">
        <image v-if="goodInfo?.mainImage?.[0]" :src="goodInfo.mainImage[0]" mode="aspectFill" />
      </view>
      <view class="good-details">
        <view class="good-name">{{ goodInfo?.name }}</view>
        <view class="priceAndQuantity-section">
          <view v-if="showPrice" class="good-price">¥{{ centsToYuan(goodInfo?.price || 0) }}</view>
          <view v-if="showQuantitySelector" class="quantity-selector">
            <image
              class="quantity-btn"
              src="https://fp.yangcong345.com/middle/1.0.0/yanxue/icon-minus-4492e357a34bf34eb54e160132a3d421__w.png"
              @tap="decreaseQuantity"
            />
            <view class="quantity-value">{{ quantity }}</view>
            <image
              class="quantity-btn"
              src="https://fp.yangcong345.com/middle/1.0.0/yanxue/icon-add-84f7e4c9d56ce8673048177080ec3cfb__w.png"
              @tap="increaseQuantity"
            />
          </view>
        </view>
      </view>
    </view>
    <view v-if="showSkipAppointmentBtn" class="skip-appointment">
      <OIButton
        class="btn"
        type="hollow"
        round
        theme="white"
        border-color="black"
        @click="skipAppointment"
      >
        不预约直接购买
      </OIButton>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref, watch } from "vue"
import Taro from "@tarojs/taro"
import OIButton from "@/components/Ui/button/index.vue"
import { trackClick } from "@/utils/analytics"
import { centsToYuan } from "@/utils/formatPrice"

interface GoodInfo {
  id?: string
  name?: string
  mainImage?: string[]
  price?: number
}

interface Props {
  goodInfo?: GoodInfo | null
  showSkipAppointmentBtn?: boolean
  showPrice?: boolean
  showQuantitySelector?: boolean
  quantity?: number
}

const props = withDefaults(defineProps<Props>(), {
  goodInfo: null,
  showSkipAppointmentBtn: false,
  showPrice: false,
  showQuantitySelector: false,
  quantity: 1
})

const emit = defineEmits<{
  quantityChange: [quantity: number]
}>()

const quantity = ref(props.quantity)

watch(
  () => props.quantity,
  newVal => {
    quantity.value = newVal
  }
)

const decreaseQuantity = () => {
  if (quantity.value > 1) {
    quantity.value--
    emit("quantityChange", quantity.value)
  }
}

const increaseQuantity = () => {
  quantity.value++
  emit("quantityChange", quantity.value)
}

const skipAppointment = () => {
  if (props.goodInfo?.id) {
    trackClick("direct_buy")
    // 获取当前页面的优惠券ID参数
    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const userCouponId = currentPage.options?.userCouponId

    let query = `?goodId=${props.goodInfo.id}`
    if (userCouponId) {
      query += `&userCouponId=${userCouponId}`
    }
    Taro.navigateTo({
      url: `/pages/order/confirm-no-appointment/index${query}`
    })
  }
}
</script>

<style lang="less">
.good-info-section {
  margin-bottom: 32rpx;
  padding: 32rpx;
  background: #fff;
  border-radius: 24rpx;

  .good-card {
    display: flex;
    gap: 24rpx;

    .good-image {
      width: 160rpx;
      height: 120rpx;
      border-radius: 10rpx;
      overflow: hidden;

      image {
        width: 100%;
        height: 100%;
      }
    }

    .good-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      .good-name {
        width: 438rpx;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        font-family: PingFang SC;
        font-size: 32rpx;
        font-weight: 500;
        line-height: 48rpx;
        color: #393548;
        margin-top: 12rpx;
      }
      .priceAndQuantity-section {
        margin-top: 24rpx;
        display: flex;
        justify-content: space-between;
        align-items: center;
        .good-price {
          font-family: PingFang SC;
          font-size: 28px;
          font-weight: 600;
          line-height: 28px;
          color: #393548;
        }

        .quantity-selector {
          display: flex;
          align-items: center;

          .quantity-btn {
            width: 40rpx;
            height: 40rpx;
          }

          .quantity-value {
            width: 92rpx;
            text-align: center;
            font-family: PingFang SC;
            font-size: 28px;
            font-weight: 600;
            line-height: 28px;
            color: #3d3d3d;
          }
        }
      }
    }
  }
  .skip-appointment {
    margin-top: 32rpx;
    width: 100%;
    .btn {
      width: 100%;
      height: 72px;
    }
  }
}
</style>
