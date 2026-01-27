# 课程预约管理模块

本模块提供了课程预约管理的相关功能，包括课程预约的查询、新增、编辑和取消等操作。

## 目录结构

```
appointment/
├── components/               # 组件目录
│   ├── AppointmentEditDialog.vue  # 预约编辑对话框组件
│   ├── CourseSelector.vue    # 课程选择组件
│   ├── DateSelector.vue      # 日期选择组件
│   └── PeriodSelector.vue    # 时间段选择组件
├── index.vue                 # 主页面组件
├── service.ts                # 接口服务
├── service.type.ts           # 接口类型定义
├── types.ts                  # 通用类型定义
├── utils.ts                  # 工具函数
├── validators.ts             # 表单验证工具
└── README.md                 # 说明文档
```

## 可复用组件

### CourseSelector - 课程选择组件

用于选择课程，自动加载课程选项。

```vue
<CourseSelector
  v-model="formData.courseId"
  :disabled="formData.isEditMode"
  @change="handleCourseChange"
/>
```

#### 属性

- `modelValue` (必填): 当前选中的课程ID
- `disabled`: 是否禁用选择器

#### 事件

- `update:modelValue`: 更新选中的课程ID
- `change`: 选中课程变化时触发

### DateSelector - 日期选择组件

用于选择日期，支持禁用不可选日期。

```vue
<DateSelector
  v-model="formData.courseDate"
  :disabled="formData.isEditMode"
  :available-dates="availableDates"
  :course-id="formData.courseId"
  @change="handleDateChange"
/>
```

#### 属性

- `modelValue` (必填): 当前选中的日期
- `type`: 日期选择器类型，支持 'date' 和 'daterange'
- `placeholder`: 占位文本
- `disabled`: 是否禁用选择器
- `availableDates`: 可选日期列表
- `courseId`: 课程ID
- `rangeSeparator`: 日期范围分隔符
- `startPlaceholder`: 开始日期占位文本
- `endPlaceholder`: 结束日期占位文本
- `shortcuts`: 快捷选项

#### 事件

- `update:modelValue`: 更新选中的日期
- `change`: 选中日期变化时触发

### PeriodSelector - 时间段选择组件

用于选择时间段，根据课程ID和日期自动加载可选时间段。

```vue
<PeriodSelector
  v-model="formData.coursePeriod"
  :disabled="formData.isEditMode"
  :course-id="formData.courseId"
  :date="formData.courseDate"
/>
```

#### 属性

- `modelValue` (必填): 当前选中的时间段
- `disabled`: 是否禁用选择器
- `courseId`: 课程ID
- `date`: 选中的日期

#### 事件

- `update:modelValue`: 更新选中的时间段
- `change`: 选中时间段变化时触发

## 工具函数

### utils.ts

提供了一系列工具函数，用于处理日期和时间段数据。

```ts
import { extractAvailableDates, extractPeriodsForDate, formatDate } from './utils'

// 提取可用日期
const availableDates = extractAvailableDates(stockItems)

// 提取指定日期的时间段
const periods = extractPeriodsForDate(stockItems, date)

// 格式化日期
const formattedDate = formatDate(dateString)
```

### validators.ts

提供了表单验证规则。

```ts
import { getAppointmentFormRules } from './validators'

// 获取预约表单验证规则
const rules = getAppointmentFormRules()
```

## 使用示例

### 在新页面中使用

```vue
<template>
  <div class="my-page">
    <CourseSelector v-model="form.courseId" @change="handleCourseChange" />
    
    <DateSelector
      v-model="form.date"
      :available-dates="availableDates"
      :course-id="form.courseId"
      @change="handleDateChange"
    />
    
    <PeriodSelector
      v-model="form.period"
      :course-id="form.courseId"
      :date="form.date"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import CourseSelector from './components/CourseSelector.vue'
import DateSelector from './components/DateSelector.vue'
import PeriodSelector from './components/PeriodSelector.vue'
import { loadCourseStockInfo } from './utils'

const form = reactive({
  courseId: '',
  date: '',
  period: ''
})

const availableDates = ref<string[]>([])

const handleCourseChange = async (courseId: string) => {
  if (!courseId) return
  
  const stockInfo = await loadCourseStockInfo(courseId)
  availableDates.value = stockInfo.availableDates
}

const handleDateChange = (date: string) => {
  // 处理日期变更
}
</script>
```

## 注意事项

1. 使用 CourseSelector 时，需要监听 change 事件，并在课程变更时加载可用日期和时间段
2. 使用 DateSelector 时，需要提供可用日期列表
3. 使用 PeriodSelector 时，需要提供课程ID和日期 