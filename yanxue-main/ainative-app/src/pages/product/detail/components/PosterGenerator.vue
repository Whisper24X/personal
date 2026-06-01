<template>
  <!-- 海报模板 - 用于WXML2Canvas生成 -->
  <view class="wxml2canvas-container poster-template">
    <view class="poster-background">
      <!-- 主要商品图片 -->
      <view class="poster-main-image-container">
        <image
          class="wxml2canvas-item poster-main-image"
          :src="goodInfo?.mainImage?.[0] || ''"
          mode="widthFix"
        />
      </view>

      <!-- 商品信息区域 -->
      <view class="poster-info-section">
        <!-- 商品标题 -->
        <view class="wxml2canvas-item poster-title" :dataText="goodInfo?.name || '商品详情'">
          {{ goodInfo?.name || "商品详情" }}
        </view>

        <!-- 适合年龄 -->
        <view v-if="goodInfo?.ageRange" class="poster-age">
          <view class="wxml2canvas-item poster-age-icon-container">
            <image
              class="wxml2canvas-item poster-age-icon"
              src="https://fp.yangcong345.com/middle/1.0.0/friend@1x-2ebebc97e829b6020de155b9f0acb4e5.png"
            />
          </view>
          <view
            class="wxml2canvas-item poster-age-text"
            :dataText="`适合${goodInfo?.ageRange || '8-15岁'}学生`"
          >
            适合{{ goodInfo?.ageRange || "8-15岁" }}学生
          </view>
        </view>

        <!-- 价格信息 -->
        <view class="poster-price-container">
          <view
            v-if="goodInfo?.originalPrice"
            class="wxml2canvas-item poster-price-label"
            dataText="券后价"
          >
            券后价
          </view>
          <view v-else class="wxml2canvas-item poster-price-label" dataText="到手价"> 到手价 </view>
          <view
            class="wxml2canvas-item poster-price"
            :dataText="`¥${
              isProductType
                ? centsToYuan(goodInfo?.price || 0)
                : centsToYuan(orderInfo?.orderPrice || 0)
            }`"
          >
            ¥{{
              isProductType
                ? centsToYuan(goodInfo?.price || 0)
                : centsToYuan(orderInfo?.orderPrice || 0)
            }}
          </view>
          <view
            v-if="goodInfo?.originalPrice"
            class="wxml2canvas-item poster-original-price"
            :dataText="`¥${goodInfo?.originalPrice || ''}`"
          >
            ¥{{ goodInfo?.originalPrice || "" }}
          </view>
        </view>
      </view>

      <!-- 底部推荐区域 -->
      <view class="poster-bottom-section">
        <!-- 头像区域 -->
        <view class="poster-avatar-section">
          <image
            class="wxml2canvas-item poster-avatar-image"
            src="https://fp.yangcong345.com/middle/1.0.0/26a/ha__w.png"
          />
        </view>

        <!-- 推荐语区域 -->
        <view class="poster-recommend-section">
          <view class="wxml2canvas-item poster-recommend-title" dataText="洋葱推荐官">
            洋葱推荐官
          </view>
          <view class="wxml2canvas-item poster-recommend-text" dataText="长按识别了解更多">
            长按识别了解更多
          </view>
        </view>

        <!-- 二维码区域 -->
        <view class="poster-qr-section">
          <image
            v-if="qrCodeUrl"
            class="wxml2canvas-item poster-qr-image"
            :src="qrCodeUrl"
            mode="aspectFit"
          />
          <view v-else class="poster-qr-placeholder">
            <view class="qr-placeholder">
              <view class="qr-text">{{ qrCodeLoading ? "生成中..." : "二维码" }}</view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>

  <!-- WXML2Canvas 组件 -->
  <WXML2Canvas v-if="isVisible" ref="wxml2canvasRef" />
</template>

<script setup>
import { ref, computed, getCurrentInstance, watch, onMounted, nextTick, readonly } from "vue"
import Taro from "@tarojs/taro"
import WXML2Canvas from "@/components/WXML2Canvas/index.vue"
import { generateQrCode } from "@/api/good"
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
  userInfo: {
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
  }
})

// 定义 emits
const emit = defineEmits(["success", "error", "start", "complete"])

// 获取当前组件实例
const instance = getCurrentInstance()

// 响应式数据
const isGenerating = ref(false)
const wxml2canvasRef = ref(null)
const qrCodeUrl = ref("")
const qrCodeLoading = ref(false)

// 计算属性
const isVisible = computed(() => props.show || isGenerating.value)
const isProductType = computed(() => props.type === PAGE_TYPES.PRODUCT)

/**
 * 初始化二维码获取
 * 统一的二维码获取入口，避免重复调用
 */
const initQrCode = async () => {
  // 如果正在加载或已有二维码，则跳过
  if (qrCodeLoading.value || qrCodeUrl.value) {
    return
  }

  const goodId = props.goodInfo?.id || props.orderId
  if (!goodId) {
    console.warn("📱 商品ID为空，无法初始化二维码")
    return
  }

  console.log("🚀 初始化二维码获取:", { goodId, type: props.type })
  const pagePath = `pages/product/detail/index`
  await fetchQrCode(pagePath, `$${goodId}`)
}

/**
 * 获取商品二维码
 * @param page 小程序页面路径
 * @param scene 场景参数
 */
const fetchQrCode = async (page = "pages/product/detail/index", scene = "") => {
  if (!scene) {
    console.warn("场景参数为空，无法生成二维码")
    return
  }

  // 防止重复请求
  if (qrCodeLoading.value) {
    console.log("⏳ 二维码正在获取中，跳过重复请求")
    return
  }

  try {
    qrCodeLoading.value = true
    console.log("🔍 开始获取商品二维码:", { page, scene })

    const res = await generateQrCode(page, scene)
    console.log("二维码API返回数据:", res)

    if (res && res.url) {
      qrCodeUrl.value = res.url
      console.log("✅ 二维码获取成功:", qrCodeUrl.value)
    } else {
      console.warn("⚠️ 二维码API返回数据格式异常")
      // 使用默认二维码
      qrCodeUrl.value =
        "https://fp.yangcong345.com/middle/1.0.0/gh_fdf5dd7c2359_344-61cbf1aa1d11986e8bfc3b463b4cd4a8__w.jpeg"
    }
  } catch (error) {
    console.error("❌ 获取二维码失败:", error)
    // 使用默认二维码
    qrCodeUrl.value =
      "https://fp.yangcong345.com/middle/1.0.0/gh_fdf5dd7c2359_344-61cbf1aa1d11986e8bfc3b463b4cd4a8__w.jpeg"
  } finally {
    qrCodeLoading.value = false
  }
}

/**
 * 生成海报
 * @returns 返回生成的图片路径
 */
const generatePoster = async () => {
  if (isGenerating.value) {
    throw new Error("正在生成中，请勿重复操作")
  }

  console.log("🎨 开始生成海报")
  isGenerating.value = true
  emit("start")

  try {
    // 1. 获取商品ID
    const goodId = props.goodInfo?.id || props.orderId
    if (!goodId) {
      throw new Error("商品ID不存在，无法生成海报")
    }

    // 2. 获取二维码（如果还没有的话）
    if (!qrCodeUrl.value) {
      console.log("📱 开始获取二维码")
      await initQrCode()
    }

    // 3. 等待一小段时间确保模板渲染完成
    await new Promise(resolve => setTimeout(resolve, 500))

    console.log("🔍 检查 WXML2Canvas 组件引用:", !!wxml2canvasRef.value)
    if (!wxml2canvasRef.value) {
      throw new Error("WXML2Canvas 组件引用不存在")
    }

    // 检查海报模板元素是否存在
    const checkElements = () => {
      return new Promise(resolve => {
        const query = Taro.createSelectorQuery()
        query.selectAll(".wxml2canvas-container").boundingClientRect()
        query.selectAll(".wxml2canvas-item").boundingClientRect()

        const timeoutId = setTimeout(() => {
          console.warn("检查海报元素超时")
          resolve({ containers: [], items: [] })
        }, 3000)

        query.exec(res => {
          clearTimeout(timeoutId)
          resolve({
            containers: res[0] || [],
            items: res[1] || []
          })
        })
      })
    }

    const elementCheck = await checkElements()
    console.log("📊 海报元素检查结果:", elementCheck)

    if (elementCheck.containers.length === 0) {
      throw new Error("未找到海报模板容器")
    }

    if (elementCheck.items.length === 0) {
      throw new Error("未找到海报模板元素")
    }

    // 开始绘制海报
    console.log("🎨 开始绘制海报画布")
    const drawPromise = wxml2canvasRef.value.draw(instance.ctx)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("海报生成超时（30秒）")), 30000)
    })

    await Promise.race([drawPromise, timeoutPromise])
    console.log("✅ 海报绘制完成")

    // 导出图片
    console.log("💾 开始导出海报图片")
    const posterPath = await wxml2canvasRef.value.toTempFilePath()
    console.log("✅ 海报导出完成:", posterPath)

    emit("success", posterPath)
    return posterPath
  } catch (error) {
    console.error("❌ 生成海报失败:", error)
    emit("error", error)
    throw error
  } finally {
    // 延迟重置状态，避免模板闪烁
    setTimeout(() => {
      isGenerating.value = false
      emit("complete")
    }, 1000)
  }
}

// 组件挂载时初始化二维码
onMounted(async () => {
  console.log("📦 PosterGenerator 组件已挂载")

  // 等待下一帧，确保props已经传递完成
  await nextTick()

  // 初始化二维码获取
  await initQrCode()
})

// 监听组件显示状态，自动获取二维码
watch(
  () => props.show,
  async newShow => {
    if (newShow) {
      console.log("👁️ 组件显示状态变化:", newShow)

      // 等待DOM更新完成
      await nextTick()

      // 尝试初始化二维码
      await initQrCode()
    }
  },
  { immediate: true }
)

// 监听商品信息变化，重新获取二维码
watch(
  () => props.goodInfo?.id || props.orderId,
  async (newGoodId, oldGoodId) => {
    if (newGoodId && newGoodId !== oldGoodId) {
      console.log("🔄 商品ID变化，重新获取二维码:", { oldGoodId, newGoodId })

      // 清空旧二维码，重新获取
      qrCodeUrl.value = ""
      qrCodeLoading.value = false

      // 等待状态更新
      await nextTick()

      // 重新初始化二维码
      await initQrCode()
    }
  },
  { immediate: true }
)

// 监听商品信息对象变化（深度监听）
watch(
  () => props.goodInfo,
  async newGoodInfo => {
    if (newGoodInfo && newGoodInfo.id && !qrCodeUrl.value && !qrCodeLoading.value) {
      console.log("📋 商品信息更新，尝试获取二维码")
      await initQrCode()
    }
  },
  { deep: true, immediate: true }
)

// 暴露方法给父组件
defineExpose({
  generatePoster,
  fetchQrCode,
  initQrCode,
  // 暴露响应式数据供调试
  qrCodeUrl: readonly(qrCodeUrl),
  qrCodeLoading: readonly(qrCodeLoading)
})
</script>

<style lang="less">
// 海报模板样式
.poster-template {
  position: fixed;
  top: -9999px;
  left: -9999px;
  width: 740rpx;
  // height: 1334rpx;
  background: #ffffff;
}

.poster-background {
  width: 100%;
  height: 100%;
  // padding: 40rpx;
  padding-bottom: 10rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

// 主要商品图片区域
.poster-main-image-container {
  width: 100%;
  overflow: hidden;
}

.poster-main-image {
  width: 100%;
}

// 商品信息区域
.poster-info-section {
  padding: 32rpx;
  background: #ffffff;
}

.poster-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #393548;
  margin-bottom: 24rpx;
  line-height: 1.3;
  text-align: left;
}

.poster-age {
  font-size: 28rpx;
  color: #848096;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
}

.poster-age-icon-container {
  line-height: 0;
  font-size: 0;
}

.poster-age-icon {
  width: 36rpx;
  height: 36rpx;
  margin-right: 6rpx;
}

// 价格信息区域
.poster-price-container {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}

.poster-price-label {
  font-size: 24rpx;
  color: #fa5a65;
  font-weight: 500;
}

.poster-price {
  font-size: 44rpx;
  font-weight: bold;
  color: #fa5a65;
  line-height: 1;
}

.poster-original-price {
  font-size: 28rpx;
  color: #b8b4c7;
  text-decoration: line-through;
}

// 底部推荐区域
.poster-bottom-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
}

// 头像区域
.poster-avatar-section {
  display: flex;
  align-items: center;
}

.poster-avatar-image {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
}

.avatar-circle {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 24rpx;
  color: #666666;
}

// 推荐语区域
.poster-recommend-section {
  flex: 1;
  margin-left: 30rpx;
}

.poster-recommend-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 8rpx;
}

.poster-recommend-text {
  font-size: 28rpx;
  color: #666666;
}

// 二维码区域
.poster-qr-section {
  display: flex;
  align-items: center;
}

.poster-qr-image {
  width: 120rpx;
  height: 120rpx;
  border-radius: 8rpx;
}

.poster-qr-placeholder {
  width: 120rpx;
  height: 120rpx;
}

.qr-placeholder {
  width: 100%;
  height: 100%;
  background: #f0f0f0;
  border: 2rpx solid #e0e0e0;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-text {
  font-size: 20rpx;
  color: #999999;
}
</style>
