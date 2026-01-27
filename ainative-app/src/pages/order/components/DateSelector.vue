<template>
  <view class="date-selector">
    <view class="selected-date" @tap="openDatePicker">
      <template v-if="selectedDate">
        <view class="date-display">{{ formatDisplayDate(selectedDate) }}</view>
        <view class="arrow">
          <image
            src="https://fp.yangcong345.com/middle/1.0.0/arrow-down-5825be7eb99ee183ada0580192df1675__w.png"
            mode="aspectFit"
          />
        </view>
      </template>
      <template v-else>
        <view class="date-placeholder">请选择预约日期</view>
        <view class="arrow">
          <image
            src="https://fp.yangcong345.com/middle/1.0.0/arrow-down-5825be7eb99ee183ada0580192df1675__w.png"
            mode="aspectFit"
          />
        </view>
      </template>
    </view>

    <!-- 使用Calendar组件 -->
    <Calendar
      :show="showDatePicker"
      :selected-date="selectedDateObj"
      :available-dates="props.availableDates"
      :min-date="minDateObj"
      :max-date="maxDateObj"
      :multiple="false"
      @close="handleClose"
      @confirm="handleConfirm"
      @select="handleSelect"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"
import Taro from "@tarojs/taro"
import Calendar from "./Calendar.vue"
import { trackClick } from "@/utils/analytics"

interface DateStock {
  date: string // 格式：YYYY-MM-DD
  stockRemain: number // 剩余库存
}

interface Props {
  availableDates?: DateStock[] // 可预约的日期及剩余库存
  value?: string // 当前选中的日期，格式：YYYY-MM-DD
  minDate?: string // 最小可选日期，格式：YYYY-MM-DD
  maxDate?: string // 最大可选日期，格式：YYYY-MM-DD
}

const props = withDefaults(defineProps<Props>(), {
  availableDates: () => [],
  value: "",
  minDate: "",
  maxDate: ""
})

const emit = defineEmits<{
  change: [value: string]
  "update:value": [value: string]
}>()

// 弹窗显示状态
const showDatePicker = ref(false)
const openDatePicker = () => {
  showDatePicker.value = true
  trackClick("time_select")
}
// 选中的日期
const selectedDate = ref(props.value || "")

// 将字符串日期转换为Date对象，确保Calendar始终接收到有效日期
const selectedDateObj = computed(() => {
  // 如果有选中的日期
  if (selectedDate.value) {
    // 处理多日营的日期范围，取开始日期
    let dateStr = selectedDate.value
    if (dateStr.includes("到")) {
      dateStr = dateStr.split("到")[0]
    }

    const date = new Date(dateStr)
    // 检查日期是否有效
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  // 如果没有选中日期或日期无效，尝试从可用日期中找第一个有库存的日期
  if (props.availableDates && props.availableDates.length > 0) {
    const availableDate = props.availableDates.find(item => item.stockRemain > 0)
    if (availableDate) {
      let dateStr = availableDate.date
      if (dateStr.includes("到")) {
        dateStr = dateStr.split("到")[0]
      }
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }

  // 最后回退到当前日期
  return new Date()
})

// 监听selectedDateObj变化，确保Calendar组件接收到有效的日期
watch(
  () => selectedDateObj.value,
  newDate => {
    // 如果日期无效，强制更新为有效日期
    if (isNaN(newDate.getTime())) {
      selectedDate.value = formatDateToYMD(new Date())
    }
  },
  { immediate: true }
)

// 将最小日期字符串转换为Date对象
const minDateObj = computed(() => {
  return props.minDate ? new Date(props.minDate) : null
})

// 将最大日期字符串转换为Date对象 最大日期为availableDates日期中的最大日期
const maxDateObj = computed(() => {
  const availableDates = props.availableDates || []
  const dates = availableDates.map(item => new Date(item.date))
  dates.sort((a, b) => a.getTime() - b.getTime())
  return dates.length > 0 ? dates.pop() : null
})

// 监听props.value变化
watch(
  () => props.value,
  newValue => {
    selectedDate.value = newValue || ""
  }
)

// 格式化显示日期
const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return ""

  // 处理多日营的日期范围显示 - 只显示开始时间
  if (dateStr.includes("到")) {
    const [startDate] = dateStr.split("到")
    const start = new Date(startDate)
    const year = start.getFullYear()
    const month = start.getMonth() + 1
    const day = start.getDate()
    return `${year}年${month}月${day}日`
  } else {
    // 单日营的显示
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${year}年${month}月${day}日`
  }
}

// 处理关闭弹窗
const handleClose = () => {
  showDatePicker.value = false
}

// 处理确认选择
const handleConfirm = (dates: Date[]) => {
  if (dates.length === 0) {
    Taro.showToast({
      title: "请选择可预约日期",
      icon: "none"
    })
    return
  }

  const selectedDateStr = formatDateToYMD(dates[0])
  selectedDate.value = selectedDateStr
  emit("update:value", selectedDateStr)
  emit("change", selectedDateStr)
  showDatePicker.value = false
}

// 处理选择日期
const handleSelect = () => {
  // 在Calendar组件中，选择日期时会自动处理
  // 这里可以添加额外的逻辑，比如显示库存信息等
}

// 格式化日期为 YYYY-MM-DD
const formatDateToYMD = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
</script>

<style lang="less">
.date-selector {
  .selected-date {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    gap: 12rpx;

    .date-display {
      text-align: right;
      letter-spacing: normal;
      font-family: PingFang SC;
      font-size: 32rpx;
      font-weight: 600;
      line-height: 32rpx;
      color: #393548;
    }

    .date-placeholder {
      font-size: 32rpx;
      font-weight: normal;
      line-height: 32rpx;
      text-align: right;
      letter-spacing: normal;
      color: #b8b4c7;
    }

    .arrow {
      width: 32px;
      height: 32px;
      image {
        width: 24px;
        height: 24px;
      }
    }
  }
}
</style>
