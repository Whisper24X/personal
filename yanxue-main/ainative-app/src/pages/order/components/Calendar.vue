<template>
  <OlSheet
    class="calendar-sheet"
    :show="show"
    title="选择日期"
    :safe-area="false"
    :mask-click-close="true"
    @click-close="handleClose"
  >
    <view class="calendar">
      <view class="calendar-header">
        <view class="month-nav">
          <view class="month-arrow prev" @tap="prevMonth">
            <image
              class="arrow-icon"
              src="https://fp.yangcong345.com/middle/1.0.0/left-arrow__w.png"
            />
          </view>
          <text>{{ currentYear }}年{{ currentMonth }}月</text>
          <view
            class="month-arrow next"
            :class="{ disabled: isNextMonthDisabled }"
            @tap="nextMonth"
          >
            <image
              class="arrow-icon"
              src="https://fp.yangcong345.com/middle/1.0.0/right-arrow__w.png"
            />
          </view>
        </view>
      </view>
      <view class="weekdays">
        <text
          v-for="(dayName, index) in weekDays"
          :key="index"
          :class="{ weekend: index === 0 || index === 6 }"
        >
          {{ dayName }}
        </text>
      </view>
      <view class="days">
        <view
          v-for="(day, index) in calendarDays"
          :key="index"
          class="day"
          :class="{
            'other-month': day.otherMonth,
            today: day.isToday,
            selected: isDateSelected(day.date),
            disabled: day.disabled,
            weekend: day.date.getDay() === 0 || day.date.getDay() === 6
          }"
          @tap="handleSelectDate(day)"
        >
          <text>{{ day.day }}</text>
          <text v-if="day.stockRemain === 0 && !day.otherMonth" class="stock-info full-booked"
            >已约满</text
          >
          <text
            v-else-if="day.stockRemain && day.stockRemain > 0 && !day.isToday"
            class="stock-info"
          >
            可预约
          </text>
          <text v-else-if="day.isToday" class="day-label">今天</text>
        </view>
      </view>
    </view>
    <view class="date-picker-footer">
      <OlButton
        type="default"
        theme="yellow"
        size="large"
        round
        :inline="false"
        @click="handleConfirm"
      >
        确认
      </OlButton>
    </view>
  </OlSheet>
</template>

<script setup lang="ts">
import Taro from "@tarojs/taro"
import { ref, watch, computed } from "vue"
import { formatDateCustom } from "@/utils/formatDate"
import OlButton from "@/components/Ui/button/index.vue"
import OlSheet from "@/components/Ui/sheet/index.vue"

// 接口定义
interface CalendarDay {
  day: number
  date: Date
  otherMonth: boolean
  isToday?: boolean
  disabled: boolean
  stockRemain?: number
}

interface DateStock {
  date: string // 格式：YYYY-MM-DD
  stockRemain: number // 剩余库存
}

// Props定义
interface Props {
  show?: boolean
  selectedDate?: Date
  selectedDates?: Date[]
  minDate?: Date | null
  maxDate?: Date | null
  disabledDays?: string[]
  availableDays?: string[]
  availableDates?: DateStock[] // 可预约的日期及剩余库存
  multiple?: boolean
  titleBg?: string
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  selectedDate: () => new Date(),
  selectedDates: () => [],
  minDate: null,
  maxDate: null,
  disabledDays: () => [],
  availableDays: () => [],
  availableDates: () => [],
  multiple: false,
  titleBg: ""
})

// Emits定义
const emit = defineEmits<{
  close: []
  confirm: [dates: Date[]]
  select: [date: Date]
  "update:selectedDates": [dates: Date[]]
}>()

// 响应式数据
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const calendarDays = ref<CalendarDay[]>([])
const internalSelectedDates = ref<Date[]>([])
const weekDays = ["日", "一", "二", "三", "四", "五", "六"]

// 计算下个月按钮是否禁用
const isNextMonthDisabled = computed(() => {
  if (!props.maxDate) return false
  const nextMonthDate = new Date(currentYear.value, currentMonth.value, 1)
  return nextMonthDate > props.maxDate
})

