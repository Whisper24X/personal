<template>
  <tab-bar-layout
    tab-key="user"
    :show-tab-bar="true"
    :show-custom-nav-bar="true"
    :nav-bar-config="{
      title: '个人资料',
      showBack: false
    }"
  >
    <!-- 用户信息区域 -->
    <view class="user-info">
      <view class="user-profile-card" @tap="goToProfile">
        <view class="avatar">
          <image class="avatar-img" :src="avatar" mode="aspectFill" />
        </view>
        <view class="user-details">
          <view class="nickname">{{ nickname }}</view>
          <view v-if="!isLoggedIn" class="login-tip" @tap.stop="goToLogin">点击登录</view>
        </view>
        <image
          class="arrow-icon"
          src="https://fp.yangcong345.com/middle/yanxue/arrow-right-0b0254d48cdd8988e1ef9b07d03f6d74.png"
        />
      </view>
    </view>

    <!-- 常用工具 -->
    <view class="common-card">
      <view class="card-header">
        <text class="card-title">我的订单</text>
        <view class="view-all" @tap="goToAllOrders">
          <image
            class="arrow-icon-small"
            src="https://fp.yangcong345.com/middle/yanxue/arrow-right-0b0254d48cdd8988e1ef9b07d03f6d74.png"
          />
        </view>
      </view>
      <view class="order-status-grid">
        <view
          v-for="item in orderStatusList"
          :key="item.id"
          class="order-status-item"
          @tap="goToOrdersByStatus(item)"
        >
          <image class="status-icon" :src="item.icon" />
          <text class="status-text">{{ item.title }}</text>
        </view>
      </view>
    </view>

    <!-- 常用工具 -->
    <view class="common-card">
      <view class="card-header">
        <text class="card-title">常用工具</text>
      </view>
      <view class="profile-grid-list">
        <view v-for="item in toolsList" :key="item.id" class="grid-item" @tap="goToPage(item)">
          <image class="item-icon" :src="item.icon" />
          <text class="item-text">{{ item.title }}</text>
        </view>
      </view>
    </view>

    <!-- 信息 -->
    <view class="common-card">
      <view class="card-header">
        <text class="card-title">信息</text>
      </view>
      <view class="profile-grid-list">
        <view v-for="item in infoList" :key="item.id" class="grid-item" @tap="goToPage(item)">
          <image class="item-icon" :src="item.icon" />
          <text class="item-text">{{ item.title }}</text>
        </view>
      </view>
    </view>

    <!-- 退出登录按钮 -->
    <!-- <view v-if="isLoggedIn" class="logout-container">
        <button class="primary-button" @tap="handleLogout">退出登录</button>
      </view> -->

    <!-- 在线客服二维码弹框 -->
    <CustomerServiceModal v-model="showCustomerServiceModal" />
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import Taro, { useDidShow } from "@tarojs/taro"
import { getUserInfo } from "@/api/user"
import { checkLoginStatus, logout } from "@/api/auth"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import CustomerServiceModal from "@/components/CustomerServiceModal/index.vue"
import { useUserStore } from "@/store/userStore"
import { trackClick } from "@/utils/analytics"
import orderIcon from "@/assets/tabIcons/dingdan.png"

// 用户store
const userStore = useUserStore()

// 用户信息
const userDetailInfo = computed(() => userStore.userDetailInfo)
const isLoggedIn = computed(() => userStore.isLoggedIn)

// 客服弹框
const showCustomerServiceModal = ref(false)

// 计算属性
const avatar = computed(() => {
  const headimgurl = userDetailInfo.value?.userWxInfo?.headimgurl || userDetailInfo.value?.avatar
  return (
    headimgurl ||
    "https://fp.yangcong345.com/middle/1.0.0/user_icon_visiter@3x.png?x-tos-process=image/resize,w_200&x-bce-process=image/resize,w_200"
  )
})

const nickname = computed(() => {
  return userDetailInfo.value?.userWxInfo?.nickname || userDetailInfo.value?.nickname || "游客"
})

// 订单状态列表
const orderStatusList = [
  {
    id: 1,
    title: "待付款",
    status: "pendingPayment",
    icon: "https://fp.yangcong345.com/middle/1.0.0/pending-payment-49beb3aa3401f3ecc9ecba11061b43c2__w.png"
  },
  {
    id: 2,
    title: "已购买",
    status: "pending",
    icon: "https://fp.yangcong345.com/middle/1.0.0/payment-success-c37f7a1e0ae7276ad22800923d6e966a__w.png"
  },
  {
    id: 3,
    title: "交易关闭",
    status: "closed",
    icon: "https://fp.yangcong345.com/middle/1.0.0/transaction-closed-1-8-cb2ecce1510b8d24a20f6f4c7c5dca9b__w.png"
  },
  {
    id: 4,
    title: "退款/售后",
    status: "refunded",
    icon: "https://fp.yangcong345.com/middle/1.0.0/refund-0fb04b5ca575513fd370fa08bdcc10af__w.png"
  }
]

// 常用工具列表
const toolsList = [
  {
    id: 1,
    title: "我的优惠券",
    path: "/pages/coupon/list/index",
    icon: "https://fp.yangcong345.com/middle/1.0.0/coupon@1x-64a3fc6d372986779c1ac566b0773431.png"
  },
  {
    id: 2,
    title: "在线客服",
    path: "/pages/customer-service/index",
    icon: "https://fp.yangcong345.com/middle/1.0.0/customer@1x-69f784376a5f611bd44e649e2a01c767.png"
  },
  {
    id: 3,
    title: "预约记录",
    path: "/pages/appointment/records/index",
    icon: "https://fp.yangcong345.com/middle/1.0.0/calendar@1x-5c8f1d54188d4eb566c8fd1d953f7a07.png"
  }
]

