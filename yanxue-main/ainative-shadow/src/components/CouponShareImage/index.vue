<template>
  <div
    class="coupon-share-image-wrapper"
    :class="{ 'preview-mode': showPreview }"
    @click.self="handleMaskClick"
  >
    <!-- 关闭按钮 -->
    <button
      v-if="showPreview"
      class="close-btn"
      @click.stop="handleMaskClick"
      type="button"
      aria-label="关闭预览"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M18 6L6 18M6 6L18 18"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <!-- 分享图DOM结构 -->
    <div
      ref="shareImageRef"
      class="coupon-share-image"
      :style="{
        width: `${width}px`,
        height: `${height}px`,
      }"
      @click.stop
    >
      <!-- 背景图片 -->
      <div class="share-bg">
        <img :src="backgroundImage" alt="背景" />
      </div>

      <!-- 内容区域 -->
      <div class="share-content">
        <!-- 顶部标题 -->
        <div class="share-title">
          <div class="title-line">有一张优惠券等你领取</div>
          <div class="title-line">数量有限，先到先得</div>
        </div>

        <!-- 小程序区域 -->
        <div class="mini-program-section">
          <div class="mini-program-icon">
            <img :src="miniProgramIcon" alt="小程序图标" />
          </div>
          <div class="mini-program-name">{{ miniProgramName }}</div>
        </div>

        <!-- 优惠券卡片 -->
        <div class="coupon-card">
          <!-- 右上角标签 -->
          <div class="limit-tag">限领{{ limitPerUser }}张/人</div>

          <!-- 优惠金额 -->
          <div class="amount-section">
            <span class="currency">¥</span>
            <span class="amount">{{ amount }}</span>
          </div>

          <!-- 使用门槛 -->
          <div class="threshold">{{ threshold }}</div>

          <!-- 使用周期 -->
          <div class="valid-time">使用周期:{{ validTime }}</div>

          <!-- 二维码 -->
          <div class="qrcode-section">
            <canvas ref="qrcodeRef" class="qrcode-canvas"></canvas>
          </div>

          <!-- 提示文字 -->
          <div class="tip-text">长按扫码快速领取优惠</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import QRCode from 'qrcode'

export interface CouponShareImageProps {
  couponId: string | number
  couponName: string
  amount: string
  limitPerUser: number
  threshold: string
  validTime: string
  miniProgramName?: string
  miniProgramIcon?: string
  width?: number
  height?: number
  showPreview?: boolean // 是否显示预览
}

const props = withDefaults(defineProps<CouponShareImageProps>(), {
  miniProgramName: '洋葱星球研学家长服务',
  miniProgramIcon:
    'https://fp.yangcong345.com/middle/1.0.0/yanxue-logo-30aaff28b0dc207e82f783c545e53056__w.png',
  width: 750,
  height: 1250,
  showPreview: false,
})

const backgroundImage =
  'https://fp.yangcong345.com/middle/1.0.0/coupon-bg-923bd16d33e918ca5f61efa4607a99a8__w.png'

const shareImageRef = ref<HTMLDivElement>()
const qrcodeRef = ref<HTMLCanvasElement>()

// 根据环境获取域名
const getBaseUrl = () => {
  const ENV = process.env.ENV || 'development'
  return ENV === 'production'
    ? 'https://trip.yangcongxing.com'
    : 'https://trip-test.yangcongxing.com'
}

// 生成二维码
const generateQRCode = async () => {
  if (!qrcodeRef.value) return

  try {
    const baseUrl = getBaseUrl()
    await QRCode.toCanvas(
      qrcodeRef.value,
      `${baseUrl}/coupon?couponId=${props.couponId}`,
      {
        width: 248,
        margin: 0,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      },
    )
  } catch (error) {
    console.error('生成二维码失败:', error)
  }
}

// 监听couponId变化重新生成二维码
watch(
  () => props.couponId,
  () => {
    nextTick(() => {
      generateQRCode()
    })
  },
)

onMounted(() => {
  generateQRCode()
})

// 定义事件
const emit = defineEmits<{
  closePreview: []
}>()