// 初始化内部选中日期
watch(
  () => props.selectedDates,
  newVal => {
    internalSelectedDates.value = [...newVal]
  },
  { immediate: true, deep: true }
)

// 监听单个选中日期变化
watch(
  () => props.selectedDate,
  newDate => {
    if (newDate && !props.multiple) {
      internalSelectedDates.value = [new Date(newDate)]
    }
  },
  { immediate: true }
)

// 判断是否是同一天
const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

// 检查是否是禁用的日期
const isDisabledDate = (date: Date): boolean => {
  const isBeforeMinDate = props.minDate && date < props.minDate
  const isAfterMaxDate = props.maxDate && date > props.maxDate
  if (isBeforeMinDate || isAfterMaxDate) {
    return true
  }

  // 禁用当天日期
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isToday = isSameDay(date, today)
  if (isToday) {
    return true
  }

  const dateStr = formatDateCustom(date, "YYYY-MM-DD")

  // 如果有库存数据，则根据库存判断是否可用
  if (props.availableDates.length > 0) {
    const dateStock = props.availableDates.find(item => item.date === dateStr)
    return !dateStock || dateStock.stockRemain <= 0
  }

  // 如果有传入可用日期列表，则只有在列表中的日期才可用
  if (props.availableDays.length >= 0) {
    return !props.availableDays.includes(dateStr)
  }

  // 如果没有可用日期列表，则检查禁用日期列表
  return props.disabledDays.includes(dateStr)
}

// 获取日期的库存信息
const getDateStock = (date: Date): number | undefined => {
  const dateStr = formatDateCustom(date, "YYYY-MM-DD")
  const dateStock = props.availableDates.find(item => item.date === dateStr)
  return dateStock?.stockRemain
}

// 检查日期是否被选中
const isDateSelected = (date: Date): boolean => {
  // 禁用当天日期
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return internalSelectedDates.value.some(
    selectedDate => isSameDay(selectedDate, date) && !isSameDay(date, today)
  )
}

// 计算日历天数
const calculateCalendarDays = () => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const firstDayOfWeek = firstDay.getDay()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days: CalendarDay[] = []

  // 上个月的日期
  if (firstDayOfWeek > 0) {
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate()
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 2, prevMonthLastDay - i)
      days.push({
        day: prevMonthLastDay - i,
        date,
        otherMonth: true,
        isToday: isSameDay(date, today),
        disabled: isDisabledDate(date),
        stockRemain: getDateStock(date)
      })
    }
  }

  // 当前月的日期
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month - 1, i)
    date.setHours(0, 0, 0, 0)

    days.push({
      day: i,
      date,
      otherMonth: false,
      isToday: isSameDay(date, today),
      disabled: isDisabledDate(date),
      stockRemain: getDateStock(date)
    })
  }

  // 下个月的日期
  const remainingDays = 42 - days.length // 6行7列
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month, i)
    days.push({
      day: i,
      date,
      otherMonth: true,
      isToday: isSameDay(date, today),
      disabled: isDisabledDate(date),
      stockRemain: getDateStock(date)
    })
  }

  calendarDays.value = days
}

// 切换到上一个月
const prevMonth = () => {
  if (currentMonth.value === 1) {
    currentYear.value--
    currentMonth.value = 12
  } else {
    currentMonth.value--
  }
  calculateCalendarDays()
}

// 切换到下一个月
const nextMonth = () => {
  // 检查是否到达最大日期限制
  if (props.maxDate) {
    const nextMonthDate = new Date(currentYear.value, currentMonth.value, 1)
    // 如果下个月超过最大日期，则不切换
    if (nextMonthDate > props.maxDate) {
      return
    }
  }

  if (currentMonth.value === 12) {
    currentYear.value++
    currentMonth.value = 1
  } else {
    currentMonth.value++
  }
  calculateCalendarDays()
}

// 处理关闭
const handleClose = () => {
  emit("close")
}

// 处理确认
const handleConfirm = () => {
  // 不允许选择当天报名
  const selectedDates = [...internalSelectedDates.value]
  if (selectedDates.some(date => isSameDay(date, new Date()))) {
    Taro.showToast({
      title: "当天不可报名，请选择其他日期",
      icon: "none"
    })
    return
  }
  emit("update:selectedDates", [...internalSelectedDates.value])
  emit("confirm", [...internalSelectedDates.value])
}

