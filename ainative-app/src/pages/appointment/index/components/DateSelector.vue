<template>
  <view class="date-selector">
    <view class="selected-date" @tap="showDatePicker = true">
      <template v-if="selectedDate">
        <view class="date-display">{{ formatDisplayDate(selectedDate) }}</view>
        <view class="arrow">
          <image
            src="https://fp.yangcong345.com/middle/1.0.3/right-arrow__w.png"
            mode="aspectFit"
          />
        </view>
      </template>
      <template v-else>
        <view class="date-placeholder">请选择预约日期</view>
        <view class="arrow">
          <image
            src="https://fp.yangcong345.com/middle/1.0.3/right-arrow__w.png"
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

// 选中的日期
const selectedDate = ref(props.value || "")

// 将字符串日期转换为Date对象
const selectedDateObj = computed(() => {
  return selectedDate.value ? new Date(selectedDate.value) : new Date()
})

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

  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}年${month}月${day}日`
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
    gap: 4rpx;

    .date-display {
      font-size: 28rpx;
      font-weight: normal;
      line-height: 28rpx;
      text-align: right;
      letter-spacing: normal;
      color: #393548;
    }

    .date-placeholder {
      font-size: 28rpx;
      font-weight: normal;
      line-height: 28rpx;
      text-align: right;
      letter-spacing: normal;
      color: #b8b4c7;
    }

    .arrow {
      width: 32px;
      height: 32px;
      margin-left: 4rpx;
      image {
        width: 100%;
        height: 100%;
      }
    }
  }
}
</style>