// 处理蒙层点击
const handleMaskClick = () => {
  if (props.showPreview) {
    emit('closePreview')
  }
}

// 暴露DOM引用供外部使用
defineExpose({
  shareImageRef,
})
</script>

<style lang="scss" scoped>
.coupon-share-image-wrapper {
  // 默认隐藏但保留在DOM中
  position: fixed;
  left: -9999px;
  top: -9999px;
  z-index: -1;

  // 预览模式：显示在屏幕中央
  &.preview-mode {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    cursor: pointer; // 提示可点击关闭

    // 内容区域不继承cursor，保持默认
    .coupon-share-image {
      cursor: default;
      transform: scale(0.5);
      transform-origin: center center;
    }
  }

  // 关闭按钮
  .close-btn {
    position: fixed;
    right: 50px;
    top: 50px;
    z-index: 10000;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

    &:hover {
      background: rgba(255, 255, 255, 1);
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    &:active {
      transform: scale(0.95);
    }

    svg {
      color: #333;
      width: 20px;
      height: 20px;
    }
  }
}

.coupon-share-image {
  position: relative;
  overflow: hidden;
  background: #4a90e2;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;

  // 背景图片
  .share-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  // 内容区域
  .share-content {
    position: relative;
    padding: 87px 75px 103px 75px;
    z-index: 1;
  }

  // 顶部标题
  .share-title {
    font-family: Alibaba PuHuiTi 2;
    font-size: 48px;
    font-weight: 900;
    line-height: 52px;
    text-align: center;
    color: #ffffff;
    text-shadow: 0px 4px 10px #0b86fe;
  }

  // 小程序区域
  .mini-program-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 20px;

    .mini-program-icon {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .mini-program-name {
      margin-top: 14px;
      font-family: Alibaba PuHuiTi 2;
      font-size: 36px;
      font-weight: bold;
      line-height: 52px;
      text-align: center;
      letter-spacing: 0em;
      color: #ffffff;
      text-shadow: 0px 4px 10px rgba(0, 0, 0, 0.3);
    }
  }

  // 优惠券卡片
  .coupon-card {
    position: relative;
    box-sizing: border-box;
    width: 600px;
    height: 624px;
    margin: 56px 0 0 0;
    padding: 54px 76px 30px 76px;
    background-image: url('https://fp.yangcong345.com/middle/1.0.0/coupon-qrcode-bg-655518be31c7fc19ab2eb7206238205b__w.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    text-align: center;

    // 右上角标签
    .limit-tag {
      position: absolute;
      top: -18px;
      right: -8px;
      box-sizing: border-box;
      padding: 0 10px;
      min-width: 188px;
      height: 72.78px;
      color: #ffffff;
      font-size: 26px;
      font-weight: bold;
      line-height: 52px;
      background-image: url('https://fp.yangcong345.com/middle/1.0.0/coupon-tag-bg-f17a3751b25e659a0c112f77124c6a55__w.png');
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }

    // 优惠金额
    .amount-section {
      color: #f94638;
      font-weight: 500;
      line-height: 52px;

      .currency {
        font-family: Alibaba PuHuiTi 2;
        font-size: 56px;
        text-align: center;
        letter-spacing: 0em;
        margin-right: 6px;
      }

      .amount {
        font-family: Alibaba PuHuiTi 2;
        font-size: 88px;
      }
    }

    // 使用门槛
    .threshold {
      font-family: Alibaba PuHuiTi 2;
      font-size: 30px;
      font-weight: 300;
      line-height: 52px;
      color: #f94638;
    }

    // 使用周期
    .valid-time {
      font-family: Alibaba PuHuiTi 2;
      font-size: 24px;
      font-weight: 300;
      color: #666666;
      margin-top: 38px;
      margin-bottom: 16px;
    }

    // 二维码
    .qrcode-section {
      display: flex;
      justify-content: center;
      margin: 16px 0;

      .qrcode-canvas {
        width: 248px;
        height: 248px;
      }
    }

    // 提示文字
    .tip-text {
      font-family: Alibaba PuHuiTi 2;
      font-size: 32px;
      font-weight: 500;
      line-height: 52px;
      color: #3d3d3d;
    }
  }
}
</style>
