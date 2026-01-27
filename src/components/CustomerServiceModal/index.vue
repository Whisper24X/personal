<template>
  <onion-modal
    v-model:visible="visible"
    title="联系客服"
    :close-icon="true"
    :mask-show="true"
    :show-footer="false"
    :left-button="false"
    :right-button="false"
    @update:visible="handleVisibleChange"
  >
    <view class="customer-service-content">
      <view class="qr-code-container">
        <image
          class="qr-code"
          :src="currentCustomerData?.thumbnail || qrCodeUrl"
          :show-menu-by-longpress="true"
        />
      </view>
      <view
        v-if="
          currentCustomerData?.title ||
          currentCustomerData?.workTime ||
          currentCustomerData?.description
        "
        class="service-tips"
      >
        <text v-if="currentCustomerData?.title" class="tip-title">{{
          currentCustomerData?.title || title
        }}</text>
        <text v-if="currentCustomerData?.workTime" class="tip-desc">{{
          currentCustomerData?.workTime || workTime
        }}</text>
        <text v-if="currentCustomerData?.description" class="tip-desc">{{
          currentCustomerData?.description || description
        }}</text>
      </view>
    </view>
  </onion-modal>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue"
import Taro from "@tarojs/taro"
import OnionModal from "@/components/Ui/modal/index.vue"
import { getTripConfig } from "@/api/tripConfig"

interface Props {
  modelValue: boolean
  qrCodeUrl?: string
  title?: string
  workTime?: string
  description?: string
}

interface Emits {
  (e: "update:modelValue", value: boolean): void
}

interface CustomerItem {
  id: string
  thumbnail: string
  title: string
  type: string
  url: string
  workTime: string
  description: string
}

const props = withDefaults(defineProps<Props>(), {
  qrCodeUrl: "https://fp.yangcong345.com/middle/1.0.0/customer-service-qr.png",
  title: "扫码添加客服微信",
  workTime: "工作时间：9:00-18:00",
  description: "我们将为您提供专业服务"
})

const emit = defineEmits<Emits>()

const customerDataList = ref<CustomerItem[]>([])
const currentCustomerData = ref<CustomerItem | null>(null)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value)
})

// 获取customer数据
const fetchCustomerData = async () => {
  try {
    const response = await getTripConfig("tripWechatBaseConfig")
    const data = response?.list[0]?.data
    if (data) {
      // 筛选出type为customer的数据
      const customerData = data.filter((item: CustomerItem) => item.type === "customer")
      customerDataList.value = customerData

      // 如果有customer数据，使用第一个作为当前显示的数据
      if (customerData.length > 0) {
        currentCustomerData.value = customerData[0]
      }
    }
  } catch (error) {
    console.error("获取customer数据失败:", error)
    Taro.showToast({
      title: "获取客服数据失败",
      icon: "none"
    })
  }
}

// 监听modal显示状态，当显示时获取数据
watch(visible, newVisible => {
  if (newVisible && customerDataList.value.length === 0) {
    fetchCustomerData()
  }
})

const handleVisibleChange = (value: boolean) => {
  emit("update:modelValue", value)
}

onMounted(() => {
  // 组件挂载时预加载数据
  fetchCustomerData()
})
</script>

<style lang="less">
.customer-service-content {
  padding: 40rpx 0;
  text-align: center;

  .qr-code-container {
    margin-bottom: 40rpx;

    .qr-code {
      width: 400rpx;
      height: 400rpx;
      border-radius: 16rpx;
      box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
    }
  }

  .service-tips {
    padding: 0 48rpx;
    .tip-title {
      display: block;
      font-size: 32rpx;
      font-weight: 600;
      color: #333333;
      margin-bottom: 16rpx;
    }

    .tip-desc {
      display: block;
      font-size: 28rpx;
      color: #666666;
      margin-bottom: 8rpx;
      line-height: 1.5;
    }
  }
}
</style>
