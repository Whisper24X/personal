<template>
  <TabBarLayout
    tab-key="parent"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{
      title: '监护人信息'
    }"
  >
    <view
      class="parent-container"
      :style="{
        height: `calc(100vh - ${getNavBarHeight()}rpx - 162rpx - env(safe-area-inset-bottom))`
      }"
    >
      <!-- 加载中 -->
      <view v-if="loading" class="loading-container">
        <text>加载中...</text>
      </view>

      <!-- 监护人信息列表 -->
      <view v-else>
        <view v-if="parentList.length > 0" class="parent-list">
          <view v-for="parent in parentList" :key="parent.id" class="parent-item">
            <view class="parent-left" @tap="() => handleEdit(parent)">
              <view class="parent-avatar">
                <image class="avatar-img" :src="parent.avatar || defaultAvatar" mode="aspectFill" />
              </view>
              <view class="parent-info">
                <view class="parent-name">{{ parent.parentName }}</view>
                <view class="parent-meta">
                  <text class="parent-phone">{{ parent.parentPhone }}</text>
                  <text class="parent-sex">{{ parent.parentSex === "M" ? "男" : "女" }}</text>
                </view>
              </view>
            </view>
            <view class="parent-actions">
              <OnionButton
                class="delete-btn"
                type="hollow"
                transparent
                theme="white"
                size="small"
                border-color="red"
                @click="() => handleDelete(parent)"
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
        <OnionButton
          size="huge"
          type="default"
          round
          shadow
          :inline="false"
          @click="handleAddParent"
          >添加监护人信息
        </OnionButton>
      </view>
    </view>

    <!-- 删除确认弹窗 -->
    <OnionModal
      :visible="showDeleteModal"
      :content="`确定要删除 监护人${deleteParent?.parentName} 的信息吗？`"
      :left-button="true"
      left-button-text="取消"
      :right-button="true"
      right-button-text="删除"
      @update:visible="handleModalVisibleChange"
      @left-button-click="hideDeleteModal"
      @right-button-click="confirmDelete"
    />
  </TabBarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro, { useRouter } from "@tarojs/taro"
import TabBarLayout from "../../../../components/TabBarLayout/index.vue"
import OnionButton from "../../../../components/Ui/button/index.vue"
import EmptyState from "../../../../components/EmptyState/index.vue"
import OnionModal from "../../../../components/Ui/modal/index.vue"
import { queryParentInfo, storeParentInfo } from "@/api/parent"
import { getNavBarHeight } from "@/utils/statusBar"

interface ParentInfo {
  id: string
  parentName: string
  parentPhone: string
  parentSex: string
  avatar?: string
}

// 获取路由参数
const router = useRouter()
const from = router.params.from as string

// 数据状态
const loading = ref(false)
const parentList = ref<ParentInfo[]>([])
const showDeleteModal = ref(false)
const deleteParent = ref<ParentInfo | null>(null)
const defaultAvatar =
  "https://fp.yangcong345.com/middle/1.0.0/user_icon_visiter@3x.png?x-tos-process=image/resize,w_200&x-bce-process=image/resize,w_200"

// 添加监护人信息
const handleAddParent = () => {
  // 检查数量限制
  if (parentList.value.length >= 5) {
    Taro.showToast({
      title: "最多添加5个监护人",
      icon: "none"
    })
    return
  }
  Taro.navigateTo({
    url: `/pages/user/familyInfo/parentInfo/form`
  })
}

// 编辑监护人信息
const handleEdit = (parent: ParentInfo) => {
  // 如果是从预约页面跳转过来的，选择监护人后返回
  if (from === "appointment") {
    const selectedParent = {
      parentName: parent.parentName,
      parentPhone: parent.parentPhone,
      parentSex: parent.parentSex
    }
    Taro.setStorageSync("selectedParent", JSON.stringify(selectedParent))
    Taro.navigateBack()
    return
  }

  // 跳转到编辑页面
  Taro.navigateTo({
    url: `/pages/user/familyInfo/parentInfo/form?mode=edit&id=${parent.id}`
  })
}

// 删除监护人信息
const handleDelete = (parent: ParentInfo) => {
  deleteParent.value = parent
  showDeleteModal.value = true
}

// 隐藏删除弹窗
const hideDeleteModal = () => {
  showDeleteModal.value = false
  deleteParent.value = null
}

// 处理模态框可见性变化
const handleModalVisibleChange = (visible: boolean) => {
  showDeleteModal.value = visible
  if (!visible) {
    deleteParent.value = null
  }
}

// 确认删除
const confirmDelete = async () => {
  if (!deleteParent.value) return

  try {
    // 从列表中移除该监护人
    const updatedList = parentList.value.filter(p => p.id !== deleteParent.value!.id)
    // 调用API保存更新后的列表
    await storeParentInfo({
      parentInfo: updatedList
    })

    // 更新本地列表
    parentList.value = updatedList

    Taro.showToast({
      title: "删除成功",
      icon: "success"
    })

    // 重新加载列表
    loadParentList()
    hideDeleteModal()
  } catch (error) {
    console.error("删除监护人信息失败", error)
    Taro.showToast({
      title: error.message || "删除失败，请重试",
      icon: "none"
    })
  }
}

// 加载监护人信息列表
const loadParentList = async () => {
  loading.value = true
  try {
    const res = await queryParentInfo()
    if (res.parentInfo) {
      parentList.value = res.parentInfo
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

// 页面显示时重新加载数据
Taro.useDidShow(() => {
  loadParentList()
})

// 初始化
onMounted(() => {
  loadParentList()
})
</script>

<style lang="less">
.parent-container {
  overflow-y: auto;
  background-color: #f5f5f5;

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 400rpx;
    font-size: 28rpx;
    color: #999;
  }

  .parent-list {
    padding: 32rpx;

    .parent-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fff;
      border-radius: 16rpx;
      padding: 32rpx;
      margin-bottom: 24rpx;
      box-shadow: 0 4rpx 16rpx 0 rgba(0, 0, 0, 0.04);

      .parent-left {
        display: flex;
        align-items: center;
        flex: 1;

        .parent-avatar {
          width: 80rpx;
          height: 80rpx;
          border-radius: 50%;
          overflow: hidden;
          margin-right: 24rpx;

          .avatar-img {
            width: 100%;
            height: 100%;
          }
        }

        .parent-info {
          flex: 1;

          .parent-name {
            font-size: 32rpx;
            font-weight: 600;
            color: #393548;
            margin-bottom: 8rpx;
          }

          .parent-meta {
            display: flex;
            align-items: center;
            gap: 24rpx;

            .parent-phone,
            .parent-relationship {
              font-size: 24rpx;
              color: #999;
            }
          }
        }
      }

      .parent-actions {
        .delete-btn {
          min-width: 120rpx;
        }
      }
    }
  }

  .add-btn-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 32rpx;
    background: #fff;
    border-top: 1rpx solid #eee;
  }
}
</style>
