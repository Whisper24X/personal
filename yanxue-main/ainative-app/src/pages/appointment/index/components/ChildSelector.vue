<template>
  <view class="child-selector">
    <view v-if="loading" class="loading-container">
      <view class="loading-spinner"></view>
      <view class="loading-text">加载中...</view>
    </view>

    <view v-else-if="childList.length > 0" class="child-list">
      <view v-for="child in childList" :key="child.id" class="child-item" @tap="selectChild(child)">
        <view class="child-info">
          <view class="child-name">{{ child.name }}</view>
        </view>
        <OlCheckbox :checked="selectedChildId === child.id" />
      </view>
    </view>
    <view v-else class="empty-tip">
      <view class="empty-text">暂无营员信息</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue"
import Taro, { useDidShow } from "@tarojs/taro"
import { getUserBindStudentList } from "@/api/child"
import OlCheckbox from "@/components/OlCheckbox/index.vue"

interface ChildInfo {
  id: string
  name: string
  gender: string
  age: number
  idCard: string
}

interface Props {
  modelValue: {
    id?: string
    studentName: string
    studentIdentityCard: string
    studentSex: string
    studentAge: number
  }
}

const props = defineProps<Props>()
const emit = defineEmits(["update:modelValue", "change", "load"])

const childList = ref<ChildInfo[]>([])
const loading = ref(false)
const selectedChildId = ref("")

// 监听props变化，更新选中的孩子ID
watch(
  () => props.modelValue,
  newValue => {
    if (newValue && newValue.id) {
      selectedChildId.value = newValue.id
    }
  },
  { immediate: true }
)

// 选择孩子
const selectChild = (child: ChildInfo) => {
  selectedChildId.value = child.id

  const selectedChild = {
    id: child.id,
    studentName: child.name,
    studentIdentityCard: child.idCard,
    studentSex: child.gender,
    studentAge: child.age
  }

  emit("update:modelValue", selectedChild)
  emit("change", selectedChild)
}

// 加载营员信息列表
const loadChildList = async () => {
  loading.value = true
  try {
    const res = await getUserBindStudentList()
    if (res.list) {
      childList.value = res.list.map(item => ({
        id: item.id,
        name: item.studentName,
        gender: item.studentSex,
        age: item.studentAge,
        idCard: item.studentIdentityCard
      }))
      emit("load", childList.value)
    }
  } catch (error) {
    console.error("获取营员信息列表失败", error)
    Taro.showToast({
      title: "获取数据失败，请重试",
      icon: "none"
    })
  } finally {
    loading.value = false
  }
}

// 初始化加载孩子列表
useDidShow(() => {
  loadChildList()
})
onMounted(() => {
  loadChildList()
})
</script>

<style lang="less">
.child-selector {
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

.child-list {
  width: 100%;
}

.child-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 0 0;

  .child-info {
    .child-name {
      font-family: "PingFang SC", sans-serif;
      font-size: 28rpx;
      font-weight: normal;
      line-height: 28rpx;
      letter-spacing: normal;
      color: #393548;
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
  }
}
</style>
