<template>
  <el-dialog
    :title="title"
    v-model="dialogVisible"
    width="600px"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
      <!-- 课程选择 -->
      <el-form-item label="课程名称" prop="courseId">
        <el-select
          v-if="!formData.isEditMode"
          v-model="formData.courseId"
          placeholder="请选择课程名称"
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
        <el-input
          v-else
          v-model="formData.courseName"
          disabled
          style="width: 100%"
        />
      </el-form-item>

      <!-- 课程日期：单日营使用日期选择器，多日营使用下拉（返回为范围字符串） -->
      <el-form-item label="课程日期" prop="courseDate">
        <template v-if="!isMultiCamp">
          <el-date-picker
            v-model="formData.courseDate"
            type="date"
            placeholder="请选择课程日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            :disabled-date="disabledDate"
            @change="(d:any)=>handleDateChange(d)"
          />
        </template>
        <template v-else>
          <el-select
            v-model="formData.courseDate"
            placeholder="请选择课程日期范围"
            clearable
            filterable
            style="width: 100%"
            :disabled="availableDates.length === 0"
          >
            <el-option
              v-for="d in availableDates"
              :key="d"
              :label="d"
              :value="d"
            />
          </el-select>
        </template>
      </el-form-item>

      <!-- 课程时段（仅单日营显示） -->
      <el-form-item v-if="!isMultiCamp" label="课程时段" prop="coursePeriod">
        <el-select
          v-model="formData.coursePeriod"
          placeholder="请选择课程时段"
          clearable
          filterable
          style="width: 100%"
          :loading="periodLoading"
          :disabled="!formData.courseDate || periodOptions.length === 0"
        >
          <el-option
            v-for="item in periodOptions"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </el-form-item>

      <!-- 预约人信息 -->
      <el-form-item label="姓名" prop="childName">
        <el-input
          v-model="formData.childName"
          placeholder="请输入孩子姓名"
          maxlength="20"
        />
      </el-form-item>

      <el-form-item label="身份证号" prop="idNumber">
        <el-input
          v-model="formData.idNumber"
          placeholder="请输入身份证号"
          maxlength="18"
        />
      </el-form-item>

      <el-form-item label="性别" prop="gender">
        <el-radio-group v-model="formData.gender">
          <el-radio label="M">男</el-radio>
          <el-radio label="F">女</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="年龄" prop="studentAge">
        <el-input-number
          v-model="formData.studentAge"
          :min="1"
          :max="18"
          :precision="0"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="家长姓名" prop="parentName">
        <el-input
          v-model="formData.parentName"
          placeholder="请输入家长姓名"
          maxlength="20"
        />
      </el-form-item>

      <el-form-item label="家长手机号" prop="parentPhone">
        <el-input
          v-model="formData.parentPhone"
          placeholder="请输入家长手机号"
          maxlength="11"
        />
      </el-form-item>

      <!-- 家长是否同行（多日营隐藏，默认未知） -->
      <el-form-item
        v-if="!isMultiCamp"
        label="家长是否同行"
        prop="parentAccompany"
      >
        <el-radio-group v-model="formData.parentAccompany">
          <el-radio label="yes">是</el-radio>
          <el-radio label="no">否</el-radio>
          <el-radio label="unknown">未知</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="业务备注" prop="businessRemark">
        <el-input
          v-model="formData.businessRemark"
          type="textarea"
          :rows="3"
          placeholder="请输入业务备注"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>

      <!-- <el-form-item label="核销券码">
                <FileUpload v-model="formData.verificationCode" accept=".jpg,.jpeg,.png,.gif" :limit="1"
                    file-path="verification" list-type="picture-card" tip-message="支持的图片格式: jpg, jpeg, png, gif"
                    @file-uploaded="handleFileUploaded" />
            </el-form-item> -->
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
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  getCourseTimePeriods,
  getAvailableDates,
  getAvailablePeriodsForDate,
  getCourseStockSelector,
  getCourseSelector,
} from '../service'
import FileUpload from '@/components/FileUpload/index.vue'
import dayjs from 'dayjs'

/**
 * 预约编辑表单数据接口
 */
