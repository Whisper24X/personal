<template>
  <view class="guardian-selector">
    <view v-if="loading" class="loading-container">
      <view class="loading-spinner"></view>
      <view class="loading-text">加载中...</view>
    </view>

    <view v-else-if="guardianList.length > 0" class="guardian-list">
      <view
        v-for="guardian in guardianList"
        :key="guardian.id"
        class="guardian-item"
        @tap="selectGuardian(guardian)"
      >
        <view class="guardian-info">
          <view class="guardian-name">{{ guardian.parentName }}</view>
          <view class="guardian-phone">{{ guardian.parentPhone }}</view>
        </view>
        <OlCheckbox :checked="selectedGuardianPhone === guardian.parentPhone" />
      </view>
    </view>

    <view v-else class="empty-tip">
      <view class="empty-text">暂无监护人信息</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue"
import Taro, { useDidShow } from "@tarojs/taro"
import { queryParentInfo } from "@/api/parent"
import OlCheckbox from "@/components/OlCheckbox/index.vue"

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

// 监听props变化，更新选中的监护人身份证号
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
  width: 100%;
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

.guardian-list {
  width: 100%;
}

.guardian-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 0 0;

  .guardian-info {
    flex: 1;

    .guardian-name {
      font-family: "PingFang SC", sans-serif;
      font-size: 28rpx;
      font-weight: normal;
      line-height: 28rpx;
      letter-spacing: normal;
      color: #393548;
      margin-bottom: 8rpx;
    }

    .guardian-phone {
      font-family: "PingFang SC", sans-serif;
      font-size: 24rpx;
      font-weight: normal;
      line-height: 24rpx;
      letter-spacing: normal;
      color: #999;
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
