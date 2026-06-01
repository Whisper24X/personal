<template>
  <view class="poster-test-page">
    <view class="header">
      <text class="title">PosterGenerator 测试页面</text>
    </view>

    <view class="content">
      <!-- 加载中提示 -->
      <view v-if="isGenerating" class="loading-section">
        <text class="loading-text">正在生成海报...</text>
      </view>

      <!-- 海报预览 -->
      <view v-if="posterPath" class="preview-section">
        <text class="section-title">海报预览</text>
        <image class="poster-preview" :src="posterPath" mode="aspectFit" />
      </view>
    </view>

    <!-- PosterGenerator 组件 -->
    <PosterGenerator
      ref="posterGeneratorRef"
      :show="show"
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
  </view>
</template>

<script setup>
import { ref, onMounted, nextTick } from "vue"
import Taro from "@tarojs/taro"
import PosterGenerator from "@/pages/product/detail/components/PosterGenerator.vue"
import { PAGE_TYPES } from "@/pages/product/detail/constants"

// 响应式数据
const show = ref(false)
const isGenerating = ref(false)
const posterGeneratorRef = ref(null)
const posterPath = ref("")

// 测试数据
const goodInfo = ref({
  id: "test-product-001",
  name: "测试商品 - 研学旅行体验课程",
  price: "299.00",
  originalPrice: "399.00",
  ageRange: "8-15岁",
  mainImage: ["https://onionpad-cloud-control.yangcong345.com/good/main/wu先生-mhp33hu8__w__w.jpeg"]
})
const orderInfo = ref({
  orderPrice: "299.00",
  orderId: "test-order-001"
})
const userInfo = ref({
  id: "test-user-001",
  nickname: "测试用户",
  avatar: "https://fp.yangcong345.com/middle/1.0.0/26a/ha__w.png"
})
const type = ref(PAGE_TYPES.PRODUCT)
const orderId = ref("test-product-001")

// 生成海报
const handleGeneratePoster = async () => {
  if (!goodInfo.value && !orderId.value) {
    console.warn("商品信息或订单ID不存在，无法生成海报")
    return
  }

  if (!posterGeneratorRef.value) {
    console.warn("PosterGenerator 组件未初始化")
    return
  }

  try {
    // 确保组件显示
    if (!show.value) {
      show.value = true
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // 调用生成海报方法
    const path = await posterGeneratorRef.value.generatePoster()
    console.log("海报生成成功:", path)
  } catch (error) {
    console.error("生成海报失败:", error)
  }
}

// 海报生成开始
const handlePosterStart = () => {
  console.log("🎨 海报生成开始")
  isGenerating.value = true
  Taro.showLoading({
    title: "生成海报中...",
    mask: true
  })
}

// 海报生成成功
const handlePosterSuccess = path => {
  console.log("✅ 海报生成成功:", path)
  posterPath.value = path
  isGenerating.value = false
  Taro.hideLoading()
}

// 海报生成失败
const handlePosterError = error => {
  console.error("❌ 海报生成失败:", error)
  isGenerating.value = false
  Taro.hideLoading()
  Taro.showToast({
    title: `生成失败: ${error.message || "未知错误"}`,
    icon: "error",
    duration: 3000
  })
}

// 海报生成完成
const handlePosterComplete = () => {
  console.log("🏁 海报生成流程完成")
  isGenerating.value = false
}

// 页面加载时自动生成海报
onMounted(async () => {
  // 等待组件完全挂载
  await nextTick()

  // 等待一小段时间确保 PosterGenerator 组件已初始化
  setTimeout(async () => {
    await handleGeneratePoster()
  }, 1000)
})
</script>

<style lang="less">
.poster-test-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 40rpx;
}

.header {
  background-color: #fff;
  padding: 40rpx 32rpx;
  border-bottom: 1rpx solid #e5e5e5;

  .title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
  }
}

.content {
  padding: 32rpx;
}

.loading-section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 60rpx 32rpx;
  text-align: center;

  .loading-text {
    font-size: 28rpx;
    color: #666;
  }
}

.preview-section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 32rpx;

  .section-title {
    display: block;
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 24rpx;
  }

  .poster-preview {
    width: 100%;
    max-height: 800rpx;
    border-radius: 8rpx;
    background-color: #f0f0f0;
  }
}
</style>
