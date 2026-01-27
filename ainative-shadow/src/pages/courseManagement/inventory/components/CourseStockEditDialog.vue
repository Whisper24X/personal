<template>
  <el-dialog
    :title="title"
    v-model="dialogVisible"
    width="500px"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
      <el-form-item label="课程名称" prop="courseId" v-if="formData.isCreate">
        <el-select
          v-model="formData.courseId"
          placeholder="请选择课程"
          clearable
          filterable
          style="width: 100%"
          :loading="courseLoading"
          @change="handleCourseChange"
        >
          <el-option
            v-for="item in courseOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="课程名称" v-else>
        <span>{{ formData.courseName }}</span>
      </el-form-item>

      <!-- 选择课程后才显示的字段 -->
      <template v-if="formData.isCreate && selectedCourseType">
        <!-- 单日营课程日期选择 -->
        <el-form-item
          label="课程日期"
          prop="dates"
          v-if="selectedCourseType === 'single'"
        >
          <div style="margin-bottom: 8px">
            <el-tag type="warning" size="small">当前课程为单日类型</el-tag>
          </div>
          <el-date-picker
            v-model="formData.dates"
            type="dates"
            placeholder="请选择课程日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>

        <!-- 多日营课程日期范围选择 -->
        <el-form-item
          label="课程日期"
          prop="dates"
          v-if="selectedCourseType === 'multi'"
        >
          <div style="margin-bottom: 8px">
            <el-tag type="success" size="small">当前课程为多日类型</el-tag>
          </div>
          <div class="time-period-container">
            <div
              v-for="(range, index) in multiDayRanges"
              :key="index"
              class="time-period-item"
            >
              <el-date-picker
                v-model="range.startDate"
                type="date"
                placeholder="选择开始日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 130px"
                @change="handleMultiDayRangeChange(index)"
              />
              <span class="time-separator">至</span>
              <el-date-picker
                v-model="range.endDate"
                type="date"
                placeholder="选择结束日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 130px"
                @change="handleMultiDayRangeChange(index)"
              />
              <el-button
                v-if="index !== 0"
                type="danger"
                circle
                size="small"
                @click="removeMultiDayRange(index)"
                class="time-period-btn"
              >
                <el-icon>
                  <Minus />
                </el-icon>
              </el-button>
              <div v-if="multiDayRanges.length < 5">
                <el-button
                  type="primary"
                  circle
                  size="small"
                  @click="addMultiDayRange"
                  class="time-period-btn"
                >
                  <el-icon>
                    <Plus />
                  </el-icon>
                </el-button>
              </div>
            </div>

            <div v-if="multiDayRanges.length === 0" class="add-first-period">
              <el-button type="primary" @click="addMultiDayRange"
                >添加日期范围</el-button
              >
            </div>
          </div>
        </el-form-item>

        <!-- 单日营的课程时间 -->
        <el-form-item
          label="课程时间"
          prop="periods"
          v-if="selectedCourseType === 'single'"
        >
          <div class="time-period-container">
            <div
              v-for="(period, index) in formData.periods"
              :key="index"
              class="time-period-item"
            >
              <el-time-picker
                v-model="formData.periods[index].startTime"
                format="HH:mm"
                placeholder="开始时间"
                @change="updatePeriods(index)"
                style="width: 130px"
              />
              <span class="time-separator">-</span>
              <el-time-picker
                v-model="formData.periods[index].endTime"
                format="HH:mm"
                placeholder="结束时间"
                @change="updatePeriods(index)"
                style="width: 130px"
              />
              <el-button
                v-if="index !== 0"
                type="danger"
                circle
                size="small"
                @click="removePeriod(index)"
                class="time-period-btn"
              >
                <el-icon>
                  <Minus />
                </el-icon>
              </el-button>
              <div v-if="formData.periods.length < 5">
                <el-button
                  type="primary"
                  circle
                  size="small"
                  @click="addPeriod"
                  class="time-period-btn"
                >
                  <el-icon>
                    <Plus />
                  </el-icon>
                </el-button>
              </div>
            </div>

            <div v-if="formData.periods.length === 0" class="add-first-period">
              <el-button type="primary" @click="addPeriod"
                >添加课程时间</el-button
              >
            </div>
          </div>
        </el-form-item>

        <!-- 库存数量 -->
        <el-form-item label="库存数量" prop="totalInventory">
          <!-- 必须为整数 -->
          <el-input-number
            v-model="formData.totalInventory"
            :min="formData.isCreate ? 1 : formData.reservedCount"
            :step="10"
            :precision="0"
            placeholder="请输入库存数量"
            style="width: 100%"
          />
        </el-form-item>
      </template>

      <!-- 编辑模式的显示 -->
      <template v-if="!formData.isCreate">
        <el-form-item label="课程日期">
          <span>{{ formData.dates[0] }}</span>
        </el-form-item>
        <el-form-item v-if="formData.period" label="课程时间">
          <span>{{ formData.period }}</span>
        </el-form-item>
        <el-form-item label="库存数量" prop="totalInventory">
          <el-input-number
            v-model="formData.totalInventory"
            :min="formData.reservedCount"
            :step="10"
            :precision="0"
            placeholder="请输入库存数量"
            style="width: 100%"
          />
        </el-form-item>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="cancel">取消</el-button>
      <el-button :loading="loading" type="primary" @click="submit"
        >确定</el-button
      >
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Minus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

