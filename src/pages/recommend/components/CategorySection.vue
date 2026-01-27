<template>
  <view class="category-section">
    <view class="section-header">
      <text class="section-title">{{ title }}</text>
      <view class="more-btn" @tap="handleMoreClick">
        <text class="more-text">更多产品</text>
      </view>
    </view>

    <product-list :products="courses" :show-sales="false" layout="horizontal" />
  </view>
</template>

<script setup lang="ts">
import Taro from "@tarojs/taro"
import ProductList from "@/components/ProductList/index.vue"
import { trackClick } from "@/utils/analytics"

interface Course {
  goodId: string
  goodName: string
  price: number
  mainImage: string
  isHot?: boolean
  hotLabel?: string
  sortOrder?: number
  label?: string[]
}

interface Props {
  title: string
  courses: Course[]
  categoryType?: string
}

const props = defineProps<Props>()

// 处理更多按钮点击
const handleMoreClick = () => {
  trackClick("more_products")
  Taro.navigateTo({
    url: `/pages/recommend/category/index?categoryId=${props.categoryType}`
  })
}
</script>

<style lang="less">
.category-section {
  padding: 0 32rpx 0 32rpx;
  margin-bottom: 48rpx;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32rpx;

    .section-title {
      font-family: "Alibaba PuHuiTi 2.0";
      font-size: 36rpx;
      font-weight: 900;
      line-height: 36rpx;
      color: #393548;
    }

    .more-btn {
      position: relative;

      .more-text {
        text-decoration-color: #848096;
        text-underline-offset: 6rpx;
        font-family: PingFang SC;
        font-size: 26px;
        font-weight: normal;
        line-height: 26px;
        text-decoration: underline;
        color: #848096;
      }
    }
  }
}
</style>