interface AppointmentForm {
  id: string
  courseId: string
  courseDate: string
  coursePeriod: string
  childName: string
  idNumber: string
  gender: string
  studentAge: number
  parentName: string
  parentPhone: string
  parentAccompany: string // 修改为string类型: yes-是, no-否, unknown-未知
  verificationCode: string
  isCreate: boolean
  isEditMode: boolean // 是否为编辑模式
  courseName: string // 课程名称
  // 添加新API字段，用于兼容
  date?: string
  period?: string
  studentName?: string
  studentIdentityCard?: string
  studentSex?: string
  businessRemark?: string // 新增业务备注字段
}

// 组件属性定义
const props = defineProps<{
  visible: boolean
  title: string
  form: AppointmentForm
  loading: boolean
}>()

// 组件事件定义
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', form: AppointmentForm, valid: boolean): void
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
const formData = reactive<AppointmentForm>({ ...props.form })

// 课程时间段选项
const periodOptions = ref<string[]>([])
const periodLoading = ref(false)
// 多日营标识
const isMultiCamp = ref(false)

// 可用日期列表
const availableDates = ref<string[]>([])
const datesLoading = ref(false)

// 课程选项
const courseOptions = ref<{ label: string; value: string }[]>([])
const courseLoading = ref(false)

/**
 * 加载课程选项
 */
async function loadCourseOptions() {
  // 编辑模式下不需要加载课程选项
  if (formData.isEditMode) return

  try {
    courseLoading.value = true

    // 获取课程选项
    const res = await getCourseSelector()
    if (res && res.list) {
      courseOptions.value = res.list.map((item) => ({
        label: item.courseName,
        value: item.id,
      }))
    }
  } catch (error) {
    console.error('获取课程选项失败:', error)
    ElMessage.error('获取课程选项失败')
  } finally {
    courseLoading.value = false
  }
}

/**
 * 加载课程库存信息
 */
async function loadStockInfo(
  courseId: string,
  startDate?: string,
  endDate?: string,
) {
  if (!courseId) return

  try {
    // 如果没有指定日期范围，使用前后90天
    if (!startDate || !endDate) {
      const today = dayjs().startOf('day')
      startDate = today.subtract(90, 'day').format('YYYY-MM-DD')
      endDate = today.add(90, 'day').format('YYYY-MM-DD')
    }

    // 获取课程库存数据
    const res = await getCourseStockSelector(courseId, { startDate, endDate })

    if (res && res.items && res.items.length > 0) {
      // 判断是否为多日营：period 为空且日期为范围
      isMultiCamp.value = res.items.every(
        (it) => !it.period || it.period === '',
      )
      // 提取可用日期（多日营为范围字符串），不过滤开始日期
      availableDates.value = [...new Set(res.items.map((item) => item.date))]

      // 按日期排序
      availableDates.value.sort((a, b) => a.localeCompare(b))

      // 如果当前选择的日期不在可用范围内，则清空
      if (
        formData.courseDate &&
        !availableDates.value.includes(formData.courseDate)
      ) {
        formData.courseDate = ''
        formData.coursePeriod = ''
        ElMessage.warning('原选择的日期已不可用，请重新选择')
      } else if (formData.courseDate) {
        // 如果有选择日期，则更新对应的时间段选项
        if (!isMultiCamp.value) {
          updatePeriodOptions(formData.courseDate, res.items)
        }
      } else if (availableDates.value.length > 0) {
        // 没有选择日期但有可用日期，显示成功信息
        ElMessage.success(
          `该课程有 ${availableDates.value.length} 个可预约日期`,
        )
      }
    } else {
      // 如果没有可用日期和时间，则清空
      availableDates.value = []
      periodOptions.value = []
      formData.courseDate = ''
      formData.coursePeriod = ''
      ElMessage.warning('当前课程没有可用日期')
    }
  } catch (error) {
    console.error('获取课程库存信息失败:', error)
    availableDates.value = []
    periodOptions.value = []
    ElMessage.error('获取课程库存信息失败')
  }
}

// 监听props.form变化，更新本地数据
watch(
  () => props.form,
  (newForm) => {
    console.log('接收到新的表单数据:', newForm)
    Object.assign(formData, newForm)
    console.log('更新后的formData:', formData)
  },
  { deep: true },
)

