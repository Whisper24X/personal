<template>
  <tab-bar-layout tab-key="home" :show-tab-bar="true">
    <!-- <status-bar /> -->

    <!-- 1. Banner展示模块 -->
    <top-banner />

    <!-- 2. 课程分类展示模块 -->
    <course-categories
      :category-data="recommendationCategories"
      :loading="loading && recommendationCategories.length === 0"
    />

    <!-- 3. 各个课程分类展示模块 -->
    <template v-if="loading && recommendationCategories.length === 0">
      <view class="loading-container">
        <view class="loading-spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>
    </template>

    <template v-else>
      <template v-for="category in recommendationCategories">
        <category-section
          v-if="category.goodItems && category.goodItems.length > 0"
          :key="category.id"
          :title="category.name"
          :courses="mapGoodItemsToCourses(category.goodItems || [])"
          :category-type="category.id"
        />
      </template>
    </template>
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Taro, { useDidShow } from "@tarojs/taro"
// import StatusBar from "@/components/StatusBar.vue"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import TopBanner from "../components/TopBanner.vue"
import CourseCategories from "../components/CourseCategories.vue"
import CategorySection from "../components/CategorySection.vue"
import type { GoodRecommendationCategoryInfo, GoodItem } from "@/api/goodRecommendation"
import { getGoodRecommendationCategoryList } from "@/api/goodRecommendation"
import { track } from "@/utils/analytics"

interface Course {
  goodId: string
  goodName: string
  price: number
  mainImage: string
  isHot?: boolean
  hotLabel?: string
  label: string[]
}

// 商品推荐分类数据
const recommendationCategories = ref<GoodRecommendationCategoryInfo[]>([])
const loading = ref(true)

// 将GoodItem转换为Course对象，直接使用后端字段名
// 首页只显示isShowInHomepage为true的商品，支持多行展示（每行2个）
const mapGoodItemsToCourses = (goodItems: GoodItem[] = []): Course[] => {
  return goodItems
    .filter(item => item.isShowInHomepage === true)
    .map(item => ({
      goodId: item.goodId || "",
      goodName: item.goodName || "",
      price: item.price || 0,
      mainImage: item.mainImage || "",
      label: item.label || []
    }))
}

// 获取商品推荐分类数据
const fetchRecommendationCategories = async () => {
  try {
    loading.value = true
    const response = await getGoodRecommendationCategoryList(1, 10)
    // 过滤出状态为上架(1)的分类，并按sortOrder排序
    if (response && response.list) {
      recommendationCategories.value = response.list
        .filter(category => category.status === 1)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    }
  } catch (error) {
    console.error("获取商品推荐分类失败:", error)
    Taro.showToast({
      title: "获取商品推荐分类失败",
      icon: "none"
    })
  } finally {
    loading.value = false
  }
}
useDidShow(() => {
  console.log("首页显示")
  track("enter_homepage")
  // 每次页面显示时刷新数据
  fetchRecommendationCategories()
})
</script>

<style lang="less">
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx 0;

  .loading-spinner {
    width: 60rpx;
    height: 60rpx;
    border: 6rpx solid #f3f3f3;
    border-top: 6rpx solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    margin-top: 20rpx;
    font-size: 28rpx;
    color: #666;
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
