<template>
  <view class="child-selector">
    <view class="child-selector-header">
      <view class="header-left">
        <image
          class="header-icon"
          src="https://fp.yangcong345.com/middle/1.0.0/yanxue/child__w.png"
        />

        <view class="header-title">选择营员</view>
      </view>
      <view class="header-right" @tap="openChildManager">
        <view class="add-text">添加/管理营员信息</view>
        <image class="add-icon" src="https://fp.yangcong345.com/middle/1.0.0/yanxue/jia__w.png" />
      </view>
    </view>

    <view v-if="loading" class="loading-container">
      <view class="loading-spinner"></view>
      <view class="loading-text">加载中...</view>
    </view>

    <view v-else-if="childList.length > 0" class="child-selector-list">
      <view
        v-for="child in childList"
        :key="child.id"
        :class="['child-card', { selected: selectedChildId === child.id }]"
        @tap="selectChild(child)"
      >
        <view class="child-info">
          <view class="child-name">{{ child.name }}</view>
          <view class="child-details">
            <text class="gender">{{ child.gender === "男" ? "男" : "女" }} {{ child.age }}岁</text>
          </view>
          <view class="child-id">身份证 {{ child.idCard || "暂无" }}</view>
        </view>
        <view v-if="selectedChildId === child.id" class="check-icon">
          <image src="https://fp.yangcong345.com/middle/1.0.0/yanxue/duigou__w.png" />
        </view>
      </view>
    </view>

    <!-- 营员管理弹窗 -->
    <ChildManagerSheet
      :show="showChildManager"
      @close="closeChildManager"
      @child-added="handleChildAdded"
      @child-updated="handleChildUpdated"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue"
import Taro, { useDidShow } from "@tarojs/taro"
import { getUserBindStudentList } from "@/api/child"
import ChildManagerSheet from "./ChildManagerSheet.vue"

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
const showChildManager = ref(false)

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

// 打开营员管理弹窗
const openChildManager = () => {
  showChildManager.value = true
}

// 关闭营员管理弹窗
const closeChildManager = () => {
  showChildManager.value = false
}

// 处理营员添加
const handleChildAdded = (child: ChildInfo) => {
  childList.value.push(child)
  // 自动选择新添加的营员
  selectChild(child)
}

// 处理营员更新
const handleChildUpdated = (updatedChild: ChildInfo) => {
  const index = childList.value.findIndex(child => child.id === updatedChild.id)
  if (index !== -1) {
    childList.value[index] = updatedChild
    // 如果当前选中的是更新的营员，更新选中状态
    if (selectedChildId.value === updatedChild.id) {
      const selectedChild = {
        id: updatedChild.id,
        studentName: updatedChild.name,
        studentIdentityCard: updatedChild.idCard,
        studentSex: updatedChild.gender,
        studentAge: updatedChild.age
      }
      emit("update:modelValue", selectedChild)
      emit("change", selectedChild)
    }
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
  padding: 32rpx;
  background-color: #fff;
  width: 100%;
  border-radius: 24rpx;
  .child-selector-list {
    margin-top: 32rpx;
    width: 100%;
  }
  .child-selector-header {
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

  .child-card {
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

    .child-info {
      .child-name {
        font-family: PingFang SC;
        font-size: 32px;
        font-weight: 600;
        line-height: 32px;
        color: #3d3d3d;
        margin-bottom: 24rpx;
      }

      .child-details {
        margin-bottom: 24rpx;
        font-family: PingFang SC;
        font-size: 28px;
        line-height: 28px;
        color: #3d3d3d;
      }

      .child-id {
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
}
</style>