// 监听对话框显示状态，加载可用日期
watch(
  () => dialogVisible.value,
  async (visible) => {
    if (visible) {
      // 获取今天的日期
      const today = dayjs().startOf('day')

      // 计算前后90天的日期范围
      const startDate = today.subtract(90, 'day').format('YYYY-MM-DD')
      const endDate = today.add(90, 'day').format('YYYY-MM-DD')

      // 如果是编辑模式且已选择课程
      if (formData.isEditMode && formData.courseId) {
        // 保存原始日期和时段
        const originalDate = formData.courseDate
        const originalPeriod = formData.coursePeriod

        // 显示加载状态
        courseLoading.value = true

        try {
          // 直接从课程库存中加载时间段选项
          await loadStockInfo(formData.courseId, startDate, endDate)

          // 如果原始日期在可用日期中，保留原始日期和可用的时段
          if (originalDate && availableDates.value.includes(originalDate)) {
            formData.courseDate = originalDate
            // 加载该日期对应的时间段，并尝试保留原始时段
            await handleDateChange(originalDate, originalPeriod)
          } else if (originalDate) {
            // 如果原始日期不可用，提示用户
            ElMessage.warning('原选择的日期已不可用，请重新选择')
            formData.courseDate = ''
            formData.coursePeriod = ''
          }
        } catch (error) {
          console.error('加载课程库存信息失败:', error)
          ElMessage.error('加载课程库存信息失败')
        } finally {
          courseLoading.value = false
        }
      } else {
        // 非编辑模式，加载课程选项
        await loadCourseOptions()

        // 如果已有选择的课程和日期，加载对应的时段
        if (formData.courseId && formData.courseDate) {
          courseLoading.value = true

          try {
            await loadStockInfo(formData.courseId, startDate, endDate)

            // 如果日期不可用，提示用户
            if (!availableDates.value.includes(formData.courseDate)) {
              ElMessage.warning('当前选择的日期已不可用，请重新选择')
              formData.courseDate = ''
              formData.coursePeriod = ''
            }
          } catch (error) {
            console.error('加载课程库存信息失败:', error)
            ElMessage.error('加载课程库存信息失败')
          } finally {
            courseLoading.value = false
          }
        }
      }
    }
  },
  { immediate: true },
)

/**
 * 手机号验证规则
 */
const validatePhone = (rule: any, value: string, callback: Function) => {
  if (!value) {
    callback(new Error('请输入手机号'))
  } else if (!/^1[3-9]\d{9}$/.test(value)) {
    callback(new Error('请输入正确的手机号'))
  } else {
    callback()
  }
}

/**
 * 身份证号验证规则
 */
const validateIdNumber = (rule: any, value: string, callback: Function) => {
  if (!value) {
    callback()
  } else if (!/^\d{17}[\dXx]$/.test(value)) {
    callback(new Error('请输入正确的身份证号'))
  } else {
    callback()
  }
}

/**
 * 表单验证规则
 */
