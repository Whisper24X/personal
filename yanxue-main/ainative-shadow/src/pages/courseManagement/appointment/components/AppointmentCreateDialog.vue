<template>
  <el-dialog
    title="添加课程预约"
    v-model="dialogVisible"
    width="650px"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
      <!-- 订单查询 -->
      <el-form-item label="手机号" prop="phoneNumber">
        <div class="phone-search">
          <el-input
            v-model="formData.phoneNumber"
            placeholder="请输入手机号"
            maxlength="11"
            style="width: calc(100% - 100px)"
          />
          <el-button
            type="primary"
            @click="handleSearchOrder"
            :loading="orderLoading"
            >查询订单</el-button
          >
        </div>
      </el-form-item>

      <!-- 订单选择 -->
      <el-form-item label="选择订单" prop="orderId">
        <el-select
          v-model="formData.orderId"
          placeholder="请选择订单"
          clearable
          filterable
          style="width: 100%"
          :disabled="!orderOptions.length"
          @change="handleOrderChange"
        >
          <el-option
            v-for="item in orderOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
            <div class="order-option">
              <span>{{ item.label }}</span>
              <span class="order-price">￥{{ item.price }}</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 商品信息展示 -->
      <div v-if="goodInfoDisplay" class="good-info-display">
        <h4>{{ goodInfoDisplay.name }}</h4>
      </div>

      <!-- 课程分类选择 -->
      <el-form-item
        label="课程分类"
        prop="categoryId"
        v-if="categoryOptions.length > 0"
      >
        <el-select
          v-model="formData.categoryId"
          placeholder="请选择课程分类"
          clearable
          filterable
          style="width: 100%"
          @change="handleCategoryChange"
        >
          <el-option
            v-for="item in categoryOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
            <div class="category-option">
              <span>{{ item.label }}</span>
              <span class="category-info">可用次数: {{ item.useTimes }}</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 课程选择 -->
      <el-form-item
        label="课程选择"
        prop="courseId"
        v-if="courseOptions.length > 0"
      >
        <el-select
          v-model="formData.courseId"
          placeholder="请选择课程"
          clearable
          filterable
          style="width: 100%"
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

      <!-- 课程日期：单日营使用日期选择器，多日营使用下拉（返回为"xxxx到xxxx"） -->
      <el-form-item label="课程日期" prop="courseDate">
        <template v-if="!isMultiCamp">
          <el-date-picker
            v-model="formData.courseDate"
            type="date"
            placeholder="请选择课程日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            :disabled="!formData.courseId"
            :disabled-date="disabledDate"
            @change="handleDateChange"
          />
        </template>
        <template v-else>
          <el-select
            v-model="formData.courseDate"
            placeholder="请选择课程日期范围"
            clearable
            filterable
            style="width: 100%"
            :disabled="!formData.courseId || availableDates.length === 0"
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
          :disabled="!formData.courseId || !formData.courseDate"
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

      <!-- 家长是否陪同（多日营隐藏，默认未知） -->
      <el-form-item
        v-if="!isMultiCamp"
        label="家长是否陪同"
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
  queryOrdersByPhone,
  queryCoursesByOrderId,
} from '../service'
import type { CategoryItem, CourseItem } from '../service.type'
import dayjs from 'dayjs'

// 组件属性定义
const props = defineProps<{
  visible: boolean
  loading: boolean
}>()

// 组件事件定义
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', form: any): void
  (e: 'cancel'): void
}>()

// 计算属性 - 对话框显示状态
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

// 表单引用
const formRef = ref<FormInstance>()

// 加载状态
const orderLoading = ref(false) // 订单加载状态
const courseLoading = ref(false) // 课程加载状态
const periodLoading = ref(false) // 时段加载状态

// 选项列表
const orderOptions = ref<{ label: string; value: string; price: number }[]>([])
const categoryOptions = ref<
  { label: string; value: string; useTimes: number; category: CategoryItem }[]
>([])
const courseOptions = ref<{ label: string; value: string }[]>([])
const periodOptions = ref<string[]>([])
// 多日营标识：single-单日，multi-多日
const isMultiCamp = ref(false)

// 商品分类和课程数据
const categoriesData = ref<CategoryItem[]>([])
// 商品信息展示
const goodInfoDisplay = ref<{ name: string } | null>(null)

/**
 * 表单数据
 */
