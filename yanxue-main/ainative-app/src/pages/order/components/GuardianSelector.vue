<template>
  <view class="guardian-selector">
    <view class="guardian-selector-header">
      <view class="header-left">
        <image
          class="header-icon"
          src="https://fp.yangcong345.com/middle/1.0.0/yanxue/parent__w.png"
        />
        <view class="header-title">选择监护人</view>
      </view>
      <view class="header-right" @tap="openGuardianManager">
        <view class="add-text">添加/管理监护人信息</view>
        <image class="add-icon" src="https://fp.yangcong345.com/middle/1.0.0/yanxue/jia__w.png" />
      </view>
    </view>

    <!-- 监护人列表 -->
    <view v-if="loading" class="loading-container">
      <view class="loading-spinner"></view>
      <view class="loading-text">加载中...</view>
    </view>

    <view v-else-if="guardianList.length > 0" class="guardian-selector-list">
      <view
        v-for="guardian in guardianList"
        :key="guardian.id"
        :class="['guardian-card', { selected: selectedGuardianPhone === guardian.parentPhone }]"
        @tap="selectGuardian(guardian)"
      >
        <view class="guardian-info">
          <view class="guardian-name">{{ guardian.parentName }}</view>
          <view class="guardian-phone">手机号 {{ guardian.parentPhone }}</view>
        </view>
        <view v-if="selectedGuardianPhone === guardian.parentPhone" class="check-icon">
          <image src="https://fp.yangcong345.com/middle/1.0.0/yanxue/duigou__w.png" />
        </view>
      </view>
    </view>

    <!-- 监护人管理弹窗 -->
    <GuardianManagerSheet
      :show="guardianManagerVisible"
      @close="closeGuardianManager"
      @guardian-added="handleGuardianAdded"
      @guardian-updated="handleGuardianUpdated"
      @guardian-selected="handleGuardianSelected"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue"
import Taro, { useDidShow } from "@tarojs/taro"
import { queryParentInfo } from "@/api/parent"
import GuardianManagerSheet from "./GuardianManagerSheet.vue"

interface GuardianInfo {
  id: string
  parentName: string
  parentPhone: string
  parentSex: string
}