/**
 * 库存编辑表单数据接口
 */
interface InventoryForm {
  id: string
  courseId: string
  courseName: string
  dates: string[]
  period: string
  periods: Array<{ startTime: string; endTime: string }>
  currentInventory: number
  reservedCount: number
  totalInventory: number
  status: string
  isCreate: boolean
}

// 组件属性定义
const props = defineProps<{
  visible: boolean
  title: string
  form: InventoryForm
  loading: boolean
  courseOptions: {
    label: string
    value: string
    courseType: 'single' | 'multi'
  }[]
  courseLoading: boolean
}>()

// 组件事件定义
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', form: InventoryForm, valid: boolean): void
  (e: 'cancel'): void
}>()

// 计算属性 - 对话框显示状态
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

// 表单引用
const formRef = ref<FormInstance>()

// 表单数据 - 克隆自props.form以避免直接修改props
const formData = reactive<InventoryForm>({ ...props.form })

// 当前选择的课程类型
const selectedCourseType = ref<'single' | 'multi' | ''>('')

// 多日营的日期范围组
const multiDayRanges = ref<Array<{ startDate: string; endDate: string }>>([
  { startDate: '', endDate: '' },
])

// 监听props.form变化，更新本地数据
watch(
  [() => props.form, () => dialogVisible.value, () => props.form.isCreate],
  ([newForm, dialogVisibleValue, isCreate]) => {
    Object.assign(formData, newForm)
    // 如果是创建模式且没有时间段，且是单日营，添加一个默认的时间段
    if (
      isCreate &&
      (!newForm.periods || newForm.periods.length === 0) &&
      selectedCourseType.value === 'single'
    ) {
      addPeriod()
    }
  },
)

/**
 * 表单验证规则
 */
const rules = reactive<FormRules>({
  courseId: [{ required: true, message: '请选择课程', trigger: 'change' }],
  dates: [{ required: true, message: '请选择课程日期', trigger: 'change' }],
  periods: [
    {
      validator: (rule, value, callback) => {
        if (
          formData.isCreate &&
          selectedCourseType.value === 'single' &&
          (!value || value.length === 0)
        ) {
          callback(new Error('请至少添加一个课程时间'))
        } else {
          callback()
        }
      },
      trigger: 'change',
    },
  ],
  totalInventory: [
    { required: true, message: '请输入库存数量', trigger: 'blur' },
    {
      type: 'number',
      min: 0,
      message: '库存数量必须大于0',
      trigger: 'blur',
    },
  ],
})

/**
 * 处理课程选择变化
 */
const handleCourseChange = (value: string) => {
  if (value) {
    // 找到对应的课程名称和类型
    const course = props.courseOptions.find((item) => item.value === value)
    if (course) {
      formData.courseName = course.label
      selectedCourseType.value = course.courseType

      // 根据课程类型重置相应的数据
      if (course.courseType === 'multi') {
        // 多日营：重置日期选择为范围选择，清空时间段
        formData.dates = []
        formData.periods = []
        multiDayRanges.value = [{ startDate: '', endDate: '' }]
      } else {
        // 单日营：重置日期选择为多个单日，初始化一个时间段
        formData.dates = []
        formData.periods = [{ startTime: '', endTime: '' }]
        multiDayRanges.value = []
      }
    }
  } else {
    formData.courseName = ''
    selectedCourseType.value = ''
    formData.dates = []
    multiDayRanges.value = []
  }
}

/**
 * 添加多日营日期范围
 */
const addMultiDayRange = () => {
  // 检查当前所有范围是否都已填写完整
  if (!checkMultiDayDatesComplete()) {
    ElMessage.warning('请先完成当前日期范围的填写')
    return
  }

  multiDayRanges.value.push({ startDate: '', endDate: '' })
}

/**
 * 移除多日营日期范围
 * @param index 索引
 */
