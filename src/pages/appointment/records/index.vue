<template>
  <TabBarLayout
    tab-key="records"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '预约记录' }"
  >
    <view class="appointment-records">
      <!-- 页面头部 -->
      <view class="page-header">
        <FilterDropdown
          v-model="filterStatus"
          :options="filterOptions"
          @change="changeFilterStatus"
        />
      </view>

      <!-- 预约记录列表 -->
      <scroll-view
        class="records-container"
        :style="containerStyle"
        :scroll-y="true"
        :show-scrollbar="false"
        :enhanced="true"
        :refresher-enabled="true"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
        @scrolltolower="onLoadMore"
      >
        <!-- 记录列表 -->
        <view v-if="appointmentList.length > 0" class="records-list">
          <view v-for="item in appointmentList" :key="item.id" class="record-card">
            <view class="record-header">
              <text class="record-title">{{ item.courseName || item.goodName }}</text>
              <view
                class="record-status"
                :class="{
                  booked: item.status === 'success',
                  completed: item.status === 'completed',
                  canceled: item.status === 'cancel'
                }"
              >
                <text>{{
                  item.status === "success"
                    ? "已预约"
                    : item.status === "completed"
                      ? "已完成"
                      : item.status === "cancel"
                        ? "已取消"
                        : "未知"
                }}</text>
              </view>
            </view>

            <view class="record-date">
              <text>{{ formatDateDisplay(item.date) }} {{ item.period }}</text>
            </view>

            <view class="record-info">
              <view class="info-item">
                <image
                  class="info-icon"
                  src="https://fp.yangcong345.com/middle/1.0.0/yanxue/child__w.png"
                />
                <text class="label">营员：</text>
                <text class="value">{{ item.studentName }}</text>
              </view>
              <view class="info-item">
                <image
                  class="info-icon"
                  src="https://fp.yangcong345.com/middle/1.0.0/yanxue/parent__w.png"
                />
                <text class="label">监护人：</text>
                <text class="value">{{ item.parentName }}{{ formatPhone(item.parentPhone) }}</text>
              </view>
            </view>
            <view
              v-if="item.status === 'success' || item.status === 'completed'"
              class="record-actions"
            >
              <!-- 加入研学群按钮 -->
              <OnionButton
                v-if="item.status === 'success'"
                type="default"
                size="medium"
                round
                theme="white"
                border-color="black"
                @click="handleJoinGroup(item)"
              >
                点击加入研学群
              </OnionButton>

              <!-- 取消预约按钮（仅单日营且已预约状态） -->
              <OnionButton
                v-if="item.status === 'success' && item.courseType !== 'multi'"
                type="hollow"
                transparent
                round
                theme="white"
                size="medium"
                border-color="black"
                @click="handleCancelAppointment(item.id)"
              >
                取消预约
              </OnionButton>

              <!-- 调整预约按钮（仅单日营且已预约状态） -->
              <OnionButton
                v-if="item.status === 'success' && item.courseType !== 'multi'"
                type="default"
                round
                theme="yellow"
                size="medium"
                @click="handleAdjustAppointment(item.id, item.orderId)"
              >
                调整预约
              </OnionButton>
              <!-- 联系客服按钮 -->
              <OnionButton
                v-if="item.status === 'success' && item.courseType === 'multi'"
                type="default"
                size="medium"
                round
                theme="yellow"
                @click="handleContactService()"
              >
                联系客服
              </OnionButton>
              <!-- 使用评价按钮 -->
              <OnionButton
                v-if="item.status === 'completed' && isShowVideo === 'true'"
                type="default"
                size="medium"
                round
                theme="yellow"
                @click="handleUseComment(item.id, item.courseId)"
              >
                使用评价
              </OnionButton>
            </view>
            <!-- 多日营商品无法取消预约提示 -->
            <view
              v-if="item.courseType === 'multi' && item.status === 'success'"
              class="cancellation-notice"
            >
              <image
                class="notice-icon"
                src="https://fp.yangcong345.com/middle/1.0.0/tip-icon-6994efd876b354f55c4e5e21c62de97f__w.png"
              />
              <text class="notice-text">多日营商品无法取消预约,若有需要可联系客服人员</text>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <EmptyState v-else-if="!loading" title="暂无预约记录" />

        <!-- 加载状态 -->
        <view v-if="loading && appointmentList.length === 0" class="loading-state">
          <text>加载中...</text>
        </view>

        <!-- 加载更多 -->
        <view v-if="loading && appointmentList.length > 0" class="load-more">
          <text>加载中...</text>
        </view>

        <!-- 没有更多 -->
        <view v-if="noMore && appointmentList.length > 0" class="no-more">
          <text>没有更多了</text>
        </view>
      </scroll-view>

      <!-- 取消预约确认模态框 -->
      <OnionModal
        v-model:visible="showCancelModal"
        title="提示"
        content="确认取消此预约？"
        left-button-text="取消"
        right-button-text="确定"
        @left-button-click="handleCancelModal"
        @right-button-click="handleConfirmCancel"
      />

      <!-- 加入研学群QR码弹窗 -->
      <OnionModal
        v-model:visible="showJoinGroupModal"
        title="长按加入课程群获取更多信息"
        :left-button="false"
        :right-button="false"
        :close-icon="true"
      >
        <view class="qr-modal-content">
          <view class="qr-code-container">
            <image
              v-if="currentQrCode"
              class="qr-code"
              :src="currentQrCode"
              :show-menu-by-longpress="true"
            />
          </view>
        </view>
      </OnionModal>

      <!-- 联系客服QR码弹窗 -->
      <OnionModal
        v-model:visible="showContactServiceModal"
        title="联系客服"
        :left-button="false"
        :right-button="false"
        :close-icon="true"
      >
        <view class="qr-modal-content">
          <view class="qr-code-container">
            <image
              v-if="currentQrCode"
              class="qr-code"
              :src="currentQrCode"
              :show-menu-by-longpress="true"
            />
          </view>
        </view>
      </OnionModal>
    </view>
  </TabBarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import Taro, { useDidShow } from "@tarojs/taro"
