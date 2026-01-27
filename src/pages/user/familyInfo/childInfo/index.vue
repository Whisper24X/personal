<template>
  <TabBarLayout
    tab-key="child"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{
      title: '营员信息'
    }"
  >
    <view
      class="child-container"
      :style="{
        height: `calc(100vh - ${getNavBarHeight()}rpx - 162rpx - env(safe-area-inset-bottom))`
      }"
    >
      <!-- 加载中 -->
      <view v-if="loading" class="loading-container">
        <text>加载中...</text>
      </view>

      <!-- 营员信息列表 -->
      <view v-else>
        <view v-if="childList.length > 0" class="child-list">
          <view v-for="child in childList" :key="child.id" class="child-item">
            <view class="child-left" @tap="() => handleEdit(child)">
              <view class="child-avatar">
                <image class="avatar-img" :src="child.avatar || defaultAvatar" mode="aspectFill" />
              </view>
              <view class="child-info">
                <view class="child-name">{{ child.name }}</view>
                <view class="child-meta">
                  <text class="child-age">{{ child.age }}岁</text>
                  <text class="child-gender">{{ child.gender === "M" ? "男" : "女" }}</text>
                </view>
              </view>
            </view>
            <view class="child-actions">
              <OnionButton
                class="delete-btn"
                type="hollow"
                transparent
                theme="white"
                size="small"
                border-color="red"
                @click="() => handleDelete(child)"
              >
                删除</OnionButton
              >
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <EmptyState v-else />
      </view>

      <!-- 添加按钮 -->
      <view class="add-btn-container">
        <OnionButton size="huge" type="default" round shadow :inline="false" @click="handleAddChild"
          >添加营员信息
        </OnionButton>
      </view>

      <!-- 删除确认弹窗 -->
      <OnionModal
        :visible="showDeleteModal"
        :content="`确定要删除 ${deleteChild?.name} 的营员信息吗？`"
        :left-button="true"
        left-button-text="取消"
        :right-button="true"
        right-button-text="确认删除"
        @update:visible="handleModalVisibleChange"
        @left-button-click="hideDeleteModal"
        @right-button-click="confirmDelete"
      />
    </view>
  </TabBarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro, { useRouter, useDidShow } from "@tarojs/taro"
import { getUserBindStudentList, deleteUserBindStudent } from "@/api/child"
import type { UserBindStudentInfo } from "@/api/child"
import EmptyState from "@/components/EmptyState/index.vue"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import OnionButton from "@/components/Ui/button/index.vue"
import OnionModal from "@/components/Ui/modal/index.vue"
import { getNavBarHeight } from "@/utils/statusBar"

interface ChildInfo {
  id: string
  name: string
  avatar?: string
  gender: string
  age: number
  idCard: string
}

// 获取路由参数
const router = useRouter()
const from = router.params.from

// 页面数据
const childList = ref<ChildInfo[]>([])
const loading = ref(false)
const showDeleteModal = ref(false)
const deleteChild = ref<ChildInfo | null>(null)
const defaultAvatar =
  "https://fp.yangcong345.com/middle/1.0.0/user_icon_visiter@3x.png?x-tos-process=image/resize,w_200&x-bce-process=image/resize,w_200"

// 添加营员信息
const handleAddChild = () => {
  // 检查数量限制
  if (childList.value.length >= 5) {
    Taro.showToast({
      title: "最多添加5个营员",
      icon: "none"
    })
    return
  }
  Taro.navigateTo({
    url: `/pages/user/familyInfo/childInfo/form`
  })
}

// 编辑营员信息
const handleEdit = (child: ChildInfo) => {
  // 如果是从预约页面跳转过来的，选择孩子后返回
  if (from === "appointment") {
    Taro.setStorageSync("selectedChild", {
      id: child.id,
      name: child.name,
      gender: child.gender,
      age: child.age,
      idCard: child.idCard
    })
    Taro.navigateBack()
    return
  }

  // 跳转到编辑页面
  Taro.navigateTo({
    url: `/pages/user/familyInfo/childInfo/form?mode=edit&id=${child.id}`
  })
}

// 删除营员信息
const handleDelete = (child: ChildInfo) => {
  deleteChild.value = child
  showDeleteModal.value = true
}

// 隐藏删除弹窗
const hideDeleteModal = () => {
  showDeleteModal.value = false
  deleteChild.value = null
}

// 处理模态框可见性变化
const handleModalVisibleChange = (visible: boolean) => {
  showDeleteModal.value = visible
  if (!visible) {
    deleteChild.value = null
  }
}

// 确认删除
const confirmDelete = async () => {
  if (!deleteChild.value) return

  try {
    await deleteUserBindStudent(deleteChild.value.id)

    Taro.showToast({
      title: "删除成功",
      icon: "success"
    })

    // 重新加载列表
    loadChildList()
    hideDeleteModal()
  } catch (error) {
    console.error("删除失败", error)
    Taro.showToast({
      title: "删除失败，请重试",
      icon: "none"
    })
  }
}

// 加载营员信息列表
const loadChildList = async () => {
  loading.value = true
  try {
    const res = await getUserBindStudentList()
    if (res.list) {
      childList.value = res.list.map((item: UserBindStudentInfo) => ({
        id: item.id,
        name: item.studentName,
        gender: item.studentSex,
        age: item.studentAge,
        idCard: item.studentIdentityCard
      }))
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

// 页面显示时刷新数据
useDidShow(() => {
  loadChildList()
})

onMounted(() => {
  loadChildList()
})
</script>

<style lang="less">
.child-container {
  overflow-y: auto;
  background: #f9f9f9;
  padding: 32rpx;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400rpx;

  text {
    font-size: 32rpx;
    color: #999999;
  }
}

.child-list {
  .child-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 32rpx;
    margin-bottom: 24rpx;
    background: #ffffff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);

    .child-left {
      display: flex;
      align-items: center;
      flex: 1;

      .child-avatar {
        margin-right: 24rpx;

        .avatar-img {
          width: 80rpx;
          height: 80rpx;
          border-radius: 50%;
          background: #f0f0f0;
        }
      }

      .child-info {
        flex: 1;

        .child-name {
          font-size: 32rpx;
          font-weight: 600;
          color: #333333;
          margin-bottom: 8rpx;
        }

        .child-meta {
          display: flex;
          align-items: center;

          .child-age {
            font-size: 24rpx;
            color: #666666;
            margin-right: 16rpx;
          }

          .child-gender {
            font-size: 24rpx;
            color: #666666;
            padding: 4rpx 12rpx;
            background: #f0f0f0;
            border-radius: 8rpx;
          }
        }
      }
    }

    .child-actions {
      display: flex;
      align-items: center;

      .edit-btn {
        margin-right: 16rpx;
      }
    }
  }
}

.add-btn-container {
  position: fixed;
  bottom: 40rpx;
  left: 32rpx;
  right: 32rpx;
  z-index: 999;

  .onion-button {
    width: 100%;
  }
}
</style>