const removeMultiDayRange = (index: number) => {
  if (multiDayRanges.value.length > 1) {
    multiDayRanges.value.splice(index, 1)
  } else {
    ElMessage.warning('至少需要保留一个日期范围')
  }
}

/**
 * 处理多日营日期范围变化
 * @param index 索引
 */
const handleMultiDayRangeChange = (index: number) => {
  const range = multiDayRanges.value[index]
  if (range.startDate && range.endDate) {
    // 检查结束日期是否晚于开始日期
    const startDate = dayjs(range.startDate)
    const endDate = dayjs(range.endDate)

    if (endDate.isBefore(startDate)) {
      ElMessage.warning('结束日期不能早于开始日期')
      multiDayRanges.value[index].endDate = ''
      return
    }

    // 检查与其他日期范围是否有交叉
    if (checkDateRangeOverlap(index)) {
      ElMessage.error('日期范围不能与其他范围存在交叉')
      multiDayRanges.value[index].endDate = ''
      return
    }

    // 更新formData.dates为多日营的所有日期
    updateMultiDayDates()
  }
}

/**
 * 检查日期范围是否与其他范围有交叉
 * @param currentIndex 当前检查的范围索引
 * @returns 是否有交叉
 */
const checkDateRangeOverlap = (currentIndex: number): boolean => {
  const currentRange = multiDayRanges.value[currentIndex]
  if (!currentRange.startDate || !currentRange.endDate) return false

  const currentStart = dayjs(currentRange.startDate)
  const currentEnd = dayjs(currentRange.endDate)

  // 检查与其他所有范围是否有交叉
  for (let i = 0; i < multiDayRanges.value.length; i++) {
    if (i === currentIndex) continue // 跳过自己

    const otherRange = multiDayRanges.value[i]
    if (!otherRange.startDate || !otherRange.endDate) continue

    const otherStart = dayjs(otherRange.startDate)
    const otherEnd = dayjs(otherRange.endDate)

    // 检查两个日期范围是否有交叉
    // 交叉条件：当前开始日期 <= 其他结束日期 && 当前结束日期 >= 其他开始日期
    if (
      (currentStart.isSame(otherEnd) || currentStart.isBefore(otherEnd)) &&
      (currentEnd.isSame(otherStart) || currentEnd.isAfter(otherStart))
    ) {
      return true
    }
  }

  return false
}

/**
 * 检查多日营日期填写是否完整
 * @returns 是否完整
 */
const checkMultiDayDatesComplete = (): boolean => {
  return multiDayRanges.value.every((range) => range.startDate && range.endDate)
}

/**
 * 更新多日营的日期列表
 * 格式化为字符串数组，如 ["2025-09-16到2025-10-16","2025-10-17到2025-10-29"]
 */
const updateMultiDayDates = () => {
  const dateRanges: string[] = []

  multiDayRanges.value.forEach((range) => {
    if (range.startDate && range.endDate) {
      dateRanges.push(`${range.startDate}到${range.endDate}`)
    }
  })

  formData.dates = dateRanges
}

/**
 * 添加课程时间段
 */
const addPeriod = () => {
  if (formData.periods.length < 5) {
    // 只有在现有时间段都有效且无交叉的情况下才能添加
    if (formData.periods.length > 0) {
      const allValid = formData.periods.every((p) => p.startTime && p.endTime)
      if (!allValid) {
        ElMessage.warning('请先完成已有的时间段设置')
        return
      }

      if (checkTimeSame()) {
        return
      }
    }

    formData.periods.push({ startTime: '', endTime: '' })
  } else {
    ElMessage.warning('最多只能添加5个课程时间')
  }
}

/**
 * 移除课程时间段
 * @param index 索引
 */
const removePeriod = (index: number) => {
  if (formData.periods.length > 1) {
    formData.periods.splice(index, 1)
  } else {
    ElMessage.warning('至少需要保留一个课程时间')
  }
}

/**
 * 更新课程时间段
 * @param index 当前修改的时间段索引
 */
const updatePeriods = (index: number) => {
  // 更新表单验证
  if (formRef.value) {
    formRef.value.validateField('periods')
  }

  // 检查时间是否有效
  const period = formData.periods[index]
  if (!period.startTime || !period.endTime) return

  // 检查结束时间是否早于开始时间
  const startTime = dayjs(period.startTime)
  const endTime = dayjs(period.endTime)

  if (endTime.isBefore(startTime)) {
    ElMessage.warning('结束时间不能早于开始时间')
    // 重置结束时间
    formData.periods[index].endTime = ''
    return
  }

  // 检查时间段是否相同
  checkTimeSame()
}