// 处理选择日期
const handleSelectDate = (day: CalendarDay) => {
  if (day.disabled) return

  if (props.multiple) {
    // 多选模式
    const existingIndex = internalSelectedDates.value.findIndex(selectedDate =>
      isSameDay(selectedDate, day.date)
    )

    if (existingIndex === -1) {
      // 添加日期
      internalSelectedDates.value.push(new Date(day.date))
    } else {
      // 移除日期
      internalSelectedDates.value.splice(existingIndex, 1)
    }
  } else {
    // 单选模式
    internalSelectedDates.value = [new Date(day.date)]
  }

  emit("select", new Date(day.date))
}

// 监听显示状态变化
watch(
  () => props.show,
  newVal => {
    if (newVal) {
      // 设置日历显示的月份为当前日期或第一个选中日期的月份
      const dateToShow =
        internalSelectedDates.value.length > 0 ? internalSelectedDates.value[0] : props.selectedDate
      currentYear.value = dateToShow.getFullYear()
      currentMonth.value = dateToShow.getMonth() + 1
      calculateCalendarDays()
    }
  }
)

// 监听日期范围和禁用天数和可选天数的变化
watch(
  [
    () => props.minDate,
    () => props.maxDate,
    () => props.disabledDays,
    () => props.availableDays,
    () => props.availableDates
  ],
  () => {
    if (props.show) {
      calculateCalendarDays()
    }
  },
  { deep: true }
)
</script>

<style lang="less">
.calendar {
  background-color: #fff;
  padding: 56px 24px 60rpx 24px;

  .calendar-header {
    text-align: center;
    font-family: "苹方-简";
    font-size: 36px;
    font-weight: 600;
    line-height: 36px;
    letter-spacing: 1.03px;
    /* 黑白灰/黑色393548 */
    color: #393548;
    margin-bottom: 56px;

    .month-nav {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 24rpx;

      .month-arrow {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;

        .arrow-icon {
          width: 32px;
          height: 32px;
        }

        &:active {
          background-color: rgba(0, 0, 0, 0.05);
          border-radius: 50%;
        }

        &.disabled {
          opacity: 0.3;
          pointer-events: none;
        }
      }
    }
  }

  .weekdays {
    display: flex;
    margin-bottom: 16px;

    text {
      flex: 1;
      text-align: center;
      font-size: 28px;
      color: #848096;
      padding: 8px 0;

      &.weekend {
        color: #ff5a5f;
      }
    }
  }

  .days {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;

    .day {
      width: calc(100% / 7 - 4px);
      height: 110px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      font-size: 28px;
      color: #393548;
      font-family: "苹方-简";
      font-size: 32px;
      font-weight: 600;
      line-height: 32px;
      text-align: center;
      letter-spacing: 0.91px;
      &.weekend:not(.disabled):not(.other-month) {
        color: #ff5a5f;
      }

      &.other-month {
        color: #8b8ba0;
      }

      &.selected {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 16px;
        background: #518aff;
        color: #fff;
        box-sizing: border-box;

        .day-label {
          margin-top: 8px;
          color: #fff;
        }
        .stock-info {
          color: #fff;
        }
      }

      &.disabled {
        color: #d4d1dd;
        pointer-events: none;
      }

      .day-label {
        position: absolute;
        bottom: 8px;
        font-size: 20px;
        font-weight: 600;
        color: #393548;
      }

      .stock-info {
        margin-top: 8rpx;
        font-family: PingFang SC;
        font-size: 18px;
        line-height: 20px;
        text-align: center;
        color: #518aff;

        &.full-booked {
          color: #d4d1dd;
        }
      }
    }
  }
}

.date-picker-footer {
  padding: 0 32px calc(env(safe-area-inset-bottom) + 32px) 32px;
  background-color: #fff;
}
.calendar-sheet {
  .oi-sheet__main {
    max-height: 1400px;
  }
}
</style>
