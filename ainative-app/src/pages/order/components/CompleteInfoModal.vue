<template>
  <OIModal
    :visible="visible"
    title="请先完善营员信息"
    :mask-click-close="false"
    left-button-text="取消"
    right-button-text="预约"
    @left-button-click="handleCancel"
    @right-button-click="handleConfirm"
  >
    <view class="complete-info-content">
      <view v-for="(child, index) in incompleteChildren" :key="index" class="info-item">
        <view class="form-item">
          <view class="form-label">姓名</view>
          <input class="form-input" disabled :value="child.name" />
        </view>
        <view class="form-item">
          <view class="form-label">身份证号</view>
          <input
            class="form-input"
            placeholder="请输入身份证号"
            maxlength="18"
            :value="child.idCard"
            @input="e => handleIdCardInput(e, index)"
          />
        </view>
      </view>
      <view class="hint-text">
        以上信息仅用于推送研学合同，购买旅行保险等实名制服务，请确保此信息真实有效，洋葱研学将通过加密等方式保护此信息
      </view>
    </view>
  </OIModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import Taro from "@tarojs/taro"
import OIModal from "@/components/Ui/modal/index.vue"

interface ChildInfo {
  name: string
  gender: string
  age: number
  idCard: string
}

interface Props {
  show: boolean
  children: ChildInfo[]
}

interface Emits {
  (e: "update:show", value: boolean): void
  (e: "confirm", children: ChildInfo[]): void
  (e: "cancel"): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const visible = ref(false)
const incompleteChildren = ref<ChildInfo[]>([])

watch(
  () => props.show,
  newVal => {
    visible.value = newVal
    if (newVal) {
      // 复制一份数据用于编辑
      incompleteChildren.value = JSON.parse(JSON.stringify(props.children))
    }
  }
)

const handleIdCardInput = (e: any, index: number) => {
  incompleteChildren.value[index].idCard = e.detail.value
}

const handleCancel = () => {
  visible.value = false
  emit("update:show", false)
  emit("cancel")
}

// 验证身份证号格式
const validateIdCard = (idCard: string): boolean => {
  // 去除空格
  const trimmedIdCard = idCard.trim()

  // 检查是否为空
  if (!trimmedIdCard) {
    return false
  }

  // 检查长度是否为18位
  if (trimmedIdCard.length !== 18) {
    return false
  }

  // 检查前17位是否为数字，最后一位是否为数字或X
  const regex = /^\d{17}[\dXx]$/
  if (!regex.test(trimmedIdCard)) {
    return false
  }

  // 验证出生日期是否合法
  try {
    const year = parseInt(trimmedIdCard.substring(6, 10))
    const month = parseInt(trimmedIdCard.substring(10, 12))
    const day = parseInt(trimmedIdCard.substring(12, 14))

    // 检查年份范围（1900-当前年份）
    const currentYear = new Date().getFullYear()
    if (year < 1900 || year > currentYear) {
      return false
    }

    // 检查月份范围
    if (month < 1 || month > 12) {
      return false
    }

    // 检查日期范围
    const daysInMonth = new Date(year, month, 0).getDate()
    if (day < 1 || day > daysInMonth) {
      return false
    }
  } catch {
    return false
  }

  return true
}

const handleConfirm = () => {
  // 验证所有营员的身份证号是否已填写且格式正确
  for (const child of incompleteChildren.value) {
    if (!child.idCard || child.idCard.trim() === "") {
      Taro.showToast({
        title: "请输入身份证号",
        icon: "none"
      })
      return
    }

    if (!validateIdCard(child.idCard)) {
      Taro.showToast({
        title: "请输入正确的身份证号",
        icon: "none"
      })
      return
    }
  }

  emit("confirm", incompleteChildren.value)
  visible.value = false
  emit("update:show", false)
}
</script>

<style lang="less">
.complete-info-content {
  padding: 40rpx 32rpx 32rpx;

  .info-item {
    .form-item {
      display: flex;
      align-items: center;
      padding: 24rpx 0;
      border-bottom: 2rpx solid #efeef3;

      .form-label {
        font-family: PingFang SC;
        font-size: 28rpx;
        color: #393548;
        min-width: 120rpx;
      }

      .form-input {
        flex: 1;
        font-family: PingFang SC;
        font-size: 28rpx;
        color: #393548;
        text-align: right;

        &::placeholder {
          color: #b8b4c7;
        }
      }
    }
  }

  .hint-text {
    font-family: PingFang SC;
    font-size: 24rpx;
    color: #848096;
    line-height: 36rpx;
    margin-top: 24rpx;
  }
}
</style>
