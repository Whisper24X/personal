<template>
  <view class="custom-nav-bar-container">
    <view
      class="custom-nav-bar"
      :class="`theme-${theme}`"
      :style="{
        backgroundSize: `100% ${statusBarHeight + 44}px`,
        height: `${statusBarHeight + 44}px`,
        backgroundColor: themeStyles.backgroundColor
      }"
    >
      <status-bar />
      <view class="nav-header">
        <view class="nav-content">
          <!-- 左侧按钮 -->
          <view v-if="showBack" class="nav-left" @tap="handleBack">
            <image class="back-icon" :src="themeStyles.leftIcon" mode="aspectFit" />
          </view>

          <!-- 标题 -->
          <view
            class="nav-title"
            :style="{
              color: themeStyles.textColor
            }"
          >
            {{ title }}
          </view>

          <!-- 右侧按钮 -->
          <view v-if="rightText || rightIcon" class="nav-right" @tap="handleRightClick">
            <image v-if="rightIcon" class="right-icon" :src="rightIcon" mode="aspectFit" />
            <text v-if="rightText" class="right-text" :style="{ color: themeStyles.textColor }">
              {{ rightText }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import Taro from "@tarojs/taro"
import StatusBar from "@/components/StatusBar.vue"
import { getStatusBarHeight } from "@/utils/statusBar"
import { computed, ref, onMounted } from "vue"
import { topAreaHeight } from "@/utils/style"
const topAreaHeightForCss = topAreaHeight + "px"

interface Props {
  title?: string
  showBack?: boolean
  rightText?: string
  rightIcon?: string
  backgroundImage?: string
  textColor?: string
  backgroundColor?: string
  leftIcon?: string
  theme?: "dark" | "light"
}

const props = withDefaults(defineProps<Props>(), {
  title: "洋葱星球研学",
  showBack: true,
  rightText: "",
  rightIcon: "",
  backgroundImage: "",
  textColor: "",
  backgroundColor: "",
  leftIcon: "",
  theme: "light"
})

const backgroundImageUrlForCss = computed(() => {
  return `url(${backgroundImage})`
})

// 根据主题计算样式
const themeStyles = computed(() => {
  if (props.theme === "dark") {
    return {
      backgroundColor: props.backgroundColor || "#1a1a1a",
      textColor: props.textColor || "#ffffff",
      leftIcon: props.leftIcon || "https://fp.yangcong345.com/middle/1.0.0/back__w.png"
    }
  } else {
    return {
      backgroundColor: props.backgroundColor || "#ffffff",
      textColor: props.textColor || "#393548",
      leftIcon: props.leftIcon || "https://fp.yangcong345.com/middle/1.0.0/back-black__w.png"
    }
  }
})
const emit = defineEmits<{
  back: [callback: () => void]
  rightClick: []
}>()

const statusBarHeight = getStatusBarHeight()

// props已在模板中使用，这里的解构仅为满足linter要求
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { title, showBack, rightText, rightIcon, backgroundImage, theme } = props

// 处理返回按钮点击
const handleBack = () => {
  const defaultBack = () => {
    Taro.navigateBack({
      delta: 1,
      fail: () => {
        Taro.switchTab({
          url: "/pages/recommend/index/index"
        })
      }
    })
  }
  emit("back", defaultBack)
}

// 处理右侧按钮点击
const handleRightClick = () => {
  emit("rightClick")
}
</script>

<style lang="less">
.custom-nav-bar-container {
  height: v-bind(topAreaHeightForCss);
}
.custom-nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 999;
  background-image: v-bind(backgroundImageUrlForCss);
  background-repeat: no-repeat;
  background-color: #f7f7f9;
  transition: background-color 0.3s ease, color 0.3s ease;

  &.theme-dark {
    background-color: #1a1a1a;

    .nav-title {
      color: #ffffff;
    }

    .right-text {
      color: #ffffff;
    }
  }

  &.theme-light {
    background-color: #ffffff;

    .nav-title {
      color: #393548;
    }

    .right-text {
      color: #393548;
    }
  }

  .nav-header {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0 30px;
    height: 88px;

    .nav-content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .nav-left {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 60px;
        height: 60px;

        .back-icon {
          width: 48px;
          height: 48px;
        }
      }

      .nav-title {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        font-family: "苹方-简";
        font-size: 32px;
        font-weight: 600;
        line-height: 32px;
        text-align: center;
        letter-spacing: normal;
        margin: 0;
      }

      .nav-right {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 60px;
        height: 60px;

        .right-icon {
          width: 48px;
          height: 48px;
        }

        .right-text {
          font-size: 28px;
          font-weight: 500;
        }
      }
    }
  }
}
</style>