/**
 * 检查时间段是否相同
 * @returns 是否有相同
 */
const checkTimeSame = () => {
  const periods = formData.periods.map((p) => {
    return `${dayjs(p.startTime).format('HH:mm')}-${dayjs(p.endTime).format(
      'HH:mm',
    )}`
  })

  const uniquePeriods = [...new Set(periods)]

  if (uniquePeriods.length !== periods.length) {
    ElMessage.error('课程时间段不能相同')
    return true
  }

  // const validPeriods = formData.periods.filter((p) => p.startTime && p.endTime)

  // // 按开始时间排序
  // const sortedPeriods = [...validPeriods].sort((a, b) => {
  //   return dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()
  // })

  // // 检查交叉
  // for (let i = 0; i < sortedPeriods.length - 1; i++) {
  //   const current = sortedPeriods[i]
  //   const next = sortedPeriods[i + 1]

  //   const currentEnd = dayjs(current.endTime)
  //   const nextStart = dayjs(next.startTime)

  //   if (currentEnd.isAfter(nextStart) || currentEnd.isSame(nextStart)) {
  //     ElMessage.error('课程时间段不能交叉')
  //     return true
  //   }
  // }

  return false
}

/**
 * 格式化日期
 * @param dateString 日期字符串
 * @returns 格式化后的日期字符串
 */
const formatDate = (dateString: string) => {
  if (!dateString) return '--'
  return dayjs(dateString).format('YYYY-MM-DD')
}

/**
 * 提交表单
 */
const submit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) {
      emit('submit', formData, false)
      return
    }

    if (
      !formData.isCreate &&
      formData.totalInventory < formData.reservedCount
    ) {
      ElMessage.error('新总库存不能小于已预约数量')
      emit('submit', formData, false)
      return
    }

    // 如果是创建库存，检查时间段是否有交叉
    if (formData.isCreate) {
      // 检查课程类型和日期
      if (selectedCourseType.value === 'multi') {
        // 多日营：检查日期范围是否有效
        const hasValidRange = multiDayRanges.value.some(
          (range) => range.startDate && range.endDate,
        )
        if (!hasValidRange) {
          ElMessage.error('请至少填写一个有效的日期范围')
          emit('submit', formData, false)
          return
        }

        // 检查所有日期范围是否都填写完整
        if (!checkMultiDayDatesComplete()) {
          ElMessage.error('请完成所有日期范围的填写')
          emit('submit', formData, false)
          return
        }

        // 多日营检查日期范围是否有交叉
        const hasOverlap = multiDayRanges.value.some((_, index) =>
          checkDateRangeOverlap(index),
        )
        if (hasOverlap) {
          ElMessage.error('多日营的日期范围不能存在交叉')
          emit('submit', formData, false)
          return
        }

        // 更新日期列表为字符串数组格式
        updateMultiDayDates()
      } else if (selectedCourseType.value === 'single') {
        // 单日营：检查是否选择了日期
        if (!formData.dates || formData.dates.length === 0) {
          ElMessage.error('请选择至少一个课程日期')
          emit('submit', formData, false)
          return
        }

        // 单日营需要检查时间段
        const allValid = formData.periods.every((p) => p.startTime && p.endTime)
        if (!allValid) {
          ElMessage.error('请完成所有课程时间段的填写')
          emit('submit', formData, false)
          return
        }

        // 检查时间段是否相同
        if (checkTimeSame()) {
          emit('submit', formData, false)
          return
        }

        // 检查是否有时间段
        const periodsFormatted = formData.periods
          .map((p) => {
            if (p.startTime && p.endTime) {
              return `${dayjs(p.startTime).format('HH:mm')}-${dayjs(
                p.endTime,
              ).format('HH:mm')}`
            }
            return ''
          })
          .filter((p) => p)

        if (periodsFormatted.length === 0) {
          ElMessage.error('请添加至少一个有效的课程时间')
          emit('submit', formData, false)
          return
        }
      }
    }

    // 提交表单
    emit('submit', formData, true)
  })
}

/**
 * 取消对话框
 */
const cancel = () => {
  emit('cancel')
}

/**
 * 关闭对话框时处理
 */
const handleClose = () => {
  // 重置表单验证
  if (formRef.value) {
    formRef.value.resetFields()
    selectedCourseType.value = ''
    multiDayRanges.value = [{ startDate: '', endDate: '' }]
  }
}
</script>

<style scoped>
.time-period-container {
  width: 100%;
}

.time-period-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.time-separator {
  margin: 0 10px;
}

.time-period-btn {
  margin-left: 10px;
}

.add-first-period {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
}
</style>
