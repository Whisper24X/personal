<template>
  <tab-bar-layout
    tab-key="home"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '分类' }"
  >
    <view class="category-container" :style="{ height: `calc(100vh - ${getNavBarHeight()}rpx)` }">
      <!-- 左侧分类列表 -->
      <view class="category-sidebar" :style="{ height: `calc(100vh - ${getNavBarHeight()}rpx)` }">
        <view
          v-for="category in recommendationCategories"
          :key="category.id"
          class="category-item"
          :class="{ active: selectedCategoryId === category.id }"
          @tap="handleCategoryClick(category)"
        >
          <text class="category-name">{{ category.name }}</text>
        </view>
      </view>

      <!-- 右侧商品网格 -->
      <view class="product-grid" :style="{ height: `calc(100vh - ${getNavBarHeight()}rpx)` }">
        <view v-if="loading" class="loading-container">
          <view class="loading-spinner"></view>
          <text class="loading-text">加载中...</text>
        </view>

        <view v-else-if="currentProducts.length === 0" class="empty-container">
          <text class="empty-text">暂无商品</text>
        </view>

        <product-list
          v-else
          :products="currentProducts"
          :show-sales="true"
          layout="grid"
          type="category"
        />
      </view>
    </view>
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import Taro, { useDidShow } from "@tarojs/taro"
import { getNavBarHeight } from "@/utils/statusBar"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import ProductList from "@/components/ProductList/index.vue"
import { getGoodRecommendationCategoryList } from "@/api/goodRecommendation"
import type { GoodRecommendationCategoryInfo } from "@/api/goodRecommendation"

// 商品推荐分类数据
const recommendationCategories = ref<GoodRecommendationCategoryInfo[]>([])

// 当前选中的分类ID
const selectedCategoryId = ref("")

// 加载状态
const loading = ref(false)

// 获取URL参数中的categoryId
const getCategoryIdFromUrl = () => {
  const instance = Taro.getCurrentInstance()
  const categoryId = instance?.router?.params?.categoryId
  console.log("从URL获取的categoryId:", categoryId)
  return categoryId || ""
}

// 当前显示的商品列表
const currentProducts = computed(() => {
  const currentCategory = recommendationCategories.value.find(
    category => category.id === selectedCategoryId.value
  )
  const goodItems = currentCategory?.goodItems || []

  // 转换为Product类型，确保所有必需字段都有值
  return goodItems.map(item => ({
    goodId: item.goodId || "",
    goodName: item.goodName || "",
    price: item.price || 0,
    mainImage: item.mainImage || "",
    sortOrder: item.sortOrder || 0,
    sales: item.sortOrder || 0, // 使用sortOrder作为销量显示
    label: item.label || []
  }))
})

// 处理分类点击
const handleCategoryClick = (category: GoodRecommendationCategoryInfo) => {
  selectedCategoryId.value = category.id || ""
  console.log("选择分类:", category.name)
}

// 获取商品推荐分类数据
const fetchRecommendationCategories = async () => {
  try {
    loading.value = true
    const response = await getGoodRecommendationCategoryList(1, 1000)
    // 过滤出状态为上架(1)的分类，并按sortOrder排序
    if (response && response.list) {
      recommendationCategories.value = response.list
        .filter(category => category.status === 1)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

      // 获取URL参数中的categoryId
      const urlCategoryId = getCategoryIdFromUrl()

      if (urlCategoryId) {
        // 如果URL中有categoryId，检查是否存在该分类
        const targetCategory = recommendationCategories.value.find(
          category => category.id === urlCategoryId
        )
        console.log("查找目标分类:", urlCategoryId, "找到:", targetCategory)
        if (targetCategory) {
          selectedCategoryId.value = urlCategoryId
          console.log("设置选中分类ID:", urlCategoryId)
        } else {
          // 如果找不到对应的分类，选择第一个
          selectedCategoryId.value = recommendationCategories.value[0]?.id || ""
          console.log("未找到目标分类，使用默认分类:", selectedCategoryId.value)
        }
      } else {
        // 如果没有URL参数，设置默认选中第一个分类
        if (recommendationCategories.value.length > 0) {
          selectedCategoryId.value = recommendationCategories.value[0].id || ""
          console.log("使用默认分类:", selectedCategoryId.value)
        }
      }
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

onMounted(() => {
  // 获取商品推荐分类数据
  fetchRecommendationCategories()
})

useDidShow(() => {
  console.log("分类页面显示")
  // 每次页面显示时重新获取数据并处理URL参数
  fetchRecommendationCategories()
})
</script>

<style lang="less">
// Less 变量定义
@tab-background: #efeef3;
@tab-active-background: #f7f7f9;
@tab-active-border-left: #518aff;
@tab-active-radius: 16rpx;

.category-container {
  display: flex;
  overflow: hidden;
}

.category-sidebar {
  width: 180rpx;
  background-color: @tab-background;
  overflow-y: auto;

  .category-item {
    padding: 20rpx 32rpx;
    position: relative;

    &.active {
      padding-left: 26rpx;
      background-color: @tab-active-background;
      border-left: 6rpx solid @tab-active-border-left;
      box-shadow:
        @tab-active-radius @tab-active-radius 0 0 @tab-active-background,
        @tab-active-radius -@tab-active-radius 0 0 @tab-active-background;

      .category-name {
        font-weight: 700;
      }

      &::before,
      &::after {
        content: "";
        position: absolute;
        right: 0;
        width: 100%;
        height: @tab-active-radius;
        background: @tab-background;
      }

      /* 右上角 */
      &::before {
        top: -@tab-active-radius;
        /* 右上角圆角 */
        border-radius: 0 0 @tab-active-radius 0;
      }

      /* 右下角 */
      &::after {
        bottom: -@tab-active-radius;
        /* 右下角圆角 */
        border-radius: 0 @tab-active-radius 0 0;
      }

      &:first-child::before,
      &:last-child::after {
        display: none;
      }
    }

    &:active {
      background-color: #f0f0f0;
    }

    .category-name {
      font-size: 28rpx;
      color: #504b64;
      line-height: 1.4;
      text-align: center;
    }
  }
}

.product-grid {
  flex: 1;
  padding: 22rpx 32rpx;
  overflow-y: auto;

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400rpx;

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

  .empty-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 400rpx;

    .empty-text {
      font-size: 28rpx;
      color: #999;
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
