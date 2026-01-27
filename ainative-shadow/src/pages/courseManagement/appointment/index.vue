<template>
  <div class="course-appointment-container">
    <CommonTable
      ref="tableRef"
      v-loading="loading"
      :fetch-data="getList"
      :search-form="searchForm"
      :default-search-form="defaultSearchForm"
      :show-search="true"
      :show-extra-buttons="true"
      @selection-change="handleSelectionChange"
    >
      <!-- 搜索条件 -->
      <template #search-items>
        <el-form :inline="true" :model="searchForm.params">
          <el-form-item label="课程名称">
            <el-select
              v-model="searchForm.params.courseId"
              placeholder="请选择课程名称"
              clearable
              filterable
              style="width: 220px"
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
          <el-form-item label="课程日期">
            <el-date-picker
              v-model="searchForm.params.courseDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              :shortcuts="dateShortcuts"
              style="width: 260px"
            />
          </el-form-item>
          <el-form-item label="状态">
            <el-select
              style="width: 140px"
              v-model="searchForm.params.status"
              placeholder="全部"
              clearable
            >
              <el-option
                v-for="item in STATUS_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="渠道订单编号">
            <el-input
              v-model="searchForm.params.orderNumber"
              placeholder="请输入渠道订单编号"
              clearable
              style="width: 220px"
            />
          </el-form-item>
          <el-form-item label="孩子姓名">
            <el-input
              v-model="searchForm.params.childName"
              placeholder="请输入孩子姓名"
              clearable
              style="width: 180px"
            />
          </el-form-item>
          <el-form-item label="家长姓名">
            <el-input
              v-model="searchForm.params.parentName"
              placeholder="请输入家长姓名"
              clearable
              style="width: 180px"
            />
          </el-form-item>
          <el-form-item label="家长手机号">
            <el-input
              v-model="searchForm.params.parentPhone"
              placeholder="请输入家长手机号"
              clearable
              style="width: 180px"
            />
          </el-form-item>
          <el-form-item label="合同状态">
            <el-select
              style="width: 140px"
              v-model="searchForm.params.contractStatus"
              placeholder="全部"
              clearable
            >
              <el-option
                v-for="item in CONTRACT_STATUS_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </template>

      <!-- 额外按钮 -->
      <template #extra-buttons>
        <el-button type="primary" @click="openCreateDialog">新增预约</el-button>
        <el-button type="primary" @click="handleExport">导出</el-button>
      </template>

      <!-- 表格列定义 -->
      <el-table-column type="selection" width="55" align="center" />

      <el-table-column
        prop="orderNumber"
        label="渠道订单编号"
        min-width="120"
        align="center"
      />
      <el-table-column
        prop="channelName"
        label="购买渠道"
        min-width="120"
        align="center"
      />

      <el-table-column
        prop="courseName"
        label="课程名称"
        min-width="150"
        align="center"
      />
      <el-table-column
        prop="orderPrice"
        label="课程金额"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ row.orderPrice ? `¥${row.orderPrice}` : '-' }}
        </template>
      </el-table-column>
      <el-table-column
        prop="date"
        label="课程日期"
        min-width="120"
        align="center"
      >
        <template #default="{ row }">
          {{ row.date }}
        </template>
      </el-table-column>
      <el-table-column
        prop="period"
        label="课程时间"
        min-width="120"
        align="center"
      />
      <el-table-column label="孩子姓名" min-width="100" align="center">
        <template #default="{ row }">
          {{ row.studentName || row.childName }}
        </template>
      </el-table-column>
      <el-table-column label="身份证号" min-width="120" align="center">
        <template #default="{ row }">
          {{ row.studentIdentityCard || row.idNumber }}
        </template>
      </el-table-column>
      <el-table-column label="年龄" min-width="80" align="center">
        <template #default="{ row }">
          {{ row.studentAge }}
        </template>
      </el-table-column>
      <el-table-column label="性别" min-width="80" align="center">
        <template #default="{ row }">
          {{ formatGender(row.studentSex || row.gender) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="parentName"
        label="家长姓名"
        min-width="120"
        align="center"
      />
      <el-table-column
        prop="parentPhone"
        label="家长手机号"
        min-width="120"
        align="center"
      />
      <el-table-column label="家长是否同行" min-width="120" align="center">
        <template #default="{ row }">
          {{ formatParentAccompany(row.parentAccompany) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="verificationCode"
        label="核销券码"
        min-width="160"
        align="center"
      >
        <template #default="{ row }">
          <el-image
            v-if="row.verificationCode"
            :src="row.verificationCode"
            preview-teleported
            :preview-src-list="[row.verificationCode]"
            style="
              width: 40px;
              height: 40px;
              margin-right: 4px;
              border-radius: 4px;
            "
            fit="cover"
          />
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="parentRemark"
        label="用户备注"
        min-width="150"
        align="center"
      >
        <template #default="{ row }">
          {{ row.parentRemark || '-' }}
        </template>
      </el-table-column>
      <el-table-column
        prop="businessRemark"
        label="业务备注"
        min-width="150"
        align="center"
      >
        <template #default="{ row }">
          {{ row.businessRemark || '-' }}
        </template>
      </el-table-column>
      <el-table-column
        prop="id"
        label="预约编号"
        min-width="100"
        align="center"
      />
      <el-table-column
        prop="orderId"
        label="订单编号"
        min-width="120"
        align="center"
      />
      <el-table-column
        prop="createdAt"
        label="创建时间"
        min-width="160"
        align="center"
      >
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="updatedAt"
        label="更新时间"
        min-width="160"
        align="center"
      >
        <template #default="{ row }">
          {{ formatDateTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="updatedByName"
        label="最后编辑人"
        min-width="100"
        align="center"
      />

      <el-table-column
        prop="status"
        label="状态"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="contractStatus"
        label="合同状态"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          <el-tag
            v-if="row.contractStatus"
            :type="getContractStatusType(row.contractStatus)"
          >
            {{ getContractStatusLabel(row.contractStatus) }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        align="center"
        min-width="250"
        fixed="right"
      >
        <template #default="{ row }">
          <el-button
            v-if="row.status !== 'completed' && row.status !== 'cancel'"
            type="primary"
            link
            @click="handleEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="row.status === 'success'"
            type="info"
            link
            @click="handleCancel(row)"
          >
            取消预约
          </el-button>
          <el-button
            v-if="
              row.status === 'success' &&
              row.contractStatus === 'pending' &&
              row.isPushContractRequired
            "
            type="success"
            link
            @click="handlePushContract(row)"
          >
            推送合同
          </el-button>
        </template>
      </el-table-column>
    </CommonTable>

    <!-- 预约编辑对话框组件 -->
    <AppointmentEditDialog
      v-model:visible="dialogVisible"
      :title="dialogTitle"
      :form="dialogForm"
      :loading="dialogLoading"
      @submit="handleSubmit"
      @cancel="handleDialogCancel"
    />

    <!-- 手动添加预约对话框组件 -->
    <AppointmentCreateDialog
      v-model:visible="manualDialogVisible"
      :loading="manualDialogLoading"
      @submit="handleManualSubmit"
      @cancel="handleManualDialogCancel"
    />

    <!-- 合同确认对话框 -->
    <ContractConfirmDialog
      v-model:visible="contractDialogVisible"
      :contract-info="contractInfo"
      :loading="contractLoading"
      @confirm="confirmPushContract"
      @cancel="contractDialogVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 课程预约管理页面
 * 实现课程预约的查询、新增、核销、取消功能
 */

// 导入所需的组件和工具
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import AppointmentEditDialog from './components/AppointmentEditDialog.vue'
import ContractConfirmDialog from './components/ContractConfirmDialog.vue'
import { type ContractInfo } from './components/ContractConfirmDialog.vue'
import AppointmentCreateDialog from './components/AppointmentCreateDialog.vue'
import {
  queryCourseAppointmentList,
  getCourseSelector,
  updateCourseAppointmentStatus,
  createCourseAppointment,
  updateCourseAppointment,
  exportCourseAppointment,
  getContractFieldInfo,
  pushContract,
  queryAsyncTaskResult,
} from './service'
import {
  CourseAppointmentItem,
  STATUS_OPTIONS,
  getStatusType,
  getStatusLabel,
  CONTRACT_STATUS_OPTIONS,
  getContractStatusType,
  getContractStatusLabel,
} from './service.type'
import dayjs from 'dayjs'

// 页面状态管理
const loading = ref(false) // 加载状态
const dialogLoading = ref(false) // 对话框加载状态
const courseLoading = ref(false) // 课程下拉选项加载状态
const tableRef = ref<InstanceType<typeof CommonTable> | null>(null) // 表格实例引用
const dialogVisible = ref(false) // 对话框显示状态
const dialogTitle = ref('新增预约') // 对话框标题
const selectedRows = ref<CourseAppointmentItem[]>([]) // 已选择的行

// 课程选项
const courseOptions = ref<{ label: string; value: string }[]>([])

// 日期快捷选项
const dateShortcuts = [
  {
    text: '最近一周',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7)
      return [start, end]
    },
  },
  {
    text: '最近一个月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 30)
      return [start, end]
    },
  },
  {
    text: '最近三个月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 90)
      return [start, end]
    },
  },
]

/**
 * 查询参数接口定义
 * @interface SearchParams
 */
interface SearchParams {
  courseId: string
  courseDateRange: [string, string] | null
  status: string | undefined
  contractStatus: string | undefined
  childName: string
  parentName: string
  parentPhone: string
  orderNumber: string
}

/**
 * 查询表单接口定义
 * @interface SearchForm
 * @property {number} page - 当前页码
 * @property {number} pageSize - 每页条数
 * @property {SearchParams} params - 查询参数
 */
interface SearchForm {
  page: number
  pageSize: number
  params: SearchParams
}

/**
 * 查询表单数据
 * 包含分页信息和查询条件
 */
const searchForm = reactive<SearchForm>({
  page: 1,
  pageSize: 10,
  params: {
    courseId: '',
    courseDateRange: null,
    status: undefined,
    contractStatus: undefined,
    childName: '',
    parentName: '',
    parentPhone: '',
    orderNumber: '',
  },
})

const defaultSearchForm = reactive<SearchForm>({
  page: 1,
  pageSize: 10,
  params: {
    courseId: '',
    courseDateRange: null,
    status: undefined,
    contractStatus: undefined,
    childName: '',
    parentName: '',
    parentPhone: '',
    orderNumber: '',
  },
})

/**
 * 表单数据
 */
const dialogForm = reactive({
  id: '',
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
  verificationCode: '',
  isCreate: true,
  isEditMode: false,
  courseName: '',
  businessRemark: '', // 新增业务备注字段
})

// 合同对话框状态
const contractDialogVisible = ref(false)
const contractLoading = ref(false)
const contractInfo = reactive<ContractInfo>({
  courseAppointmentId: '',
  parentName: '',
  parentPhone: '',
  childName: '',
  childId: '',
  activityStartDate: '',
  activityEndDate: '',
  cost: '',
  costCapital: '',
  payEndDate: '',
})

// 手动添加预约对话框
const manualDialogVisible = ref(false)
const manualDialogLoading = ref(false)

/**
 * 获取课程预约列表数据
 * @param params 查询参数
 * @returns 返回列表数据和总数
 */
const getList = async (params: SearchForm) => {
  try {
    loading.value = true

    // 转换查询参数为新的API格式
    const queryParams = {
      page: params.page,
      pageSize: params.pageSize,
      courseId: params.params.courseId || undefined,
      startDate: params.params.courseDateRange?.[0] || undefined,
      endDate: params.params.courseDateRange?.[1] || undefined,
      studentName: params.params.childName || undefined,
      parentName: params.params.parentName || undefined,
      parentPhone: params.params.parentPhone || undefined,
      orderNumber: params.params.orderNumber || undefined,
      status: params.params.status || undefined,
      contractStatus: params.params.contractStatus || undefined,
    }

    // 移除所有undefined值，避免发送不必要的参数
    const cleanParams = Object.entries(queryParams)
      .filter(([_, value]) => value !== undefined)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})

    // 使用新的API查询方法
    const res = await queryCourseAppointmentList(cleanParams)
    if (!res) {
      return {
        list: [],
        total: 0,
      }
    }
    return {
      list: res.list || [],
      total: res.total || 0,
    }
  } catch (error) {
    console.error('获取课程预约列表失败:', error)
    return {
      list: [],
      total: 0,
    }
  } finally {
    loading.value = false
  }
}

/**
 * 重置表单
 */
const resetForm = () => {
  // 只需要重置dialogForm中的属性
  Object.assign(dialogForm, {
    id: '',
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
    verificationCode: '',
    isCreate: true,
    isEditMode: false,
    courseName: '',
    businessRemark: '', // 重置业务备注字段
  })
}

/**
 * 打开创建预约对话框
 */
const openCreateDialog = () => {
  // 打开手动添加预约对话框
  openManualDialog()
}

/**
 * 处理对话框取消
 */
const handleDialogCancel = () => {
  dialogVisible.value = false
  // 重置表单
  resetForm()
}

/**
 * 处理对话框提交
 * @param formData 表单数据
 * @param valid 表单是否有效
 */
const handleSubmit = async (formData: any, valid: boolean) => {
  if (!valid) return

  try {
    dialogLoading.value = true

    // 构建符合新API格式的参数
    const apiParams: any = {
      id: formData.id,
      date: formData.date || formData.courseDate,
      period: formData.period || formData.coursePeriod,
      studentName: formData.studentName || formData.childName,
      studentIdentityCard: formData.studentIdentityCard || formData.idNumber,
      studentAge: formData.studentAge,
      studentSex: formData.studentSex || formData.gender,
      parentName: formData.parentName,
      parentPhone: formData.parentPhone,
      parentAccompany: formData.parentAccompany,
      verificationCode: formData.verificationCode,
      businessRemark: formData.businessRemark, // 添加业务备注字段
    }

    // 对于新建和编辑都使用updateCourseAppointment接口
    await updateCourseAppointment(apiParams)

    ElMessage.success(formData.isCreate ? '创建预约成功' : '更新预约成功')
    dialogVisible.value = false
    // 重置表单
    resetForm()
    tableRef.value?.refresh()
  } catch (error) {
    console.error(formData.isCreate ? '创建预约失败:' : '更新预约失败:', error)
    ElMessage.error(
      formData.isCreate
        ? '创建预约失败，请稍后重试'
        : '更新预约失败，请稍后重试',
    )
  } finally {
    dialogLoading.value = false
  }
}

/**
 * 处理表格选择行变化
 * @param rows 选中的行
 */
const handleSelectionChange = (rows: CourseAppointmentItem[]) => {
  selectedRows.value = rows
}

/**
 * 处理编辑预约
 * @param row 行数据
 */
const handleEdit = async (row: CourseAppointmentItem) => {
  try {
    dialogTitle.value = '编辑预约'
    dialogLoading.value = true

    // 先重置表单，确保没有残留数据
    resetForm()

    // 显式设置为编辑模式
    dialogForm.isEditMode = true

    // 填充表单数据
    Object.assign(dialogForm, {
      id: row.id,
      courseId: row.courseId || '',
      courseDate: row.date,
      coursePeriod: row.period,
      childName: row.studentName || row.childName,
      idNumber: row.studentIdentityCard || row.idNumber,
      gender: convertGender(row.studentSex || row.gender),
      studentAge: row.studentAge,
      parentName: row.parentName,
      parentPhone: row.parentPhone,
      parentAccompany: convertParentAccompany(row.parentAccompany),
      isCreate: false,
      isEditMode: true,
      courseName: row.courseName || '',
      verificationCode: row.verificationCode || '',
      businessRemark: row.businessRemark || '', // 填充业务备注字段
    })

    console.log('编辑预约，设置isEditMode为true:', dialogForm.isEditMode)
    console.log('编辑预约，设置verificationCode:', dialogForm.verificationCode)

    setTimeout(() => {
      // 显示对话框
      dialogVisible.value = true
    }, 100)
  } catch (error) {
    console.error('获取预约详情失败:', error)
    ElMessage.error('获取预约详情失败，请稍后重试')
  } finally {
    dialogLoading.value = false
  }
}

/**
 * 转换性别为M/F格式
 * @param value 原始性别值
 * @returns 转换后的值: M/F
 */
const convertGender = (value: any): string => {
  if (value === '男' || value === 'M' || value === 'm') {
    return 'M'
  } else if (value === '女' || value === 'F' || value === 'f') {
    return 'F'
  } else {
    return 'M' // 默认为男性
  }
}

/**
 * 格式化性别显示
 * @param value 性别值
 * @returns 格式化后的文本
 */
const formatGender = (value: any): string => {
  if (value === 'M' || value === 'm' || value === '男') {
    return '男'
  } else if (value === 'F' || value === 'f' || value === '女') {
    return '女'
  } else {
    return '未知'
  }
}

/**
 * 转换parentAccompany为新格式
 * @param value 原始值
 * @returns 转换后的值: yes/no/unknown
 */
const convertParentAccompany = (value: any): string => {
  if (value === true || value === 'true' || value === 'yes') {
    return 'yes'
  } else if (value === false || value === 'false' || value === 'no') {
    return 'no'
  } else {
    return 'unknown'
  }
}

/**
 * 处理单个预约取消
 * @param row 行数据
 */
const handleCancel = async (row: CourseAppointmentItem) => {
  try {
    await ElMessageBox.confirm('确定要取消该预约吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    // 使用新的取消预约接口
    await updateCourseAppointmentStatus({
      ids: [row.id],
      status: 'cancel',
    })

    ElMessage.success('取消预约成功')
    tableRef.value?.refresh()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('取消预约失败:', error)
      ElMessage.error('取消预约失败，请稍后重试')
    }
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
 * 格式化日期时间
 * @param dateTimeString 日期时间字符串
 * @returns 格式化后的日期时间字符串
 */
const formatDateTime = (dateTimeString: string) => {
  if (!dateTimeString) return '--'
  return dayjs(dateTimeString).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * 处理课程选择变化
 * @param value 选择的课程ID
 */
const handleCourseChange = async (value: string) => {
  // 课程选择变化不再需要处理任何逻辑
}

/**
 * 格式化家长陪同状态
 * @param value 陪同状态值
 * @returns 格式化后的文本
 */
const formatParentAccompany = (value: any): string => {
  if (value === 'yes' || value === true || value === 'true') {
    return '是'
  } else if (value === 'no' || value === false || value === 'false') {
    return '否'
  } else {
    return '未知'
  }
}

/**
 * 处理推送合同
 * @param row 行数据
 */
const handlePushContract = async (row: CourseAppointmentItem) => {
  try {
    contractLoading.value = true

    // 调用API获取合同字段信息
    const res = await getContractFieldInfo({ id: row.id })
    if (!res) {
      throw new Error('获取合同信息失败')
    }

    // 填充合同信息
    contractInfo.courseAppointmentId = row.id
    contractInfo.parentName = res.parentName || ''
    contractInfo.parentPhone = res.parentPhone || ''
    contractInfo.childName = res.childName || ''
    contractInfo.childId = res.childId || ''
    contractInfo.activityStartDate = res.activityStartDate || ''
    contractInfo.activityEndDate = res.activityEndDate || ''
    contractInfo.cost = res.cost || ''
    contractInfo.costCapital = res.costCapital || ''
    contractInfo.payEndDate = res.payEndDate || ''

    // 显示合同确认对话框
    contractDialogVisible.value = true
  } catch (error) {
    console.error('获取合同信息失败:', error)
    ElMessage.error('获取合同信息失败，请稍后重试')
  } finally {
    contractLoading.value = false
  }
}

/**
 * 确认推送合同
 */
const confirmPushContract = async () => {
  try {
    contractLoading.value = true

    // 调用API推送合同，使用新的接口
    const response = await pushContract({
      courseAppointmentId: contractInfo.courseAppointmentId,
      parentName: contractInfo.parentName,
      parentPhone: contractInfo.parentPhone,
      childName: contractInfo.childName,
      childId: contractInfo.childId,
      activityStartDate: contractInfo.activityStartDate,
      activityEndDate: contractInfo.activityEndDate,
      cost: contractInfo.cost,
      costCapital: contractInfo.costCapital,
      payEndDate: contractInfo.payEndDate,
    })

    if (!response || !response.asyncTaskId) {
      throw new Error('获取异步任务ID失败')
    }

    // 获取异步任务ID
    const asyncTaskId = response.asyncTaskId

    // 轮询查询异步任务结果
    let retryCount = 0
    const maxRetries = 10
    const pollTaskResult = async () => {
      if (retryCount >= maxRetries) {
        throw new Error('任务执行超时，请稍后查看结果')
      }

      retryCount++
      const taskResult = await queryAsyncTaskResult(asyncTaskId)

      // 根据状态判断
      // 状态：0-待处理 1-执行中 2-成功 3-失败
      if (taskResult.status === 2) {
        // 成功
        // 关闭对话框
        contractDialogVisible.value = false
        // 提示成功
        ElMessage.success('合同推送成功')
        // 刷新表格
        tableRef.value?.refresh()
        return
      } else if (taskResult.status === 3) {
        // 失败
        throw new Error(taskResult.errorInfo || '合同推送失败')
      } else {
        // 待处理或执行中，继续轮询
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return pollTaskResult()
      }
    }

    // 开始轮询
    await pollTaskResult()
  } catch (error) {
    console.error('推送合同失败:', error)
    ElMessage.error(
      error instanceof Error ? error.message : '推送合同失败，请稍后重试',
    )
  } finally {
    contractLoading.value = false
  }
}

/**
 * 处理导出
 */
const handleExport = async () => {
  let loadingMessage: any = null
  try {
    loadingMessage = ElMessage({
      message: '正在导出，请稍候...',
      duration: 0,
    })

    // 转换查询参数
    const queryParams = {
      courseId: searchForm.params.courseId,
      startDate: searchForm.params.courseDateRange?.[0],
      endDate: searchForm.params.courseDateRange?.[1],
      status: searchForm.params.status,
      contractStatus: searchForm.params.contractStatus,
      studentName: searchForm.params.childName,
      parentName: searchForm.params.parentName,
      parentPhone: searchForm.params.parentPhone,
    }

    // 调用导出API获取下载URL
    let times = 0
    const getDownloadUrl = async () => {
      const res = await exportCourseAppointment(queryParams)
      if (res && res.downloadUrl) {
        // 创建一个链接元素并模拟点击下载
        const link = document.createElement('a')
        link.href = res.downloadUrl
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        loadingMessage.close()
        ElMessage.success('导出成功')
      } else {
        // 休眠一秒后继续轮训
        await new Promise((resolve) => setTimeout(resolve, 1000))
        times++
        if (times > 30) {
          loadingMessage.close()
          ElMessage.error('导出失败：未获取到下载链接')
          return
        }
        getDownloadUrl()
      }
    }
    getDownloadUrl()
  } catch (error) {
    console.error('导出失败:', error)
    loadingMessage.close()
    ElMessage.error('导出失败，请稍后重试')
  }
}

/**
 * 打开手动添加预约对话框
 */
const openManualDialog = () => {
  manualDialogVisible.value = true
}

/**
 * 处理手动添加对话框取消
 */
const handleManualDialogCancel = () => {
  manualDialogVisible.value = false
}

/**
 * 处理手动添加对话框提交
 * @param formData 手动添加表单数据
 */
const handleManualSubmit = async (formData: any) => {
  try {
    manualDialogLoading.value = true

    // 构建预约参数（formData已经包含了所有必要的字段，包括businessRemark）
    const apiParams = {
      ...formData,
      businessRemark: formData.businessRemark || '', // 确保业务备注字段被包含
    }

    // 创建预约
    await createCourseAppointment(apiParams)

    ElMessage.success('创建预约成功')
    manualDialogVisible.value = false
    tableRef.value?.refresh()
  } catch (error) {
    console.error('创建预约失败:', error)
    ElMessage.error('创建预约失败，请稍后重试')
  } finally {
    manualDialogLoading.value = false
  }
}

/**
 * 加载课程选项
 */
const loadCourseOptions = async (courseId?: string) => {
  try {
    courseLoading.value = true

    // 获取所有课程
    const res = await getCourseSelector(courseId)
    if (res && res.list) {
      courseOptions.value = res.list.map((item) => ({
        label: item.courseName,
        value: item.id,
      }))
    }
  } catch (error) {
    console.error('获取课程下拉选项失败:', error)
  } finally {
    courseLoading.value = false
  }
}

onMounted(() => {
  loadCourseOptions()
})
</script>

<style scoped>
.course-appointment-container {
  padding: 0;
}
</style>
