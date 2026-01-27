<template>
  <FixedBottomBar v-if="shouldShowButtons">
    <view class="btn-container">
      <!-- 商品页面布局：分享、客服 + 立即预订 -->
      <template v-if="type === 'product'">
        <view class="left-actions">
          <view class="action-item" @tap="handleShare">
            <image
              class="action-icon"
              src="https://fp.yangcong345.com/middle/yanxue/share-outline-f79ccf95d755dc5f801eaee77fca191e.png"
            />
            <text class="action-text">分享</text>
          </view>
          <view class="action-item" @tap="handleCustomerService">
            <image
              class="action-icon"
              src="https://fp.yangcong345.com/middle/1.0.0/customer@1x-69f784376a5f611bd44e649e2a01c767.png"
            />
            <text class="action-text">客服</text>
          </view>
        </view>
        <UiButton
          v-if="showBookBtn"
          theme="yellow"
          size="huge"
          type="default"
          :round="true"
          class="book-btn product-book-btn"
          @tap="handleBookNow('product')"
        >
          立即预订
        </UiButton>
      </template>

      <!-- 订单页面布局：保持原有逻辑 -->
      <template v-else>
        <UiButton
          v-if="showBookBtn"
          theme="yellow"
          size="huge"
          shadow="true"
          type="default"
          :round="true"
          class="book-btn"
          @tap="handleBookNow('order')"
        >
          立即预约
        </UiButton>
        <UiButton
          v-else-if="type === 'order'"
          theme="yellow"
          size="huge"
          shadow="true"
          type="default"
          :round="true"
          class="book-btn"
          @tap="handleBookRecord"
        >
          预约记录
        </UiButton>
      </template>
    </view>
  </FixedBottomBar>
</template>

<script>
import { defineComponent, computed } from "vue"
import FixedBottomBar from "@/components/FixedBottomBar.vue"
import UiButton from "@/components/Ui/button/index.vue"

export default defineComponent({
  name: "ProductActionButtons",
  components: {
    FixedBottomBar,
    UiButton
  },
  props: {
    type: {
      type: String,
      default: "order"
    },
    showBookBtn: {
      type: Boolean,
      default: false
    },
    orderInfo: {
      type: Object,
      default: () => null
    }
  },
  emits: ["book-now", "book-record", "share", "customer-service"],
  setup(props, { emit }) {
    const REFUNDED_STATUS = "refunded"

    const shouldShowButtons = computed(() => {
      return props.type === "product" || props.orderInfo?.status !== REFUNDED_STATUS
    })

    const handleBookNow = type => {
      emit("book-now", type)
    }

    const handleBookRecord = () => {
      emit("book-record")
    }

    const handleShare = () => {
      emit("share")
    }

    const handleCustomerService = () => {
      emit("customer-service")
    }

    return {
      shouldShowButtons,
      handleBookNow,
      handleBookRecord,
      handleShare,
      handleCustomerService
    }
  }
})
</script>

<style lang="less">
.btn-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 40rpx;

  // 商品页面布局
  .left-actions {
    display: flex;
    gap: 48rpx;

    .action-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8rpx;

      .action-icon {
        width: 48rpx;
        height: 48rpx;
      }

      .action-text {
        font-family: "PingFang SC", sans-serif;
        font-size: 24rpx;
        font-weight: 400;
        line-height: 32rpx;
        color: #848096;
      }
    }
  }

  .book-btn {
    width: 686rpx;
    height: 88rpx;
  }

  .product-book-btn {
    width: 232rpx;
  }
}
</style>