// 信息列表
const infoList = [
  {
    id: 1,
    title: "营员信息",
    path: "/pages/user/familyInfo/childInfo/index?userType=child",
    icon: "https://fp.yangcong345.com/middle/1.0.0/friend@1x-2ebebc97e829b6020de155b9f0acb4e5.png"
  },
  {
    id: 2,
    title: "监护人信息",
    path: "/pages/user/familyInfo/parentInfo/index",
    icon: "https://fp.yangcong345.com/middle/1.0.0/parent@1x-d0e9cfaf087ef9d43a5f1896d189a532.png"
  }
  // {
  //   id: 3,
  //   title: "收货地址",
  //   path: "/pages/address/index",
  //   icon: "https://fp.yangcong345.com/middle/1.0.0/positioning@1x-f818ffa3c5b711872d1ebdd4bdcd6d03.png"
  // }
]

// 加载用户信息
const loadUserInfo = async () => {
  try {
    if (isLoggedIn.value) {
      const res = await getUserInfo()
      if (res.userInfo) {
        // 使用 userStore 保存用户信息
        userStore.setUserDetailInfo(res.userInfo)
      }
    }
  } catch (error) {
    console.error("获取用户信息失败:", error)
  }
}

// 检查登录状态
const checkAuth = () => {
  if (checkLoginStatus()) {
    // userStore 会自动从本地存储初始化用户信息
    loadUserInfo()
  }
}

// 跳转到登录页面
const goToLogin = () => {
  Taro.navigateTo({
    url: "/pages/user/login/index"
  })
}

// 跳转到个人资料页面
const goToProfile = () => {
  if (!isLoggedIn.value) {
    goToLogin()
    return
  }
  Taro.navigateTo({
    url: "/pages/user/settings/index"
  })
}

// 跳转到指定页面
const goToPage = (item: { id: number; path: string }) => {
  if (!isLoggedIn.value) {
    Taro.showToast({
      title: "请先登录",
      icon: "none"
    })
    goToLogin()
    return
  }

  // 特殊处理在线客服
  if (item.path === "/pages/customer-service/index") {
    showCustomerServiceModal.value = true
    trackClick("online_customer_service")
    return
  }

  Taro.navigateTo({
    url: item.path
  })
}

// 跳转到全部订单
const goToAllOrders = () => {
  if (!isLoggedIn.value) {
    Taro.showToast({
      title: "请先登录",
      icon: "none"
    })
    goToLogin()
    return
  }
  Taro.navigateTo({
    url: "/pages/order/list/index"
  })
}

// 按状态跳转到订单列表
const goToOrdersByStatus = (item: { status: string; title: string }) => {
  if (!isLoggedIn.value) {
    Taro.showToast({
      title: "请先登录",
      icon: "none"
    })
    goToLogin()
    return
  }
  Taro.navigateTo({
    url: `/pages/order/list/index?status=${item.status}`
  })
}

// 退出登录
const handleLogout = () => {
  Taro.showModal({
    title: "提示",
    content: "确定要退出登录吗？",
    success: res => {
      if (res.confirm) {
        logout()

        Taro.showToast({
          title: "已退出登录",
          icon: "success"
        })
      }
    }
  })
}

// 页面显示时检查登录状态
useDidShow(() => {
  checkAuth()
})

onMounted(() => {
  checkAuth()
})
</script>

<style lang="less">
// 用户信息区域
.user-info {
  padding: 0 32rpx 8rpx;
}

// 通用样式类
.common-card {
  margin: 0 32rpx 32rpx;
  background: #ffffff;
  border-radius: 24rpx;
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 32px 0;

  .card-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333333;
  }

  .arrow-icon {
    width: 48rpx;
    height: 48rpx;
  }
}

.profile-grid-list {
  display: flex;
  justify-content: flex-start;
  padding: 32rpx 0;

  .grid-item {
    width: 25%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 16rpx;

    .item-icon {
      width: 48rpx;
      height: 48rpx;
      margin-bottom: 24rpx;
    }

    .item-text {
      font-size: 24rpx;
      color: #393548;
      text-align: center;
    }
  }
}

.primary-button {
  width: 100%;
  height: 88rpx;
  background: #ffffff;
  border: 2rpx solid #ff4757;
  color: #ff4757;
  border-radius: 16rpx;
  font-size: 32rpx;
  font-weight: 500;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.user-profile-card {
  display: flex;
  align-items: center;
  padding: 32rpx 0;

  .avatar {
    margin-right: 16rpx;
    line-height: 0;

    .avatar-img {
      width: 108rpx;
      height: 108rpx;
      border-radius: 50%;
      border: 4rpx solid #ffffff;
    }
  }

  .user-details {
    flex: 1;

    .nickname {
      font-size: 32rpx;
      font-weight: 600;
      color: #393548;
      margin-bottom: 8rpx;
    }

    .login-tip {
      font-size: 24rpx;
      color: #007aff;
      padding: 8rpx 16rpx;
      background: rgba(0, 122, 255, 0.1);
      border-radius: 12rpx;
      display: inline-block;
    }
  }

  .arrow-icon {
    width: 48rpx;
    height: 48rpx;
  }
}

// 退出登录按钮
.logout-container {
  margin: 0 32rpx 40rpx;
}

// 订单状态网格
.order-status-grid {
  display: flex;
  justify-content: space-around;
  padding: 44rpx 0 32rpx 0;

  .order-status-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24rpx;

    .status-icon {
      width: 48rpx;
      height: 48rpx;
    }

    .status-text {
      font-size: 24rpx;
      color: #393548;
      text-align: center;
    }
  }
}

.view-all {
  display: flex;
  align-items: center;

  .arrow-icon-small {
    width: 48rpx;
    height: 48rpx;
  }
}
</style>
