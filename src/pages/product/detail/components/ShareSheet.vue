<template>
  <OISheet
    :show="show"
    title="立即分享给朋友"
    :safe-area="true"
    :mask-click-close="true"
    @click-close="handleClose"
  >
    <view class="share-options">
      <button class="share-item share-button" open-type="share">
        <view class="share-icon wechat-icon">
          <image
            src="https://fp.yangcong345.com/middle/yanxue/wx-3b178e86afde68c60deccae58a7f9588.png"
            mode="aspectFit"
          />
        </view>
        <text class="share-text">微信好友</text>
      </button>
      <view class="share-item" :class="{ generating: isGenerating }" @tap="handleMomentsShare">
        <view class="share-icon poster-icon">
          <image
            src="https://fp.yangcong345.com/middle/yanxue/hb-604dacb9a390291d92c79205631b9597.png"
            mode="aspectFit"
          />
        </view>
        <text class="share-text">{{ isGenerating ? "生成中..." : "生成海报" }}</text>
      </view>
    </view>
  </OISheet>

  <!-- 海报生成组件 -->
  <PosterGenerator
    ref="posterGeneratorRef"
    :show="isGenerating"
    :good-info="goodInfo"
    :order-info="orderInfo"
    :user-info="userInfo"
    :type="type"
    :order-id="orderId"
    @start="handlePosterStart"
    @success="handlePosterSuccess"
    @error="handlePosterError"
    @complete="handlePosterComplete"
  />
</template>

<script setup>
import { ref, computed } from "vue"
import Taro, { useLoad, useShareAppMessage, useShareTimeline } from "@tarojs/taro"
import OISheet from "@/components/Ui/sheet/index.vue"
import PosterGenerator from "./PosterGenerator.vue"
import { PAGE_TYPES } from "../constants"
import { centsToYuan } from "@/utils/formatPrice"

// 定义 props
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  goodInfo: {
    type: Object,
    default: () => null
  },
  orderInfo: {
    type: Object,
    default: () => null
  },
  type: {
    type: String,
    default: PAGE_TYPES.ORDER
  },
  orderId: {
    type: String,
    default: ""
  },
  userInfo: {
    type: Object,
    default: () => null
  }
})

// 定义 emits
const emit = defineEmits(["close", "share-success", "share-error"])

// 响应式数据
const isGenerating = ref(false)
const posterGeneratorRef = ref(null)

// 页面类型判断
const isProductType = computed(() => props.type === PAGE_TYPES.PRODUCT)
const isOrderType = computed(() => props.type === PAGE_TYPES.ORDER)

const handleClose = () => {
  emit("close")
}

// 微信分享
const handleWeChatShare = () => {
  // 使用 open-type="share" 的按钮会自动触发分享
  console.log("微信分享按钮被点击")
  emit("share-success", "wechat")
}

// 生成海报并分享到朋友圈
const handleMomentsShare = async () => {
  if (isGenerating.value) return

  console.log("🎨 开始生成海报")

  try {
    if (!posterGeneratorRef.value) {
      throw new Error("海报生成器组件引用不存在")
    }

    // 调用海报生成器生成海报
    const posterPath = await posterGeneratorRef.value.generatePoster()

    // 显示分享菜单
    wx.showShareImageMenu({
      path: posterPath,
      success: () => {
        console.log("✅ 海报分享成功")
        emit("share-success", "moments")
      },
      fail: err => {
        console.error("❌ 海报分享失败:", err)
        Taro.showToast({
          title: "分享失败",
          icon: "error"
        })
        emit("share-error", err)
      }
    })
  } catch (error) {
    console.error("❌ 生成海报失败:", error)
    emit("share-error", error)
  }
}

// 海报生成开始
const handlePosterStart = () => {
  console.log("🎨 海报生成开始")
  Taro.showLoading({
    title: "生成海报中..."
  })
}

// 海报生成成功
const handlePosterSuccess = posterPath => {
  console.log("✅ 海报生成成功:", posterPath)
  Taro.hideLoading()
}

// 海报生成失败
const handlePosterError = error => {
  console.error("❌ 海报生成失败:", error)
  Taro.hideLoading()

  Taro.showToast({
    title: `生成失败: ${error.message}`,
    icon: "error",
    duration: 3000
  })
}

// 海报生成完成
const handlePosterComplete = () => {
  console.log("🏁 海报生成流程完成")
  isGenerating.value = false
}

// 页面加载
useLoad(() => {
  // 默认开启分享菜单，并开启ShareTicket
  wx.showShareMenu({
    withShareTicket: true,
    menus: ["shareAppMessage", "shareTimeline"],
    success() {
      console.log("share menu shown")
    },
    fail() {
      console.log("share menu failed")
    },
    complete() {
      console.log("share menu complete")
    }
  })
})

// 微信分享配置
useShareAppMessage(() => {
  console.log("useShareAppMessage")
  const shareTitle = props.goodInfo?.name || "商品详情"
  const shareDesc = `¥${
    isProductType.value
      ? centsToYuan(props.goodInfo?.price || 0)
      : centsToYuan(props.orderInfo?.orderPrice || 0)
  } - ${props.goodInfo?.name}`
  const shareImageUrl = props.goodInfo?.mainImage?.[0] || ""

  return {
    title: shareTitle,
    desc: shareDesc,
    path: `/pages/product/detail/index?id=${props.orderId}&type=${props.type}`,
    imageUrl: shareImageUrl
  }
})

// 朋友圈分享配置
useShareTimeline(() => {
  console.log("useShareTimeline")
  const shareTitle = props.goodInfo?.name || "商品详情"
  const shareImageUrl = props.goodInfo?.mainImage?.[0] || ""

  return {
    title: shareTitle,
    path: `id=${props.orderId}&type=${props.type}`,
    imageUrl: shareImageUrl
  }
})
</script>

<style lang="less">
// 分享弹框样式
.share-options {
  position: relative;
  z-index: 999;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 66rpx 32rpx;
  background-color: #f7f7f9;

  .share-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;

    .share-icon {
      width: 88rpx;
      height: 88rpx;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16rpx;

      image {
        width: 88rpx;
        height: 88rpx;
      }

      &.wechat-icon {
        background-color: #07c160;
      }

      &.moments-icon {
        background-color: #07c160;
      }

      &.poster-icon {
        background-color: #ffffff;
      }
    }

    .share-text {
      font-size: 24rpx;
      color: #333333;
      text-align: center;
    }
  }

  // Button 组件样式重置
  .share-button {
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    border-radius: 0;
    font-size: inherit;
    line-height: inherit;
    color: inherit;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;

    &::after {
      border: none;
    }

    &:active {
      background: transparent;
    }
  }
}

// 分享提示样式
.share-tips {
  padding: 20rpx 32rpx;
  text-align: center;
  background-color: #f8f9fa;
  border-top: 1rpx solid #e9ecef;

  .tips-text {
    font-size: 24rpx;
    color: #6c757d;
    line-height: 1.4;
  }
}

// 生成状态样式
.generating {
  opacity: 0.6;
  pointer-events: none;
}
</style>