const formData = reactive({
  phoneNumber: '', // 手机号
  orderId: '', // 订单ID
  categoryId: '', // 课程分类ID
  courseId: '', // 课程ID
  courseDate: '', // 课程日期
  coursePeriod: '', // 课程时间段
  childName: '', // 孩子姓名
  idNumber: '', // 身份证号
  gender: 'M', // 性别
  studentAge: 8, // 年龄
  parentName: '', // 家长姓名
  parentPhone: '', // 家长手机号
  parentAccompany: 'yes', // 家长是否陪同
  businessRemark: '', // 业务备注
})

// 获取今天的日期
const today = dayjs().startOf('day')

// 计算前后90天的日期范围
const startDate = today.subtract(90, 'day').format('YYYY-MM-DD')
const endDate = today.add(90, 'day').format('YYYY-MM-DD')

/**
 * 检查日期是否过期（用于多日营过滤）
 * @param dateStr 日期字符串，可能是单个日期或范围字符串（如 "2024-01-01到2024-01-03"）
 * @returns 如果日期未过期返回true，否则返回false
 */
function isDateNotExpired(dateStr: string): boolean {
  if (!dateStr) return false

  const today = dayjs().startOf('day')

  try {
    // 判断是否为范围字符串（多日营）
    if (dateStr.includes('到')) {
      // 提取开始日期
      const startDate = dateStr.split('到')[0].trim()
      if (!startDate) return false

      const startDateObj = dayjs(startDate).startOf('day')
      // 如果日期无效或开始日期在今天之前，则认为已过期
      if (!startDateObj.isValid()) return false
      // 如果开始日期在今天或之后，则认为未过期
      return !startDateObj.isBefore(today)
    } else {
      // 单个日期，直接比较
      const dateObj = dayjs(dateStr).startOf('day')
      // 如果日期无效或今天之前，则认为已过期
      if (!dateObj.isValid()) return false
      return !dateObj.isBefore(today)
    }
  } catch (error) {
    console.error('日期格式解析错误:', dateStr, error)
    return false
  }
}

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
  phoneNumber: [{ required: true, validator: validatePhone, trigger: 'blur' }],
  orderId: [{ required: true, message: '请选择订单', trigger: 'change' }],
  categoryId: [
    { required: true, message: '请选择课程分类', trigger: 'change' },
  ],
  courseId: [
    { required: true, message: '请选择可预约课程', trigger: 'change' },
  ],
  courseDate: [
    { required: true, message: '请选择课程日期', trigger: 'change' },
  ],
  coursePeriod: [
    { required: true, message: '请选择课程时段', trigger: 'change' },
  ],
  childName: [{ required: true, message: '请输入孩子姓名', trigger: 'blur' }],
  idNumber: [{ validator: validateIdNumber, trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  studentAge: [{ required: true, message: '请输入年龄', trigger: 'blur' }],
  parentName: [{ required: true, message: '请输入家长姓名', trigger: 'blur' }],
  parentPhone: [{ required: true, validator: validatePhone, trigger: 'blur' }],
  parentAccompany: [
    { required: true, message: '请选择家长是否陪同', trigger: 'change' },
  ],
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
 * 监听对话框显示状态
 */
watch(
  () => dialogVisible.value,
  (visible) => {
    if (visible) {
      // 重置数据
      resetForm()
    }
  },
)

/**
 * 重置表单
 */
const resetForm = () => {
  // 重置表单数据
  Object.assign(formData, {
    phoneNumber: '',
    orderId: '',
    categoryId: '',
    courseId: '',
    courseDate: '',
    coursePeriod: '',
    childName: '',
    idNumber: '',
    gender: 'M',
    studentAge: 8,
    parentName: '',
    parentPhone: '',
    parentAccompany: 'yes',
    businessRemark: '', // 重置业务备注
  })

  // 清空选项列表
  orderOptions.value = []
  categoryOptions.value = []
  courseOptions.value = []
  periodOptions.value = []
  availableDates.value = []
  categoriesData.value = []
  goodInfoDisplay.value = null
  isMultiCamp.value = false

  // 重置表单验证
  if (formRef.value) {
    formRef.value.resetFields()
  }
}

/**
 * 处理订单查询
 */
const handleSearchOrder = async () => {
  if (!formData.phoneNumber) {
    ElMessage.warning('请输入手机号')
    return
  }

  try {
    orderLoading.value = true

    // 清空之前的选择
    formData.orderId = ''
    formData.categoryId = ''
    formData.courseId = ''
    formData.courseDate = ''
    formData.coursePeriod = ''
    orderOptions.value = []
    categoryOptions.value = []
    courseOptions.value = []
    periodOptions.value = []
    categoriesData.value = []
    goodInfoDisplay.value = null

    // 通过手机号查询订单
    const res = await queryOrdersByPhone(formData.phoneNumber)
    if (res && res.list && res.list.length > 0) {
      // 过滤有效订单（根据业务需求可能需要调整）
      const validOrders = res.list.filter(
        (item: { status: string }) =>
          item.status === 'success' || item.status === 'pending',
      )

      if (validOrders.length > 0) {
        // 转换订单选项
        orderOptions.value = validOrders.map(
          (item: {
            orderNumber: string
            goodName: string
            id: string
            orderPrice: number
          }) => ({
            label: `${item.orderNumber} - ${item.goodName}`,
            value: item.id,
            price: item.orderPrice,
          }),
        )

        // 自动填充家长手机号
        formData.parentPhone = formData.phoneNumber

        // 显示订单数量
        ElMessage.success(`查询到 ${validOrders.length} 个有效订单`)
      } else {
        ElMessage.warning('未查询到有效订单，请确认订单状态')
      }
    } else {
      ElMessage.warning('未查询到订单')
    }
  } catch (error) {
    console.error('查询订单失败:', error)
    ElMessage.error('查询订单失败，请稍后重试')
  } finally {
    orderLoading.value = false
  }
}

/**
 * 处理订单选择变更
 */
const handleOrderChange = async () => {
  // 清空课程相关选择
  formData.categoryId = ''
  formData.courseId = ''
  formData.courseDate = ''
  formData.coursePeriod = ''
  categoryOptions.value = []
  courseOptions.value = []
  periodOptions.value = []
  categoriesData.value = []
  goodInfoDisplay.value = null

  if (!formData.orderId) {
    return
  }

  try {
    courseLoading.value = true

    // 通过订单ID查询可用课程
    const res = await queryCoursesByOrderId(formData.orderId)
    if (
      res &&
      res.goodInfo &&
      res.goodInfo.content &&
      res.goodInfo.content.goodCategories
    ) {
      // 设置商品类型
      isMultiCamp.value = (res.goodInfo as any).goodType === 'multi'

      // 设置商品信息展示
      goodInfoDisplay.value = {
        name: res.goodInfo.name,
      }

      const categories = res.goodInfo.content.goodCategories
      categoriesData.value = categories

      // 处理课程分类（根据后端返回的已预约使用次数计算剩余次数）
      categoryOptions.value = categories
        .map((category: CategoryItem) => {
          const already = Number(category.alreadyAppointmentUseTimes || 0)
          const remain = Math.max(0, Number(category.useTimes || 0) - already)
          return {
            label: category.categoryName,
            value: category.categoryId,
            useTimes: remain, // 剩余可用次数
            category: category,
          }
        })
        .filter((item: { useTimes: number }) => item.useTimes > 0) // 只保留有可用次数的分类

      // 如果找到可预约的分类
      if (categoryOptions.value.length > 0) {
        ElMessage.success(
          `查询到 ${categoryOptions.value.length} 个可用课程分类`,
        )

        // 提取订单中的客户信息
        if (res.orderInfo && res.orderInfo.phone) {
          // 自动填充家长手机号
          formData.parentPhone = res.orderInfo.phone
        }
      } else {
        ElMessage.warning('该订单下没有可预约的课程分类')
      }
    } else {
      ElMessage.warning('未查询到课程信息')
    }
  } catch (error) {
    console.error('查询可用课程失败:', error)
    ElMessage.error('查询可用课程失败，请稍后重试')
  } finally {
    courseLoading.value = false
  }
}

/**
 * 处理分类选择变更
 */
const handleCategoryChange = () => {
  // 清空课程选择
  formData.courseId = ''
  formData.courseDate = ''
  formData.coursePeriod = ''
  courseOptions.value = []
  periodOptions.value = []

  if (!formData.categoryId) {
    return
  }

  // 查找选中的分类
  const selectedCategory = categoriesData.value.find(
    (item) => item.categoryId === formData.categoryId,
  )
  if (!selectedCategory) {
    return
  }

  // 依据后端返回的可用次数进行判断
  const remain = Math.max(
    0,
    Number(selectedCategory.useTimes || 0) -
      Number(selectedCategory.alreadyAppointmentUseTimes || 0),
  )
  if (remain <= 0) {
    ElMessage.warning('该课程分类已达到可预约次数上限')
    return
  }

  // 提取该分类下的课程（允许同一类别中课程多次选择，不再根据 isAppointment 过滤）
  courseOptions.value = selectedCategory.courses.map((course: CourseItem) => ({
    label: course.courseName,
    value: course.courseId,
  }))

  if (courseOptions.value.length === 0) {
    ElMessage.warning('该分类下没有可预约的课程')
  }
}

/**
 * 处理课程选择变更
 */
const handleCourseChange = async () => {
  // 清空日期和时段
  formData.courseDate = ''
  formData.coursePeriod = ''
  periodOptions.value = []
  availableDates.value = []

  if (!formData.courseId) {
    return
  }

  try {
    // 显示加载状态
    courseLoading.value = true

    // 获取课程库存数据，传入日期范围参数
    const res = await getCourseStockSelector(formData.courseId, {
      startDate,
      endDate,
    })

    if (res && res.items && res.items.length > 0) {
      // 提取可用日期（多日营返回为范围字符串），过滤掉已过期的日期
      const dates = [...new Set(res.items.map((item) => item.date))]
      availableDates.value = dates.filter((date) => isDateNotExpired(date))

      if (availableDates.value.length > 0) {
        // 按日期排序
        availableDates.value.sort((a, b) => a.localeCompare(b))

        // 显示可用日期数量
        ElMessage.success(
          `该课程有 ${availableDates.value.length} 个可预约日期`,
        )
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

// 可用日期列表
const availableDates = ref<string[]>([])

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

  // 如果没有可用日期列表，则使用90天范围限制，并禁用今天之前的日期
  const today = dayjs().startOf('day')
  const maxDate = today.add(90, 'day')
  const dateTime = dayjs(time)

  // 禁用今天之前的日期和超出90天范围的日期
  return dateTime.isBefore(today) || dateTime.isAfter(maxDate)
}

/**
 * 处理日期变更
 */
async function handleDateChange() {
  if (isMultiCamp.value) {
    // 多日营无时段，清空并跳过加载
    formData.coursePeriod = ''
    periodOptions.value = []
    return
  }
  // 清空课程时段
  formData.coursePeriod = ''
  periodOptions.value = []

  if (!formData.courseDate || !formData.courseId) return

  try {
    periodLoading.value = true

    // 如果已经有课程库存数据，直接从中筛选对应日期的时间段
    const selectedDateItems = availableDates.value.includes(formData.courseDate)

    if (!selectedDateItems) {
      // 如果选择的日期不在可用日期列表中，提示用户
      ElMessage.warning('所选日期不可用，请重新选择')
      formData.courseDate = ''
      return
    }

    // 获取课程库存数据，传入日期范围参数
    const res = await getCourseStockSelector(formData.courseId, {
      startDate: formData.courseDate,
      endDate: formData.courseDate,
    })

    if (res && res.items && res.items.length > 0) {
      // 直接使用返回的时间段，因为API已经根据日期范围过滤
      const periodsForDate = res.items
        .filter((item) => item.date === formData.courseDate)
        .map((item) => item.period)

      // 去重
      periodOptions.value = [...new Set(periodsForDate)]

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
 * 提交表单
 */
const submit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) {
      return
    }

    // 构建提交的数据，符合新API的参数要求
    const submitData: any = {
      orderId: formData.orderId,
      categoryId: formData.categoryId, // 可选参数，课程分类ID
      courseId: formData.courseId,
      date: formData.courseDate,
      studentName: formData.childName,
      studentIdentityCard: formData.idNumber,
      studentSex: formData.gender,
      studentAge: formData.studentAge,
      parentName: formData.parentName,
      parentPhone: formData.parentPhone,
      parentAccompany: isMultiCamp.value ? 'unknown' : formData.parentAccompany,
      businessRemark: formData.businessRemark, // 新增业务备注
    }

    if (!isMultiCamp.value) {
      submitData.period = formData.coursePeriod
    }

    // 提交表单
    emit('submit', submitData)
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
  // 重置表单
  resetForm()
}
</script>

<style scoped>
.el-form-item {
  margin-bottom: 20px;
}

.phone-search {
  display: flex;
  gap: 10px;
}

.order-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.order-price {
  color: #f56c6c;
  font-weight: bold;
}

.category-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.category-info {
  color: #909399;
  font-weight: normal;
}

.good-info-display {
  margin-bottom: 20px;
}
</style>