const rules = reactive<FormRules>({
  courseId: [{ required: true, message: '请选择课程', trigger: 'change' }],
  courseDate: [
    { required: true, message: '请选择课程日期', trigger: 'change' },
  ],
  coursePeriod: [],
  childName: [{ required: true, message: '请输入孩子姓名', trigger: 'blur' }],
  idNumber: [{ validator: validateIdNumber, trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  studentAge: [{ required: true, message: '请输入年龄', trigger: 'blur' }],
  parentName: [{ required: true, message: '请输入家长姓名', trigger: 'blur' }],
  parentPhone: [{ required: true, validator: validatePhone, trigger: 'blur' }],
  parentAccompany: [],
  businessRemark: [
    { max: 500, message: '业务备注不能超过500个字符', trigger: 'blur' },
  ],
})

// 根据是否多日营动态调整必填规则
watch(
  () => isMultiCamp.value,
  (multi) => {
    if (multi) {
      rules.coursePeriod = []
      rules.parentAccompany = []
    } else {
      rules.coursePeriod = [
        { required: true, message: '请选择课程时段', trigger: 'change' },
      ]
      rules.parentAccompany = [
        { required: true, message: '请选择家长是否陪同', trigger: 'change' },
      ]
    }
    if (formRef.value) {
      formRef.value.clearValidate(['coursePeriod', 'parentAccompany'])
    }
  },
)

/**
 * 加载可用日期列表
 */
async function loadAvailableDates() {
  try {
    datesLoading.value = true
    availableDates.value = []

    // 如果选择了课程，则使用getCourseStockSelector获取可用日期
    if (formData.courseId) {
      await loadStockInfo(formData.courseId)

      if (availableDates.value.length === 0) {
        ElMessage.warning('当前课程没有可用日期')
      }
    } else {
      // 如果没有选择课程，则清空可用日期
      availableDates.value = []
    }
  } catch (error) {
    console.error('获取可用日期列表失败:', error)
    ElMessage.error('获取可用日期列表失败')
    availableDates.value = []
  } finally {
    datesLoading.value = false
  }
}

/**
 * 加载指定日期下的可用时段
 */
async function loadPeriodsForDate(date: string) {
  try {
    periodLoading.value = true
    periodOptions.value = []

    if (!date || !formData.courseId) return

    // 从课程库存中获取数据
    const res = await getCourseStockSelector(formData.courseId, {
      startDate: date,
      endDate: date,
    })

    if (res && res.items && res.items.length > 0) {
      // 使用updatePeriodOptions函数更新时间段选项
      updatePeriodOptions(date, res.items)
    } else {
      periodOptions.value = []
      ElMessage.warning('当前课程没有可用时段')
    }
  } catch (error) {
    console.error('获取指定日期下的可用时段失败:', error)
    ElMessage.error('获取可用时段失败')
    periodOptions.value = []
  } finally {
    periodLoading.value = false
  }
}

/**
 * 处理日期变更
 * @param date 选择的日期
 * @param originalPeriod 原始时段值（可选）
 */
async function handleDateChange(date: string, originalPeriod?: string) {
  if (isMultiCamp.value) {
    formData.coursePeriod = ''
    periodOptions.value = []
    return
  }
  // 清空课程时段
  formData.coursePeriod = ''
  periodOptions.value = []

  if (!date || !formData.courseId) return

  try {
    periodLoading.value = true

    // 如果已经有课程库存数据，直接从中筛选对应日期的时间段
    const selectedDateItems = availableDates.value.includes(date)

    if (!selectedDateItems) {
      // 如果选择的日期不在可用日期列表中，提示用户
      ElMessage.warning('所选日期不可用，请重新选择')
      formData.courseDate = ''
      return
    }

    // 获取课程库存数据，传入日期范围参数
    const res = await getCourseStockSelector(formData.courseId, {
      startDate: date,
      endDate: date,
    })

    if (res && res.items && res.items.length > 0) {
      // 直接使用返回的时间段，过滤出选定日期的时间段
      const periodsForDate = res.items
        .filter((item) => item.date === date)
        .map((item) => item.period)

      // 去重
      periodOptions.value = [...new Set(periodsForDate)]

      // 如果有原始时段且在可用范围内，则保留该时段
      if (originalPeriod && periodOptions.value.includes(originalPeriod)) {
        formData.coursePeriod = originalPeriod
      }

      if (periodOptions.value.length > 0) {
        ElMessage.success(
          `当前日期有 ${periodOptions.value.length} 个可用时间段`,
        )
      } else {
        ElMessage.warning('当前日期没有可用时间段')
      }
    } else {
      ElMessage.warning('当前课程没有可用时间段')
    }
  } catch (error) {
    console.error('获取可用时间段失败:', error)
    ElMessage.error('获取可用时间段失败')
  } finally {
    periodLoading.value = false
  }
}

/**
 * 禁用不可选日期
 */
function disabledDate(time: Date) {
  // 如果没有选择课程，禁用所有日期
  if (!formData.courseId) {
    return true
  }

  // 将时间格式化为YYYY-MM-DD格式
  const dateString = dayjs(time).format('YYYY-MM-DD')

  // 如果已加载可用日期列表，只允许在可用日期列表中的日期
  if (availableDates.value.length > 0) {
    return !availableDates.value.includes(dateString)
  }

  // 如果没有可用日期列表，则使用90天范围限制
  const today = dayjs().startOf('day')
  const minDate = today.subtract(90, 'day')
  const maxDate = today.add(90, 'day')
  const dateTime = dayjs(time)

  return dateTime.isBefore(minDate) || dateTime.isAfter(maxDate)
}

/**
 * 处理文件上传完成
 */
const handleFileUploaded = (file: any) => {
  if (file && file.url) {
    formData.verificationCode = file.url
    ElMessage.success('图片上传成功')
  }
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

    // 构建符合新API的参数要求
    const submitData: any = {
      ...formData,
      // 设置新API所需的字段
      date: formData.courseDate,
      studentName: formData.childName,
      studentIdentityCard: formData.idNumber,
      studentSex: formData.gender,
      // 确保年龄是数字类型
      studentAge: formData.studentAge,
      // 保留其他字段
      parentAccompany: isMultiCamp.value ? 'unknown' : formData.parentAccompany,
      businessRemark: formData.businessRemark,
    }
    if (!isMultiCamp.value) {
      submitData.period = formData.coursePeriod
    }

    // 提交表单
    emit('submit', submitData, true)
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
  }
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
 * 处理课程变更
 */
const handleCourseChange = async () => {
  // 编辑模式下不允许修改课程
  if (formData.isEditMode) return

  // 清空课程日期和时段
  formData.courseDate = ''
  formData.coursePeriod = ''

  // 清空可用日期和时间段
  availableDates.value = []
  periodOptions.value = []

  if (!formData.courseId) {
    return
  }

  try {
    // 显示加载状态
    courseLoading.value = true

    // 获取今天的日期
    const today = dayjs().startOf('day')

    // 计算前后90天的日期范围
    const startDate = today.subtract(90, 'day').format('YYYY-MM-DD')
    const endDate = today.add(90, 'day').format('YYYY-MM-DD')

    // 获取课程库存数据，传入日期范围参数
    const res = await getCourseStockSelector(formData.courseId, {
      startDate,
      endDate,
    })

    if (res && res.items && res.items.length > 0) {
      // 提取可用日期
      availableDates.value = [...new Set(res.items.map((item) => item.date))]

      if (availableDates.value.length > 0) {
        // 按日期排序
        availableDates.value.sort((a, b) => a.localeCompare(b))

        // 显示可用日期数量
        ElMessage.success(
          `该课程有 ${availableDates.value.length} 个可预约日期`,
        )

        // 自动选择第一个可用日期
        formData.courseDate = availableDates.value[0]

        // 更新该日期对应的时间段
        await handleDateChange(formData.courseDate)
      } else {
        ElMessage.warning('当前课程没有可用日期')
      }
    } else {
      ElMessage.warning('当前课程没有可用日期')
    }
  } catch (error) {
    console.error('获取可用日期失败:', error)
    ElMessage.error('获取可用日期失败')
  } finally {
    // 隐藏加载状态
    courseLoading.value = false
  }
}

/**
 * 更新时间段选项
 * @param date 选择的日期
 * @param items 课程库存项列表
 */
function updatePeriodOptions(date: string, items: any[]) {
  if (!date || !items || items.length === 0) {
    periodOptions.value = []
    return
  }

  // 过滤出选定日期的时间段
  const periodsForDate = items
    .filter((item) => item.date === date)
    .map((item) => item.period)

  // 去重
  periodOptions.value = [...new Set(periodsForDate)]

  // 如果当前选择的时间段不在可选范围内，则清空
  if (
    formData.coursePeriod &&
    !periodOptions.value.includes(formData.coursePeriod)
  ) {
    formData.coursePeriod = ''
  }

  if (periodOptions.value.length > 0) {
    ElMessage.success(`当前日期有 ${periodOptions.value.length} 个可用时间段`)
  } else {
    ElMessage.warning('当前日期没有可用时间段')
  }
}

/**
 * 处理日期范围变更
 */
async function handleDateRangeChange(dates: string[]) {
  // 清空课程时段
  formData.coursePeriod = ''
  periodOptions.value = []

  if (!dates || dates.length !== 2 || !formData.courseId) return

  try {
    periodLoading.value = true

    // 获取课程库存数据，传入日期范围参数
    const res = await getCourseStockSelector(formData.courseId, {
      startDate: dates[0],
      endDate: dates[1],
    })

    if (res && res.items && res.items.length > 0) {
      // 直接使用返回的时间段，因为API已经根据日期范围过滤
      const periodsForDate = res.items.map((item) => item.period)

      // 去重
      periodOptions.value = [...new Set(periodsForDate)]

      // 设置单日期字段，保持向后兼容
      formData.courseDate = dates[0]

      if (periodOptions.value.length === 0) {
        ElMessage.warning('当前日期范围内没有可用时间段')
      }
    } else {
      ElMessage.warning('当前课程没有可用时间段')
    }
  } catch (error) {
    console.error('获取可用时间段失败:', error)
    ElMessage.error('获取可用时间段失败')
  } finally {
    periodLoading.value = false
  }
}
</script>

<style scoped>
.el-form-item {
  margin-bottom: 20px;
}
</style>