import { cancelCourseAppointment, getCourseAppointmentList } from "@/api/course"
// 使用 any 类型来避免类型错误，实际项目中应该使用正确的类型定义
type AppointmentInfo = any
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import EmptyState from "@/components/EmptyState/index.vue"
import OnionButton from "@/components/Ui/button/index.vue"
import FilterDropdown from "@/components/FilterDropdown/index.vue"
import OnionModal from "@/components/Ui/modal/index.vue"
import { getNavBarHeight } from "@/utils/statusBar"
import { formatFriendlyDate } from "@/utils/formatDate"
import { useConfigStore } from "@/store/configStore"
import { trackClick } from "@/utils/analytics"

// 使用全局配置
const configStore = useConfigStore()
const isShowVideo = computed(() => configStore.isShowVideo)

// 计算导航栏高度
const navBarHeight = getNavBarHeight()

// 容器样式
const containerStyle = computed(() => ({
  height: `calc(100vh - ${navBarHeight}rpx - 112rpx - env(safe-area-inset-bottom))`
}))

// 页面状态
const loading = ref(false)
const refreshing = ref(false)
const currentPage = ref(1)
const pageSize = 10 // 直接使用常量，不需要响应式
const noMore = ref(false)

// 筛选状态
const filterStatus = ref("")
const filterOptions = [
  { label: "全部", value: "" },
  { label: "已预约", value: "success" },
  { label: "已完成", value: "completed" }
]

// 模态框状态
const showCancelModal = ref(false)
const cancelAppointmentId = ref("")
const showJoinGroupModal = ref(false)
const showContactServiceModal = ref(false)
const currentQrCode = ref("")

// 预约记录列表
const appointmentList = ref<AppointmentInfo[]>([])

// 格式化日期显示
const formatDateDisplay = (date: string) => {
  if (!date) return ""
  if (date.includes("到")) {
    const [startDateObj, endDateObj] = date.split("到")
    return `${formatFriendlyDate(startDateObj)}到${formatFriendlyDate(endDateObj)}`
  }
  return formatFriendlyDate(date)
}

// 格式化手机号显示
const formatPhone = (phone: string) => {
  if (!phone) return ""
  return phone.substr(0, 3) + "********"
}

