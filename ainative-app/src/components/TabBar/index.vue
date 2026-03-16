<template>
  <view class="custom-tabbar" :style="{ paddingBottom: `${safeAreaBottom}px` }">
    <view
      v-for="item in tabList"
      :key="item.key"
      class="tabbar-item"
      :class="{ active: current === item.key }"
      @tap="handleTabClick(item)"
    >
      <image class="tabbar-icon" :src="current === item.key ? item.selectedIcon : item.icon" />
      <text class="tabbar-title">{{ item.title }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro from "@tarojs/taro"
// import SuperImage from "../SuperImage/index.vue"
import homeIcon from "../../assets/tabIcons/shouye.png"
import homeActiveIcon from "../../assets/tabIcons/shouye-active.png"
import discoverIcon from "../../assets/tabIcons/faxian.png"
import discoverActiveIcon from "../../assets/tabIcons/faxian-active.png"
import userIcon from "../../assets/tabIcons/wode.png"
import userActiveIcon from "../../assets/tabIcons/wode-active.png"
import appointmentIcon from "../../assets/tabIcons/yuyue.png"
import appointmentActiveIcon from "../../assets/tabIcons/yuyue-active.png"
import { useUserStore } from "../../store/userStore"

interface TabItem {
  key: string
  title: string
  icon: string
  selectedIcon: string
  pagePath: string
}

interface Props {
  current: string
}

const props = defineProps<Props>()
const emit = defineEmits(["change"])

const safeAreaBottom = ref(0)

const tabList: TabItem[] = [
  {
    key: "home",
    title: "首页",
    icon: homeIcon,
    selectedIcon: homeActiveIcon,
    pagePath: "/pages/recommend/index/index"
  },
  {
    key: "discover",
    title: "发现",
    icon: discoverIcon,
    selectedIcon: discoverActiveIcon,
    pagePath: "/pages/discover/index/index"
  },
  {
    key: "appointment",
    title: "预约",
    icon: appointmentIcon,
    selectedIcon: appointmentActiveIcon,
    pagePath: "/pages/appointment/list/index"
  },
  {
    key: "user",
    title: "我的",
    icon: userIcon,
    selectedIcon: userActiveIcon,
    pagePath: "/pages/user/profile/index"
  }
]

onMounted(async () => {
  // 获取底部安全区域高度
  try {
    // H5 环境下不使用小程序安全区算法，避免出现异常超大 padding-bottom（如 982px）
    if (process.env.TARO_ENV === "h5") {
      safeAreaBottom.value = 0
    } else {
    // 使用新的API代替已废弃的getSystemInfoSync
    const windowInfo = Taro.getWindowInfo()
    safeAreaBottom.value = windowInfo.safeArea
      ? windowInfo.screenHeight - windowInfo.safeArea.bottom
      : 0
    }
  } catch (e) {
    console.error("获取安全区域失败", e)
  }

  // 获取当前页面路径并设置正确的激活状态
  const pages = Taro.getCurrentPages()
  if (pages && pages.length > 0) {
    const currentPage = pages[pages.length - 1]
    const route = currentPage.route || currentPage.__route__

    // 根据路径设置当前激活的tab
    if (route) {
      if (route.includes("/pages/index/")) {
        emit("change", "home")
      } else if (route.includes("/pages/discover/")) {
        emit("change", "discover")
      } else if (route.includes("/pages/appointment/list/")) {
        emit("change", "appointment")
      } else if (route.includes("/pages/user/")) {
        emit("change", "user")
      }
    }
  }
})

const handleTabClick = async (item: TabItem) => {
  if (item.key !== props.current) {
    const userStore = useUserStore()
    // 检查是否需要登录（除了首页和发现，其他页面都需要登录）
    if (["appointment", "user"].includes(item.key) && !userStore.isLoggedIn) {
      console.log("handleTabClick IN /pages/user/login/index")
      // 未登录，跳转到登录页
      Taro.navigateTo({
        url: "/pages/user/login/index"
      })
      return
    }

    emit("change", item.key)
    Taro.switchTab({
      url: item.pagePath
    })
  }
}
</script>

<style lang="less">
.custom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(100px + env(safe-area-inset-bottom)); // 底部安全区域高度
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-around;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  z-index: 100;

  .tabbar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    height: 100%;

    &.active {
      .tabbar-title {
        color: #393548;
      }
    }

    .tabbar-icon {
      width: 40px;
      height: 40px;
      margin-top: 12px;
      margin-bottom: 8px;
    }

    .tabbar-icon-appointment {
      width: 128px;
      height: 128px;
      margin-top: -30px;
    }

    .tabbar-title {
      font-size: 24px;
      color: #999;
    }
  }
}
</style>
