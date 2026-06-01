<template>
  <view class="coupon-container" :class="{ horizontal: horizontal }">
    <view class="coupon-card" :class="{ disabled: disabled }" :data-type="type">
      <!-- 左侧折扣区域 -->
      <view class="discount-section">
        <!-- 优惠券类型标签 -->
        <view v-if="typeLabel" class="coupon-type-label">{{ typeLabel }}</view>
        <view class="discount-amount">
          <text class="currency">¥</text>
          <text class="amount">{{ amount }}</text>
        </view>
        <view class="discount-desc">{{ thresholdText }}</view>
      </view>
      <!-- 右侧详情区域 -->
      <view class="detail-section">
        <view class="detail-section-content">
          <view class="coupon-title">{{ title }}</view>
          <view class="expire-info">
            <view v-if="effectiveTime" class="expire-label">生效时间: {{ effectiveTime }}</view>
            <view class="expire-label">到期时间: {{ expireTime }}</view>
          </view>
        </view>
      </view>
      <!-- 按钮 -->
      <view class="action-button-container" :class="{ disabled: disabled }" @tap="handleClaim">
        <OiButton type="default" theme="yellow" size="small" round>{{ buttonText }}</OiButton>
      </view>
    </view>
  </view>
</template>

<script setup>
import OiButton from "../Ui/button/index.vue"

// 定义 props
const props = defineProps({
  // 优惠券金额
  amount: {
    type: [String, Number],
    default: "30"
  },
  // 门槛描述
  thresholdText: {
    type: String,
    default: "无门槛使用"
  },
  // 优惠券标题
  title: {
    type: String,
    default: "新用户券"
  },
  // 生效时间
  effectiveTime: {
    type: String
  },
  // 到期时间
  expireTime: {
    type: String
  },
  // 按钮文字
  buttonText: {
    type: String,
    default: "立即领取"
  },
  // 是否禁用
  disabled: {
    type: Boolean,
    default: false
  },
  // 优惠券类型
  type: {
    type: String,
    default: "common",
    validator: value => ["common", "good"].includes(value)
  },
  // 优惠券类型标签
  typeLabel: {
    type: String,
    default: ""
  },
  // 是否横向布局
  horizontal: {
    type: Boolean,
    default: false
  }
})

// 定义 emits
const emit = defineEmits(["claim", "click"])

// 处理领取按钮点击
const handleClaim = () => {
  if (props.disabled) return

  emit("claim", {
    amount: props.amount,
    title: props.title,
    type: props.type
  })

  emit("click", {
    amount: props.amount,
    title: props.title,
    type: props.type
  })
}
</script>

<style lang="less">
// === Variables ===
@color-bg: #ffffff;
@color-text-main: #333333;
@color-text-sub: #666666;
@color-text-light: #999999;
@color-divider: #e0e0e0;
@color-divider-bg: #f7f7f9;

@radius-md: 16rpx;
@radius-lg: 24rpx;

@shadow-card: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
@shadow-btn: 0 2rpx 8rpx rgba(255, 215, 0, 0.3);
@shadow-btn-active: 0 1rpx 4rpx rgba(255, 215, 0, 0.2);

@font-lg: 32rpx;
@font-md: 28rpx;
@font-sm: 24rpx;

// === Mixins ===
.flex-center(@dir: row) {
  display: flex;
  flex-direction: @dir;
  align-items: center;
  justify-content: center;
}

.button-style(@bg, @shadow) {
  background: @bg;
  border-radius: @radius-lg;
  padding: 16rpx 32rpx;
  .flex-center();
  min-width: 120rpx;
  box-shadow: @shadow;
  transition: all 0.3s ease;

  &:active {
    transform: scale(0.95);
    box-shadow: @shadow-btn-active;
  }
}

// === Coupon Container ===
.coupon-container {
  padding: 24rpx 32rpx;

  &.horizontal {
    padding: 0;
    flex-shrink: 0;

    .coupon-card {
      height: 184rpx;
      min-height: 184rpx;
      align-items: center;
    }
  }
}

// === Coupon Card ===
.coupon-card {
  display: flex;
  background: @color-bg;
  border-radius: @radius-md;
  overflow: hidden;
  box-shadow: @shadow-card;
  position: relative;

  &.disabled {
    opacity: 0.6;
  }

  // 类型样式
  &[data-type="common"] {
    .discount-section {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);

      .coupon-type-label {
        background: #ff8c00;
        color: #ffffff;
        box-shadow: 0 4rpx 8rpx rgba(255, 140, 0, 0.3);
      }
    }
  }

  &[data-type="good"] {
    .discount-section {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);

      .coupon-type-label {
        background: #ff8c00;
        color: #ffffff;
        box-shadow: 0 4rpx 8rpx rgba(255, 140, 0, 0.3);
      }
    }
  }
}

// === Discount Section ===
.discount-section {
  .flex-center(column);
  padding: 32rpx 24rpx;
  min-width: 160rpx;
  position: relative;
  height: 100%;
  border: 1px solid #fff;
  border-right: 2px dashed rgba(250, 90, 101, 0.2);
  background: #fff5f6;

  &::before,
  &::after {
    content: "";
    position: absolute;
    right: -15rpx;
    width: 22rpx;
    height: 22rpx;
    background: @color-divider-bg;
    border-radius: 50%;
    border: 1px solid #fff;
  }

  &::before {
    bottom: -11rpx;
  }

  &::after {
    top: -11rpx;
  }

  .coupon-type-label {
    position: absolute;
    top: 0rpx;
    left: 0rpx;
    background: #feece4;
    color: #fea345;
    font-size: 24rpx;
    font-weight: 600;
    padding: 6rpx 15rpx;
    border-radius: 16rpx 0;
    line-height: 1;
  }

  .discount-amount {
    .flex-center();
    margin-bottom: 8rpx;
    color: #fa5a66;

    .currency {
      font-size: 28rpx;
      font-weight: 500;
      line-height: 1;
    }

    .amount {
      font-size: 48rpx;
      font-weight: 900;
      line-height: 1;
      margin-left: 4rpx;
    }
  }

  .discount-desc {
    font-size: 22rpx;
    color: #fa5a66;
    font-weight: 400;
    text-align: center;
    line-height: 1.2;
  }
}

// 横向时的折扣区域
.coupon-container.horizontal .discount-section {
  min-width: 196rpx;
  padding: 24rpx 16rpx;
}

// === Detail Section ===
.detail-section {
  flex: 1;
  padding-left: 24rpx;

  .detail-section-content {
    padding-top: 32rpx;
  }

  .coupon-title {
    width: 290rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 32rpx;
    font-weight: 600;
    color: #393548;
    margin-bottom: 24rpx;
    line-height: 1.2;
  }

  .expire-info {
    margin-bottom: 24rpx;
    color: #848096;
    font-size: 22rpx;
  }
}

// === Action Button ===
.action-button-container {
  padding-right: 32px;
}

// 横向按钮
.coupon-container.horizontal .action-button-container {
  min-width: 48rpx;
  align-self: center;
}
</style>
