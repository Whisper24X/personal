<template>
  <view
    class="product-list"
    :class="{ 'grid-layout': layout === 'grid', 'category-layout': type === 'category' }"
  >
    <view
      v-for="product in displayProducts"
      :key="product.goodId"
      class="product-card"
      @tap="handleProductClick(product)"
    >
      <!-- 商品图片 -->
      <view class="product-image-wrapper">
        <image class="product-image" :src="product.mainImage" mode="widthFix" />
        <!-- 热销标签 -->
        <view v-if="product.isHot" class="hot-tag">
          <image class="fire-icon" src="https://fp.yangcong345.com/middle/1.0.0/hot-icon__w.png" />
          <text class="hot-text">{{ product.hotLabel }}</text>
        </view>
      </view>

      <!-- 商品信息 -->
      <view class="product-info" :class="{ 'product-info-category': type === 'category' }">
        <text class="product-title">{{ product.goodName }}</text>
        <view class="product-meta">
          <!-- 商品标签 -->
          <view v-if="product.label && product.label.length > 0" class="product-label">
            <view v-for="(label, index) in product.label" :key="index" class="label-tag">
              {{ label }}
            </view>
          </view>
          <text class="product-price">¥{{ formatPriceFromCents(product.price) }}</text>
          <!-- <text v-if="showSales" class="product-sales">销量{{ product.sales || 0 }}</text> -->
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Taro from "@tarojs/taro"
import { trackClick } from "@/utils/analytics"
import { formatPriceFromCents } from "@/utils/formatPrice"

interface Product {
  goodId: string
  goodName: string
  price: number
  mainImage: string
  isHot?: boolean
  hotLabel?: string
  sortOrder?: number
  sales?: number
  type?: string
  label?: string[]
}

interface Props {
  products: Product[]
  maxItems?: number // 最大显示数量，默认不限制
  showSales?: boolean // 是否显示销量，默认false
  layout?: "horizontal" | "grid" // 布局方式，默认horizontal
  type?: string
  userCouponId?: string // 用户优惠券ID
}

const props = withDefaults(defineProps<Props>(), {
  maxItems: 0,
  showSales: false,
  layout: "horizontal",
  type: "product"
})

// 计算属性：对商品进行排序并限制显示数量
const displayProducts = computed(() => {
  let sortedProducts = [...props.products].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) // 按sortOrder排序，数字越小排序越靠前

  // 如果设置了最大显示数量，则截取
  if (props.maxItems > 0) {
    sortedProducts = sortedProducts.slice(0, props.maxItems)
  }

  return sortedProducts
})

// 处理商品卡片点击
const handleProductClick = (product: Product) => {
  trackClick("product_card", { product_name: product.goodName, product_id: product.goodId })
  let url = `/pages/product/detail/index?id=${product.goodId}&type=product&enterSource=${
    props.type === "category" ? "category" : "homeCategory"
  }`

  // 如果有优惠券相关参数，添加到URL中
  if (props.userCouponId) {
    url += `&userCouponId=${props.userCouponId}`
  }

  Taro.navigateTo({
    url: url
  })
  console.log("点击商品:", product)
}
</script>

<style lang="less">
.product-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32rpx;

  &.category-layout {
    gap: 24px;
  }

  &.horizontal-layout {
    display: flex;
    gap: 32rpx;
  }

  .product-card {
    border-radius: 24rpx;
    background: #ffffff;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    transition: all 0.3s ease;

    .horizontal-layout & {
      flex: 1;
    }

    &:active {
      transform: translateY(4rpx);
      box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.12);
    }

    .product-image-wrapper {
      position: relative;
      width: 100%;
      line-height: 0;
      font-size: 0;
      .product-image {
        width: 100%;
        border-radius: 24rpx 24rpx 0 0;
      }

      .hot-tag {
        position: absolute;
        top: 0;
        left: 0;
        background: linear-gradient(102deg, #fa5a65 0%, #ff3331 100%);
        border-radius: 20rpx 0 20rpx 0;
        padding: 16rpx 20rpx 16rpx 16rpx;
        display: flex;
        align-items: center;
        box-shadow: 0 4rpx 12rpx rgba(255, 71, 87, 0.3);

        .fire-icon {
          width: 24rpx;
          height: 24rpx;
          margin-right: 8rpx;
        }

        .hot-text {
          font-family: PingFang SC;
          font-size: 22rpx;
          font-weight: 600;
          line-height: 22rpx;
          color: #ffffff;
        }
      }
    }

    .product-info {
      padding: 24rpx;

      .product-title {
        margin-bottom: 12rpx;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        font-family: PingFang SC;
        font-size: 26rpx;
        font-weight: normal;
        line-height: 34rpx;
        color: #393548;
        max-height: 72rpx;
        white-space: wrap;
      }

      .product-meta {
        display: flex;
        justify-content: space-between;
        gap: 16rpx;
        align-items: flex-start;
        flex-direction: column;
        .product-label {
          display: flex;
          flex-wrap: wrap;
          gap: 12rpx;

          .label-tag {
            display: inline-flex;
            align-items: center;
            border-radius: 4rpx;
            font-family: PingFang SC;
            font-weight: normal;
            padding: 10px 12px;
            background: #f7f7f9;
            font-size: 20px;
            line-height: 20px;
            color: #504b64;
          }
        }
        .product-price {
          font-family: "Alibaba PuHuiTi 2.0";
          font-size: 32rpx;
          font-weight: 900;
          line-height: 32rpx;
          color: #fa5a65;
        }

        .product-sales {
          font-size: 24rpx;
          color: #999;
        }
      }
    }

    .product-info-category {
      padding: 16rpx 16rpx 24rpx 16rpx;

      .product-title {
        margin-bottom: 16rpx;
      }
    }
  }
}
</style>
