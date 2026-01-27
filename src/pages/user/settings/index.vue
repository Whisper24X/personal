<template>
  <TabBarLayout
    tab-key="wode"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '个人资料' }"
  >
    <!-- 用户信息设置卡片 -->
    <view class="settings-card">
      <!-- 头像 -->
      <view class="setting-item">
        <view class="item-label">头像</view>
        <view class="item-content">
          <button class="avatar-button" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
            <image class="avatar-img" :src="userInfo.avatar" mode="aspectFill" />
          </button>
          <image
            class="arrow-icon"
            src="https://fp.yangcong345.com/middle/yanxue/arrow-right-0b0254d48cdd8988e1ef9b07d03f6d74.png"
          />
        </view>
      </view>

      <!-- 昵称 -->
      <view class="setting-item">
        <view class="item-label">昵称</view>
        <view class="item-content">
          <input
            v-model="userInfo.nickname"
            class="nickname-input-inline"
            type="nickname"
            placeholder="请输入昵称"
            @blur="onNicknameBlur"
            @input="onNicknameInput"
          />
          <image
            class="arrow-icon"
            src="https://fp.yangcong345.com/middle/yanxue/arrow-right-0b0254d48cdd8988e1ef9b07d03f6d74.png"
          />
        </view>
      </view>

      <!-- 电话 -->
      <!-- <view class="setting-item" @tap="handlePhoneChange">
        <view class="item-label">电话</view>
        <view class="item-content">
          <text class="item-value">{{ userInfo.phone || "未设置" }}</text>
          <image
            class="arrow-icon"
            src="https://fp.yangcong345.com/middle/yanxue/arrow-right-0b0254d48cdd8988e1ef9b07d03f6d74.png"
          />
        </view>
      </view> -->

      <!-- 我的地址 -->
      <!-- <view class="setting-item" @tap="handleAddressChange">
        <view class="item-label">我的地址</view>
        <view class="item-content">
          <text class="item-value">{{ userInfo.address || "未设置" }}</text>
          <image
            class="arrow-icon"
            src="https://fp.yangcong345.com/middle/yanxue/arrow-right-0b0254d48cdd8988e1ef9b07d03f6d74.png"
          />
        </view>
      </view> -->

      <!-- 生日 -->
      <!-- <view class="setting-item" @tap="handleBirthdayChange">
        <view class="item-label">生日</view>
        <view class="item-content">
          <text class="item-value" :class="{ unset: !userInfo.birthday }">{{
            userInfo.birthday || "未设置"
          }}</text>
          <image
            class="arrow-icon"
            src="https://fp.yangcong345.com/middle/yanxue/arrow-right-0b0254d48cdd8988e1ef9b07d03f6d74.png"
          />
        </view>
      </view> -->
    </view>

    <!-- 电话编辑弹框 -->
    <UiModal
      v-model:visible="showPhoneModal"
      title="编辑电话"
      :left-button="true"
      left-button-text="取消"
      :right-button="true"
      right-button-text="确定"
      @left-button-click="showPhoneModal = false"
      @right-button-click="savePhone"
    >
      <view class="input-container">
        <input
          v-model="tempPhone"
          class="phone-input"
          placeholder="请输入手机号"
          type="number"
          maxlength="11"
        />
      </view>
    </UiModal>

    <!-- 地址编辑弹框 -->
    <UiModal
      v-model:visible="showAddressModal"
      title="编辑地址"
      :left-button="true"
      left-button-text="取消"
      :right-button="true"
      right-button-text="确定"
      @left-button-click="showAddressModal = false"
      @right-button-click="saveAddress"
    >
      <view class="input-container">
        <textarea
          v-model="tempAddress"
          class="address-input"
          placeholder="请输入详细地址"
          maxlength="100"
        />
      </view>
    </UiModal>

    <!-- 生日选择弹框 -->
    <UiModal
      v-model:visible="showBirthdayModal"
      title="选择生日"
      :left-button="true"
      left-button-text="取消"
      :right-button="true"
      right-button-text="确定"
      @left-button-click="showBirthdayModal = false"
      @right-button-click="saveBirthday"
    >
      <view class="date-picker-container">
        <picker mode="date" :value="tempBirthday" @change="onBirthdayChange">
          <view class="date-picker">
            <text class="date-text">{{ tempBirthday || "请选择生日" }}</text>
            <image
              class="arrow-icon"
              src="https://fp.yangcong345.com/middle/yanxue/arrow-right-0b0254d48cdd8988e1ef9b07d03f6d74.png"
            />
          </view>
        </picker>
      </view>
    </UiModal>
  </TabBarLayout>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from "vue"
