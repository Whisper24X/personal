<template>
  <tab-bar-layout
    tab-key="user-agreement"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: navTitle, theme: 'light' }"
  >
    <!-- 自定义导航栏 -->
    <view v-if="type === 'privacy'" class="agreement-container">
      <PrivacyPolicy />
    </view>
    <view v-else-if="type === 'children'" class="agreement-container">
      <ChildrenPrivacyPolicy />
    </view>
    <view v-else-if="type === 'payment'" class="agreement-container">
      <PaymentAgreement />
    </view>
    <view v-else-if="type === 'storedValueCard'" class="agreement-container">
      <StoredValueCardRules />
    </view>
    <view v-else class="agreement-container">
      <UserServiceAgreement />
    </view>
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import Taro from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import UserServiceAgreement from "./UserServiceAgreement.vue"
import PrivacyPolicy from "./PrivacyPolicy.vue"
import ChildrenPrivacyPolicy from "./ChildrenPrivacyPolicy.vue"
import PaymentAgreement from "./PaymentAgreement.vue"
import StoredValueCardRules from "./StoredValueCardRules.vue"

const type = ref("")
// 根据查询参数type设置不同的协议类型
const instance = Taro.getCurrentInstance()
if (instance?.router?.params?.type) {
  type.value = instance.router.params.type as string
}
// 计算导航栏标题
const navTitle = computed(() => {
  if (type.value === "privacy") {
    return "隐私政策"
  } else if (type.value === "children") {
    return "儿童隐私政策"
  } else if (type.value === "payment") {
    return "付费协议"
  } else if (type.value === "storedValueCard") {
    return "储值卡使用规则"
  }
  return "用户协议"
})
</script>

<style lang="less">
.user-agreement {
  min-height: 100vh;
  background-color: #fff;
  padding-bottom: 40rpx;

  .agreement-container {
    width: 100%;
    height: 100%;
    padding-top: 0; // CustomNavBar 已经处理了状态栏高度
  }
}
</style>
