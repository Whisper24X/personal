<template>
  <view class="tab-layout">
    <view class="tab-content" :class="{ 'no-tab-bar': !showTabBar }">
      <CustomNavBar
        v-if="showCustomNavBar"
        :title="navBarConfig.title"
        :show-back="navBarConfig.showBack"
        :right-text="navBarConfig.rightText"
        :right-icon="navBarConfig.rightIcon"
        :background-image="navBarConfig.backgroundImage"
        :text-color="navBarConfig.textColor"
        :background-color="navBarConfig.backgroundColor"
        :left-icon="navBarConfig.leftIcon"
        :theme="navBarConfig.theme"
        @back="handleNavBarBack"
        @right-click="handleNavBarRightClick"
      />
      <slot></slot>
    </view>
    <TabBar
      v-if="showTabBar"
      :current="tabBarStore.currentTab"
      @change="tabBarStore.setCurrentTab"
    />
  </view>
</template>

<script setup lang="ts">
import { onMounted } from "vue"
import Taro from "@tarojs/taro"
import TabBar from "../TabBar/index.vue"
import CustomNavBar from "../CustomNavBar/index.vue"
import { useTabBarStore } from "../../store/tabBarStore"

interface Props {
  tabKey: string
  showTabBar?: boolean
  showCustomNavBar?: boolean
  customBack?: () => void // 新增: 自定义返回函数
  customRightClick?: () => void // 自定义右侧按钮点击函数
  navBarConfig?: {
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
}

const props = withDefaults(defineProps<Props>(), {
  showTabBar: false,
  navBarConfig: () => ({
    title: "",
    showBack: true,
    rightText: "",
    rightIcon: "",
    backgroundImage: "",
    textColor: "",
    backgroundColor: "",
    leftIcon: "",
    theme: "light"
  })
})

const tabBarStore = useTabBarStore()

// 处理导航栏返回按钮
const handleNavBarBack = (cb: () => void) => {
  // 如果传入了自定义返回函数,执行自定义函数
  if (props.customBack) {
    props.customBack()
  } else {
    // 否则执行默认返回
    cb()
  }
}

// 处理导航栏右侧按钮
const handleNavBarRightClick = () => {
  if (props.customRightClick) {
    props.customRightClick()
  }
}

onMounted(() => {
  console.log("onMounted", props.tabKey)
  // 设置当前页面的 tab
  tabBarStore.setCurrentTab(props.tabKey)

  // 获取当前页面路径并同步状态
  setTimeout(() => {
    tabBarStore.updateTabByCurrentPage()
  }, 50)
})

// 使用Taro的页面显示钩子，确保每次页面显示时都同步tabbar状态
Taro.useDidShow(() => {
  console.log("useDidShow", props.tabKey)
  // 设置当前页面的 tab
  tabBarStore.setCurrentTab(props.tabKey)

  // 同步更新状态
  tabBarStore.updateTabByCurrentPage()
})
</script>

<style lang="less">
.tab-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: auto;
  background-color: #f7f7f9;

  &::after {
    content: "";
    background-image: url("https://fp.yangcong345.com/middle/1.0.0/yanxueImg/bg-left__w.png");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    position: fixed;
    bottom: 0;
    left: 0;
    z-index: 0;
    width: 217px;
    height: 570px;
    pointer-events: none;
  }

  .tab-content {
    flex: 1;
    padding-bottom: calc(100px + env(safe-area-inset-bottom)); // 预留TabBar高度和底部安全距离
  }

  .no-tab-bar {
    padding-bottom: 0;
  }
}
</style>