interface Props {
  modelValue: {
    parentName: string
    parentPhone: string
    parentSex: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits(["update:modelValue", "change", "load"])

const guardianList = ref<GuardianInfo[]>([])
const loading = ref(false)
const selectedGuardianPhone = ref("")
const guardianManagerVisible = ref(false)

// 监听props变化，更新选中的监护人手机号
watch(
  () => props.modelValue,
  newValue => {
    if (newValue && newValue.parentPhone) {
      selectedGuardianPhone.value = newValue.parentPhone
    }
  },
  { immediate: true }
)

// 选择监护人
const selectGuardian = (guardian: GuardianInfo) => {
  selectedGuardianPhone.value = guardian.parentPhone

  const selectedGuardian = {
    parentName: guardian.parentName,
    parentPhone: guardian.parentPhone,
    parentSex: guardian.parentSex
  }

  emit("update:modelValue", selectedGuardian)
  emit("change", selectedGuardian)
}

// 打开监护人管理弹窗
const openGuardianManager = () => {
  guardianManagerVisible.value = true
}

// 关闭监护人管理弹窗
const closeGuardianManager = () => {
  guardianManagerVisible.value = false
}

// 处理监护人添加
const handleGuardianAdded = (guardian: GuardianInfo) => {
  guardianList.value.push(guardian)
  // 自动选择新添加的监护人
  selectGuardian(guardian)
}

// 处理监护人更新
const handleGuardianUpdated = (updatedGuardian: GuardianInfo) => {
  const index = guardianList.value.findIndex(guardian => guardian.id === updatedGuardian.id)
  if (index !== -1) {
    guardianList.value[index] = updatedGuardian
    // 如果当前选中的是更新的监护人，更新选中状态
    if (selectedGuardianPhone.value === updatedGuardian.parentPhone) {
      selectGuardian(updatedGuardian)
    }
  }
}

// 处理监护人选择
const handleGuardianSelected = (guardian: GuardianInfo) => {
  selectGuardian(guardian)
  closeGuardianManager()
}

// 加载监护人信息列表
const loadGuardianList = async () => {
  loading.value = true
  try {
    const res = await queryParentInfo()
    if (res.parentInfo) {
      guardianList.value = res.parentInfo
      emit("load", guardianList.value)
    }
  } catch (error) {
    console.error("获取监护人信息列表失败", error)
    Taro.showToast({
      title: "获取数据失败，请重试",
      icon: "none"
    })
  } finally {
    loading.value = false
  }
}

// 检查是否有从监护人列表页面返回的选中数据
const checkSelectedParent = () => {
  const selectedParent = Taro.getStorageSync("selectedParent")
  if (selectedParent) {
    try {
      const parentInfo = JSON.parse(selectedParent)
      const selectedGuardian = {
        parentName: parentInfo.parentName,
        parentPhone: parentInfo.parentPhone,
        parentSex: parentInfo.parentSex
      }

      emit("update:modelValue", selectedGuardian)
      emit("change", selectedGuardian)

      // 清除存储
      Taro.removeStorageSync("selectedParent")
    } catch (error) {
      console.error("解析监护人信息失败", error)
    }
  }
}

// 初始化加载监护人列表
useDidShow(() => {
  loadGuardianList()
  checkSelectedParent()
})
onMounted(() => {
  loadGuardianList()
  checkSelectedParent()
})
</script>

<style lang="less">
.guardian-selector {
  padding: 32rpx;
  background-color: #fff;
  width: 100%;
  border-radius: 24rpx;
}

.guardian-selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .header-left {
    display: flex;
    align-items: center;

    .header-icon {
      height: 36rpx;
      width: 36rpx;
      margin-right: 12rpx;
    }

    .header-title {
      font-family: PingFang SC;
      font-size: 32px;
      font-weight: normal;
      line-height: 32px;
      color: #393548;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    font-family: PingFang SC;
    font-size: 28px;
    font-weight: 600;
    line-height: 28px;
    text-align: right;
    color: #518aff;

    .add-text {
      margin-right: 16rpx;
    }

    .add-icon {
      width: 30rpx;
      height: 30rpx;
    }
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx 0;

  .loading-spinner {
    width: 64rpx;
    height: 64rpx;
    border: 6rpx solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: #4a90e2;
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 24rpx;
  }

  .loading-text {
    font-size: 28rpx;
    color: #999;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
}

.guardian-selector-list {
  margin-top: 32rpx;
  width: 100%;
}

.guardian-card {
  border: 2px solid transparent;
  box-sizing: border-box;
  border-radius: 18rpx;
  padding: 24rpx 32px;
  margin-bottom: 16rpx;
  position: relative;
  transition: all 0.3s ease;
  overflow: hidden;
  background: #f7f7f9;
  &:last-child {
    margin-bottom: 0;
  }
  &.selected {
    background: rgba(81, 138, 255, 0.06);
    border: 2rpx solid #518aff;
  }

  .guardian-info {
    .guardian-name {
      font-family: PingFang SC;
      font-size: 32px;
      font-weight: 600;
      line-height: 32px;
      color: #3d3d3d;
      margin-bottom: 24rpx;
    }

    .guardian-phone {
      font-family: PingFang SC;
      font-size: 28px;
      line-height: 28px;
      color: #3d3d3d;
    }
  }

  .check-icon {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 48rpx;
    height: 48rpx;
    background: #518aff;
    border-radius: 420px 0px 18px 0px;
    padding: 12rpx 4rpx 4rpx 12rpx;
    image {
      width: 32rpx;
      height: 32rpx;
    }
  }
}

.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30rpx 0;

  .empty-text {
    font-size: 28rpx;
    color: #999;
    margin-bottom: 32rpx;
  }

  .add-guardian-btn {
    padding: 16rpx 32rpx;
    background: #4a90e2;
    border-radius: 8rpx;

    text {
      font-size: 24rpx;
      color: #fff;
    }
  }
}
</style>
