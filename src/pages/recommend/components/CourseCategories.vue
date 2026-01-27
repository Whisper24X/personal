<template>
  <view class="categories-container">
    <view v-if="loading" class="loading-container">
      <view class="loading-spinner"></view>
    </view>
    <view v-else class="categories-grid">
      <view
        v-for="category in categories"
        :key="category.id"
        class="category-item"
        @tap="handleCategoryClick(category)"
      >
        <view class="category-icon-wrapper">
          <image class="category-icon" :src="category.icon" />
        </view>
        <text class="category-title">{{ category.name }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import Taro from "@tarojs/taro"
import type { GoodRecommendationCategoryInfo } from "../../../api/goodRecommendation"
import { trackClick } from "@/utils/analytics"

interface Category {
  id: string
  name: string
  icon: string
}

// 定义props接收父组件传递的分类数据
const props = defineProps<{
  categoryData: GoodRecommendationCategoryInfo[]
  loading: boolean
}>()

// 固定的"更多分类"选项
const moreCategory: Category = {
  id: "more",
  name: "更多分类",
  icon: "https://fp.yangcong345.com/middle/1.0.0/Categories/more__w.png"
}

// 合并API分类和"更多分类"
const categories = computed<Category[]>(() => {
  // 将API分类数据转换为Category格式
  const convertedCategories = props.categoryData
    .filter(category => category.status === 1) // 只显示上架的分类
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) // 按排序号排序
    .map(category => ({
      id: category.id || "",
      name: category.name || "",
      icon: category.icon || ""
    }))
    .slice(0, 5) // 最多显示5个API分类

  // 添加"更多分类"选项
  return [...convertedCategories, moreCategory]
})

// 处理分类点击事件
const handleCategoryClick = (category: Category) => {
  console.log("点击分类:", category)
  trackClick("category", { category_name: category.name })
  if (category.id === "more") {
    Taro.navigateTo({
      url: "/pages/recommend/category/index"
    })
  } else {
    Taro.navigateTo({
      url: `/pages/recommend/category/index?categoryId=${category.id}`
    })
  }
}
</script>

<style lang="less">
.categories-container {
  background: #ffffff;
  margin: 40rpx 32rpx 56rpx 32rpx;
  border-radius: 24rpx;
  box-shadow: 0rpx 4rpx 10rpx 0rpx rgba(0, 0, 0, 0.06);
  padding: 40rpx 0;
  position: relative;
  z-index: 2;
  min-height: 200rpx;
  /* 确保加载状态时有足够的高度 */

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200rpx;

    .loading-spinner {
      width: 60rpx;
      height: 60rpx;
      border: 6rpx solid #f3f3f3;
      border-top: 6rpx solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }

  .categories-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 40rpx 0;

    .category-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transition: all 0.3s ease;

      &:active {
        transform: scale(0.95);
        opacity: 0.8;
      }

      .category-icon-wrapper {
        width: 72rpx;
        height: 72rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16rpx;

        .category-icon {
          width: 100%;
          height: 100%;
        }
      }

      .category-title {
        color: #393548;
        text-align: center;
        font-family: "苹方-简";
        font-size: 24rpx;
        font-weight: normal;
        line-height: 24rpx;
      }
    }
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