import Taro from "@tarojs/taro"
import UiModal from "@/components/Ui/modal/index.vue"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import { updateUserInfo, batchUpdateUserInfo } from "./service"
import { fileUpload } from "@/utils/fileUpload"
import { useUserStore } from "@/store/userStore"

// 用户store
const userStore = useUserStore()

// 响应式数据
const userInfo = reactive({
  avatar: "",
  nickname: "",
  phone: "",
  address: "",
  birthday: ""
})

// 弹框状态
const showPhoneModal = ref(false)
const showAddressModal = ref(false)
const showBirthdayModal = ref(false)

// 临时编辑数据
const tempPhone = ref("")
const tempAddress = ref("")
const tempBirthday = ref("")

// 初始化用户信息
const initUserInfo = () => {
  const storedUserInfo = userStore.userDetailInfo || {}
  const storeUserInfo = storedUserInfo?.userWxInfo

  userInfo.avatar =
    storeUserInfo?.headimgurl ||
    storedUserInfo.avatar ||
    "https://fp.yangcong345.com/middle/1.0.0/user_icon_visiter@3x.png"
  userInfo.nickname = storeUserInfo?.nickname || storedUserInfo.nickname || ""
  userInfo.phone = storedUserInfo.phone || ""
  userInfo.address = storedUserInfo.address || ""
  userInfo.birthday = storedUserInfo.birthday || ""
}

// 头像选择回调
const onChooseAvatar = async e => {
  const { avatarUrl } = e.detail
  try {
    Taro.showLoading({ title: "上传中..." })

    // 使用新的上传函数上传头像
    const uploadResult = await fileUpload({
      autoFilePaths: [avatarUrl],
      filePath: "yanxue/avatar"
    })

    // 更新头像URL
    userInfo.avatar = uploadResult.url

    await saveUserInfo()

    Taro.showToast({
      title: "头像更新成功",
      icon: "success"
    })
  } catch (error) {
    console.error("上传头像失败:", error)
    Taro.showToast({
      title: "上传失败",
      icon: "none"
    })
  } finally {
    Taro.hideLoading()
  }
}

// 昵称输入处理
const onNicknameInput = async e => {
  try {
    userInfo.nickname = e.detail.value
    await saveUserInfo()
    Taro.showToast({
      title: "昵称更新成功",
      icon: "success"
    })
  } catch (error) {
    console.error("昵称输入处理失败:", error)
    Taro.showToast({
      title: "昵称更新失败",
      icon: "none"
    })
  }
}

// 昵称失焦处理
const onNicknameBlur = async () => {
  if (userInfo.nickname.trim()) {
    await saveUserInfo()
    Taro.showToast({
      title: "昵称更新成功",
      icon: "success"
    })
  }
}

// 处理电话修改
const handlePhoneChange = () => {
  tempPhone.value = userInfo.phone
  showPhoneModal.value = true
}

// 保存电话
const savePhone = async () => {
  if (!tempPhone.value.trim()) {
    Taro.showToast({
      title: "电话不能为空",
      icon: "none"
    })
    return
  }

  // 简单的手机号验证
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(tempPhone.value)) {
    Taro.showToast({
      title: "请输入正确的手机号",
      icon: "none"
    })
    return
  }

  userInfo.phone = tempPhone.value.trim()
  showPhoneModal.value = false

  await saveUserInfo()

  Taro.showToast({
    title: "电话更新成功",
    icon: "success"
  })
}

// 处理地址修改
const handleAddressChange = () => {
  tempAddress.value = userInfo.address
  showAddressModal.value = true
}

// 保存地址
const saveAddress = async () => {
  if (!tempAddress.value.trim()) {
    Taro.showToast({
      title: "地址不能为空",
      icon: "none"
    })
    return
  }

  userInfo.address = tempAddress.value.trim()
  showAddressModal.value = false

  await saveUserInfo()

  Taro.showToast({
    title: "地址更新成功",
    icon: "success"
  })
}