// 获取预约记录
const fetchAppointmentRecords = async (page = 1, refresh = false) => {
  try {
    if (refresh) {
      refreshing.value = true
      currentPage.value = 1
      appointmentList.value = []
    } else {
      loading.value = true
    }

    const res = await getCourseAppointmentList({
      page,
      pageSize,
      status: filterStatus.value || ""
    })

    if (res.list) {
      if (refresh || page === 1) {
        appointmentList.value = res.list
      } else {
        appointmentList.value = [...appointmentList.value, ...res.list]
      }

      const total = res.total || 0
      noMore.value = appointmentList.value.length >= total
      currentPage.value = page
    }
  } catch (error) {
    console.error("获取预约记录失败", error)
    Taro.showToast({
      title: "获取预约记录失败",
      icon: "none"
    })
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

// 刷新数据
const onRefresh = () => {
  fetchAppointmentRecords(1, true)
}

// 加载更多
const onLoadMore = () => {
  if (!loading.value && !noMore.value) {
    fetchAppointmentRecords(currentPage.value + 1)
  }
}

// 切换筛选状态
const changeFilterStatus = () => {
  fetchAppointmentRecords(1, true)
}

// 取消预约
const handleCancelAppointment = (id: string) => {
  cancelAppointmentId.value = id
  showCancelModal.value = true
}

// 确认取消预约
const handleConfirmCancel = async () => {
  try {
    await cancelCourseAppointment({ id: cancelAppointmentId.value })

    Taro.showToast({
      title: "预约已取消",
      icon: "success"
    })
    // 刷新列表
    fetchAppointmentRecords(1, true)
  } catch (error: any) {
    console.error("取消预约失败", error)
    Taro.showToast({
      title: error.message || "取消预约失败",
      icon: "none"
    })
  } finally {
    showCancelModal.value = false
    cancelAppointmentId.value = ""
  }
}

// 取消操作
const handleCancelModal = () => {
  showCancelModal.value = false
  cancelAppointmentId.value = ""
}

// 调整预约
const handleAdjustAppointment = (appointmentId: string, orderId: string) => {
  Taro.navigateTo({
    url: `/pages/appointment/index/index?id=${orderId}&appointmentId=${appointmentId}`
  })
}

// 使用评价
const handleUseComment = (appointmentId: string, courseId: string) => {
  Taro.navigateTo({
    url: `/pages/user/evaluation/index?appointmentId=${appointmentId}&courseId=${courseId}`
  })
}
const defaultServiceQrCodeUrl = computed(() => configStore.defaultServiceQrCodeUrl)
// 加入研学群
const handleJoinGroup = (item: AppointmentInfo) => {
  // 优先使用课程特定的群聊二维码，如果没有则使用默认客服二维码
  currentQrCode.value = item.groupQrCode || defaultServiceQrCodeUrl.value
  showJoinGroupModal.value = true
}

// 联系客服
const handleContactService = () => {
  trackClick("contact_customer_service", { source_page: "预约记录" })
  // 使用默认客服二维码
  currentQrCode.value = defaultServiceQrCodeUrl.value
  showContactServiceModal.value = true
}

// 页面加载
onMounted(async () => {
  // 确保配置已加载
  if (!configStore.isShowVideo || !configStore.defaultServiceQrCodeUrl) {
    await configStore.initAllConfigs()
  }
})
// 初始化加载孩子列表
useDidShow(() => {
  fetchAppointmentRecords()
})
</script>

<style lang="less">
.appointment-records {
  // min-height: 100vh;
  // background: #f9f9f9;
  flex: 1;
}

// 页面头部
.page-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 32rpx 32rpx 26rpx;
  z-index: 1;
}

// 记录列表
.records-list {
  padding: 0 32rpx;
}

// 记录卡片
.record-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);

  .record-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32rpx;

    .record-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #393548;
      flex: 1;
      margin-right: 16rpx;
    }

    .record-status {
      padding: 12rpx 18rpx;
      border-radius: 4rpx;
      font-size: 22rpx;

      &.booked {
        background: #eaf1ff;
        color: #518aff;
      }

      &.completed {
        background: #f7f7f9;
        color: #504b64;
      }

      &.canceled {
        background: #f7f7f9;
        color: #504b64;
      }
    }
  }

  .record-date {
    font-size: 28rpx;
    color: #504b64;
    margin-bottom: 32rpx;
  }

  .record-info {
    margin-bottom: 32rpx;

    .info-item {
      display: flex;
      align-items: center;
      margin-bottom: 32rpx;

      &:last-child {
        margin-bottom: 0;
      }
      .info-icon {
        width: 32px;
        height: 32px;
        opacity: 0.6;
        margin-right: 8px;
      }
      .label {
        font-size: 28rpx;
        color: #848096;
        margin-right: 16rpx;
        min-width: 80rpx;
      }

      .value {
        font-size: 28rpx;
        color: #393548;
        flex: 1;
      }
    }
  }

  .cancellation-notice {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-top: 24rpx;
    .notice-icon {
      width: 28rpx;
      height: 28rpx;
      margin-right: 8px;
    }
    .notice-text {
      font-family: PingFang SC;
      font-size: 24px;
      font-weight: normal;
      line-height: 24px;
      color: #fa5a65;
    }
  }

  .record-actions {
    display: flex;
    justify-content: flex-end;
    gap: 24rpx;
    flex-wrap: wrap;

    .oi-button.oi-button__medium {
      font-size: 28rpx;
    }
  }
}

// QR码弹窗样式
.qr-modal-content {
  padding: 40rpx 0;
  text-align: center;

  .qr-code-container {
    display: flex;
    justify-content: center;

    .qr-code {
      width: 400rpx;
      height: 400rpx;
      border-radius: 16rpx;
      box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
    }
  }
}

// 加载状态
.loading-state,
.load-more,
.no-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40rpx 0;

  text {
    font-size: 28rpx;
    color: #999999;
  }
}
</style>