// 处理生日修改
const handleBirthdayChange = () => {
  tempBirthday.value = userInfo.birthday
  showBirthdayModal.value = true
}

// 生日选择变化
const onBirthdayChange = e => {
  tempBirthday.value = e.detail.value
}

// 保存生日
const saveBirthday = async () => {
  if (!tempBirthday.value) {
    Taro.showToast({
      title: "请选择生日",
      icon: "none"
    })
    return
  }

  userInfo.birthday = tempBirthday.value
  showBirthdayModal.value = false

  await saveUserInfo()

  Taro.showToast({
    title: "生日更新成功",
    icon: "success"
  })
}

// 保存用户信息到服务器
const saveUserInfo = async () => {
  try {
    // 确保所有必填字段都有值
    const userData = {
      nickname: userInfo.nickname || "",
      avatar: userInfo.avatar || "https://fp.yangcong345.com/middle/1.0.0/user_icon_visiter@3x.png",
      address: userInfo.address || "",
      birthday: userInfo.birthday || ""
    }

    // 使用 userStore 更新用户信息
    userStore.updateUserInfo(userData)

    // 调用更新用户信息的API
    await batchUpdateUserInfo(userData)
    Taro.showToast({
      title: "用户信息更新成功",
      icon: "success"
    })
    Taro.navigateBack()
  } catch (error) {
    console.error("保存用户信息失败:", error)
    Taro.showToast({
      title: "保存失败",
      icon: "none"
    })
    throw error
  }
}

// 监听 userStore 变化
watch(
  // () => [userStore.userDetailInfo, userStore.userInfo],
  () => {
    initUserInfo()
  },
  { deep: true }
)

// 页面加载时初始化
onMounted(() => {
  initUserInfo()
})
</script>

<style lang="less">
.settings-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

.settings-card {
  margin: 32rpx;
  padding: 0 32rpx;
  background: #ffffff;
  border-radius: 24rpx;
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 0;
  border-bottom: 1rpx solid #efeef3;

  &:last-child {
    border-bottom: none;
  }

  .item-label {
    font-size: 32rpx;
    color: #393548;
  }

  .item-content {
    display: flex;
    align-items: center;

    .item-value {
      margin-right: 16rpx;
      font-size: 32rpx;
      color: #393548;
      font-weight: 600;

      &.unset {
        color: #999999;
      }
    }

    .avatar-button {
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      border-radius: 50%;
      overflow: hidden;

      &::after {
        border: none;
      }
    }

    .avatar-img {
      width: 80rpx;
      height: 80rpx;
      border-radius: 50%;
      display: block;
    }

    .nickname-input-inline {
      flex: 1;
      height: 60rpx;
      font-size: 32rpx;
      color: #333333;
      text-align: right;
      background: transparent;
      border: none;
      outline: none;

      &::placeholder {
        color: #999999;
      }
    }

    .arrow-icon {
      width: 48rpx;
      height: 48rpx;
    }
  }
}

// 输入框容器
.input-container {
  padding: 40rpx 0;

  .nickname-input,
  .phone-input {
    width: 100%;
    height: 80rpx;
    padding: 0 24rpx;
    border: 2rpx solid #e0e0e0;
    border-radius: 12rpx;
    font-size: 32rpx;
    color: #333333;
    background: #ffffff;

    &:focus {
      border-color: #007aff;
    }
  }

  .address-input {
    width: 100%;
    min-height: 120rpx;
    padding: 24rpx;
    border: 2rpx solid #e0e0e0;
    border-radius: 12rpx;
    font-size: 32rpx;
    color: #333333;
    background: #ffffff;

    &:focus {
      border-color: #007aff;
    }
  }
}

// 日期选择器
.date-picker-container {
  padding: 40rpx 0;

  .date-picker {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx;
    border: 2rpx solid #e0e0e0;
    border-radius: 12rpx;
    background: #ffffff;

    .date-text {
      font-size: 32rpx;
      color: #333333;
    }

    .arrow-icon {
      width: 24rpx;
      height: 24rpx;
    }
  }
}
</style>
