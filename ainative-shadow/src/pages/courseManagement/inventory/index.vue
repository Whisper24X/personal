<template>
  <div class="course-inventory-container">
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
      <!-- Header插槽 - Tab切换 -->
      <template #header>
        <div class="tab-container">
          <el-tabs v-model="activeTab" @tab-change="handleTabChange">
            <el-tab-pane label="单日营" name="single"></el-tab-pane>
            <el-tab-pane label="多日营" name="multi"></el-tab-pane>
          </el-tabs>
        </div>
      </template>
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
        </el-form>
      </template>

      <!-- 额外按钮 -->
      <template #extra-buttons>
        <el-button type="primary" @click="openCreateDialog">新增</el-button>
        <!-- <el-button
          type="danger"
          @click="handleBatchDelete"
          :disabled="!selectedRows.length"
          >删除</el-button
        > -->
        <el-button
          type="success"
          @click="handleBatchEnable"
          :disabled="!selectedRows.length"
          >批量上架</el-button
        >
        <el-button
          type="warning"
          @click="handleBatchDisable"
          :disabled="!selectedRows.length"
          >批量下架</el-button
        >
      </template>

      <!-- 表格列定义 -->
      <el-table-column type="selection" width="55" align="center" />

      <el-table-column
        type="index"
        label="库存编号"
        min-width="100"
        align="center"
      />
      <el-table-column
        prop="courseName"
        label="课程名称"
        min-width="150"
        align="center"
      />
      <el-table-column
        v-if="activeTab === 'single'"
        prop="period"
        label="课程时间"
        min-width="120"
        align="center"
      />
      <el-table-column
        prop="date"
        label="课程日期"
        min-width="150"
        align="center"
      >
        <template #default="{ row }">
          {{ activeTab === 'multi' ? row.date : formatDate(row.date) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="stock"
        label="最大库存"
        min-width="100"
        align="center"
      />
      <el-table-column
        prop="stockRemain"
        label="剩余库存"
        min-width="100"
        align="center"
      />
      <el-table-column
        prop="stockSuccess"
        label="预约人数"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ row.stockSuccess || 0 }}
        </template>
      </el-table-column>
      <el-table-column
        prop="groupQrCode"
        label="群聊二维码"
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <ImagePreview
            v-if="row.groupQrCode"
            :model-value="row.groupQrCode"
            :width="60"
            :height="60"
            fit="cover"
            @preview="handleQrCodePreview"
          />
          <span v-else class="no-qr-text">暂无二维码</span>
        </template>
      </el-table-column>
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
        label="操作"
        align="center"
        min-width="250"
        fixed="right"
      >
        <template #default="{ row }">
          <el-button type="primary" link @click="openEditDialog(row)">
            修改库存
          </el-button>
          <el-button type="warning" link @click="openUploadQrCodeDialog(row)">
            上传群聊
          </el-button>
          <el-button
            v-if="row.status === 'putOff'"
            type="success"
            link
            @click="handleEnable(row)"
          >
            上架
          </el-button>
          <el-button
            v-if="row.status === 'putOn'"
            type="info"
            link
            @click="handleDisable(row)"
          >
            下架
          </el-button>
        </template>
      </el-table-column>
    </CommonTable>

    <!-- 使用抽离出的库存编辑对话框组件 -->
    <CourseStockEditDialog
      v-model:visible="dialogVisible"
      :title="dialogTitle"
      :form="dialogForm"
      :loading="dialogLoading"
      :course-options="courseOptions"
      :course-loading="courseLoading"
      @submit="handleSubmit"
      @cancel="handleDialogCancel"
    />

    <!-- 上传群聊二维码对话框 -->
    <el-dialog
      v-model="uploadQrCodeDialogVisible"
      title="上传群聊二维码"
      width="500px"
      @close="handleUploadQrCodeCancel"
    >
      <el-form :model="uploadQrCodeForm" label-width="120px">
        <el-form-item label="群聊二维码">
          <FileUpload
            v-model="uploadQrCodeForm.groupQrCode"
            :limit="1"
            accept=".jpg,.png,.jpeg"
            file-path="course/qrcode"
            tip-message="支持上传jpg、png、jpeg格式的图片"
            list-type="picture-card"
            placeholder="点击上传二维码"
            hideButtonWhenReachedLimit
            @file-uploaded="handleQrCodeFileUploaded"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleUploadQrCodeCancel">取消</el-button>
        <el-button
          type="primary"
          @click="handleUploadQrCodeSubmit"
          :loading="uploadQrCodeLoading"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 课程库存管理页面
 * 实现课程库存的查询、更新功能
 */

// 导入所需的组件和工具
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import CourseStockEditDialog from './components/CourseStockEditDialog.vue'
import FileUpload from '@/components/FileUpload/index.vue'
import ImagePreview from '@/components/ImagePreview/index.vue'
import {
  queryCourseInventoryList,
  updateCourseInventory,
  getCourseSelector,
  createCourseStock,
  updateCourseStockStatus,
  deleteCourseStock,
  getDetailCourseStock,
  getCourseStockSelector,
  updateCourseStockGroupQrCode,
} from './service'
import {
  CourseInventoryItem,
  CourseInventoryQueryParams,
  STATUS_OPTIONS,
} from './service.type'
import dayjs from 'dayjs'
import { de } from 'element-plus/es/locales.mjs'

// 页面状态管理
const loading = ref(false) // 加载状态
const dialogLoading = ref(false) // 对话框加载状态
const courseLoading = ref(false) // 课程下拉选项加载状态
const tableRef = ref<InstanceType<typeof CommonTable> | null>(null) // 表格实例引用
const dialogVisible = ref(false) // 对话框显示状态
const dialogTitle = ref('更新库存') // 对话框标题
const selectedRows = ref<CourseInventoryItem[]>([]) // 已选择的行
const activeTab = ref('single') // 当前激活的tab，默认为单日营

// 上传群聊二维码对话框状态
const uploadQrCodeDialogVisible = ref(false) // 上传二维码对话框显示状态
const uploadQrCodeLoading = ref(false) // 上传加载状态
const uploadQrCodeForm = reactive({
  id: '',
  groupQrCode: '' as string | any, // 支持文件对象或字符串
})

// 课程选项
const courseOptions = ref<
  { label: string; value: string; courseType: 'single' | 'multi' }[]
>([])

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
 * @property {string} courseId - 课程ID查询条件
 * @property {[string, string]} courseDateRange - 课程日期范围
 * @property {string} courseType - 课程类型查询条件
 * @property {string} status - 库存状态查询条件
 */
interface SearchParams {
  courseId: string
  courseDateRange: [string, string] | null
  courseType: string | undefined
  status: string | undefined
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
    courseDateRange: [
      dayjs().format('YYYY-MM-DD'),
      dayjs().add(90, 'day').format('YYYY-MM-DD'),
    ],
    courseType: 'single', // 默认显示单日营
    status: 'putOn',
  },
})

const defaultSearchForm = reactive<SearchForm>({
  page: 1,
  pageSize: 10,
  params: {
    courseId: '',
    courseDateRange: null,
    courseType: undefined,
    status: undefined,
  },
})

/**
 * 表单数据
 */
const dialogForm = reactive({
  id: '',
  courseId: '',
  courseName: '',
  dates: [] as string[],
  period: '',
  periods: [] as Array<{ startTime: string; endTime: string }>,
  currentInventory: 0,
  reservedCount: 0,
  totalInventory: 0,
  status: 'putOn',
  isCreate: true,
})

/**
 * 获取课程库存列表数据
 * @param params 查询参数
 * @returns 返回列表数据和总数
 */
const getList = async (params: SearchForm) => {
  try {
    loading.value = true
    // 创建一个简单结构的查询参数对象
    const queryParams: CourseInventoryQueryParams = {
      courseId: params.params.courseId,
      courseDateRange: params.params.courseDateRange,
      courseType: params.params.courseType,
      status: params.params.status,
      page: params.page,
      pageSize: params.pageSize,
    }
    const res = await queryCourseInventoryList(queryParams)
    return {
      list: res.list,
      total: res.total,
    }
  } catch (error) {
    console.error('获取课程库存列表失败:', error)
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
    courseName: '',
    dates: [],
    period: '',
    periods: [],
    currentInventory: 0,
    reservedCount: 0,
    totalInventory: 0,
    status: 'putOn',
    isCreate: true,
  })
}

/**
 * 加载课程选项
 */
const loadCourseOptions = async () => {
  try {
    courseLoading.value = true
    const res = await getCourseSelector()
    if (res && res.list) {
      // 根据当前选中的tab过滤课程选项
      const filteredList = res.list.filter(
        (item) => item.courseType === activeTab.value,
      )
      courseOptions.value = filteredList.map((item) => ({
        label: item.courseName,
        value: item.id,
        courseType: item.courseType,
      }))
    }
  } catch (error) {
    console.error('获取课程下拉选项失败:', error)
  } finally {
    courseLoading.value = false
  }
}

/**
 * 打开创建课程库存对话框
 */
const openCreateDialog = () => {
  dialogTitle.value = '创建课程库存'
  // 重置表单
  resetForm()
  // 显示对话框
  dialogVisible.value = true
  // 加载课程选项
  loadCourseOptions()
}

/**
 * 打开编辑课程库存对话框
 * @param record 库存记录
 */
const openEditDialog = async (record: CourseInventoryItem) => {
  dialogLoading.value = true
  // 设置标题
  dialogTitle.value = '修改课程库存'
  // 获取详情
  const res = await getDetailCourseStock(record.id)
  // 设置表单数据
  Object.assign(dialogForm, {
    id: record.id,
    courseId: res.courseId,
    courseName: res.courseName,
    dates: [record.date],
    period: record.period,
    periods: [record.period],
    currentInventory: res.stock,
    reservedCount: 0,
    totalInventory: res.stock,
    status: res.status,
    isCreate: false,
  })
  // 显示对话框
  dialogVisible.value = true

  dialogLoading.value = false
}

/**
 * 处理对话框取消
 */
const handleDialogCancel = () => {
  dialogVisible.value = false
}

/**
 * 处理对话框提交
 * @param formData 表单数据
 * @param valid 表单是否有效
 */
const handleSubmit = async (formData: typeof dialogForm, valid: boolean) => {
  if (!valid) return

  try {
    dialogLoading.value = true

    if (formData.isCreate) {
      // 创建库存
      // 获取选择的课程类型
      const selectedCourse = courseOptions.value.find(
        (c) => c.value === formData.courseId,
      )
      const courseType = selectedCourse?.courseType || 'single'

      // 准备请求参数
      const requestParams: any = {
        courseId: formData.courseId,
        dates: formData.dates,
        totalInventory: formData.totalInventory,
        courseType,
      }

      // 只有单日营才传递periods字段
      if (courseType === 'single') {
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

        requestParams.periods = periodsFormatted
      }

      await createCourseStock(requestParams)

      ElMessage.success('创建库存成功')
      dialogVisible.value = false
      tableRef.value?.refresh()
    } else {
      // 更新库存
      const updateRes = await updateCourseInventory({
        id: formData.id,
        stock: formData.totalInventory,
      })

      if (updateRes) {
        ElMessage.success('更新库存成功')
        dialogVisible.value = false
        tableRef.value?.refresh()
      } else {
        ElMessage.error('更新库存失败')
      }
    }
  } catch (error) {
    console.error(error)
  } finally {
    dialogLoading.value = false
  }
}

/**
 * 获取库存状态标签类型
 * @param status 库存状态
 * @returns 返回标签类型
 */
const getStatusType = (status: string) => {
  switch (status) {
    case 'putOn':
      return 'success'
    case 'putOff':
      return 'info'
    default:
      return 'info'
  }
}

/**
 * 获取库存状态标签文本
 * @param status 库存状态
 * @returns 返回标签文本
 */
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'putOn':
      return '已上架'
    case 'putOff':
      return '已下架'
    default:
      return '未知'
  }
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
 * 获取课程下拉选项
 */
const fetchCourseOptions = async () => {
  try {
    courseLoading.value = true
    const res = await getCourseSelector()
    if (res && res.list) {
      // 根据当前选中的tab过滤课程选项
      const filteredList = res.list.filter(
        (item) => item.courseType === activeTab.value,
      )
      courseOptions.value = filteredList.map((item) => ({
        label: item.courseName,
        value: item.id,
        courseType: item.courseType,
      }))
    }
  } catch (error) {
    console.error('获取课程下拉选项失败:', error)
  } finally {
    courseLoading.value = false
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
 * 格式化多日营日期范围
 * @param row 行数据
 * @returns 格式化后的日期范围字符串
 */
const formatDateRange = (row: CourseInventoryItem) => {
  // 这里需要根据实际的多日营数据结构来实现
  // 假设多日营的date字段包含开始和结束日期，或者有其他字段
  if (!row.date) return '--'

  // 如果是单个日期，直接返回
  if (typeof row.date === 'string') {
    return formatDate(row.date)
  }

  // 如果有日期范围信息，格式化为范围显示
  // 这里需要根据实际API返回的数据结构调整
  return formatDate(row.date)
}

/**
 * 处理批量删除
 */
const handleBatchDelete = () => {
  if (!selectedRows.value.length) {
    ElMessage.warning('请至少选择一条记录')
    return
  }

  ElMessageBox.confirm(
    '确定要删除选中的库存记录吗？此操作不可恢复！',
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    },
  ).then(async () => {
    try {
      loading.value = true
      const ids = selectedRows.value.map((row) => row.id)

      const res = await deleteCourseStock({
        ids,
      })

      ElMessage.success('删除成功')
      tableRef.value?.refresh()
      selectedRows.value = []
    } catch (error) {
      console.error('删除库存失败:', error)
    } finally {
      loading.value = false
    }
  })
}

/**
 * 处理批量上架
 */
const handleBatchEnable = async () => {
  if (!selectedRows.value.length) {
    ElMessage.warning('请至少选择一条记录')
    return
  }

  try {
    loading.value = true
    const ids = selectedRows.value.map((row) => row.id)

    const res = await updateCourseStockStatus({
      ids,
      status: 'putOn', // 上架
    })

    ElMessage.success('批量上架成功')
    tableRef.value?.refresh()
    selectedRows.value = []
  } catch (error) {
    console.error('批量上架失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 处理批量下架
 */
const handleBatchDisable = async () => {
  if (!selectedRows.value.length) {
    ElMessage.warning('请至少选择一条记录')
    return
  }

  try {
    loading.value = true
    const ids = selectedRows.value.map((row) => row.id)

    const res = await updateCourseStockStatus({
      ids,
      status: 'putOff', // 下架
    })

    ElMessage.success('批量下架成功')
    tableRef.value?.refresh()
    selectedRows.value = []
  } catch (error) {
    console.error('批量下架失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 处理单个上架
 */
const handleEnable = async (row: CourseInventoryItem) => {
  try {
    loading.value = true

    const res = await updateCourseStockStatus({
      ids: [row.id],
      status: 'putOn', // 上架
    })

    ElMessage.success('上架成功')
    tableRef.value?.refresh()
  } catch (error) {
    console.error('上架失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 处理单个下架
 */
const handleDisable = async (row: CourseInventoryItem) => {
  try {
    loading.value = true

    const res = await updateCourseStockStatus({
      ids: [row.id],
      status: 'putOff', // 下架
    })

    ElMessage.success('下架成功')
    tableRef.value?.refresh()
  } catch (error) {
    console.error('下架失败:', error)
  } finally {
    loading.value = false
  }
}

// 表格选择变化事件处理
const handleSelectionChange = (selection: CourseInventoryItem[]) => {
  selectedRows.value = selection
}

/**
 * 打开上传群聊二维码对话框
 * @param record 库存记录
 */
const openUploadQrCodeDialog = (record: CourseInventoryItem) => {
  uploadQrCodeForm.id = record.id
  uploadQrCodeForm.groupQrCode = record.groupQrCode || ''
  uploadQrCodeDialogVisible.value = true
}

/**
 * 处理二维码文件上传完成
 * @param file 上传的文件对象
 */
const handleQrCodeFileUploaded = (file: any) => {
  uploadQrCodeForm.groupQrCode = file.url
}

/**
 * 处理上传群聊二维码提交
 */
const handleUploadQrCodeSubmit = async () => {
  let qrCodeUrl = ''

  // 如果是文件对象，取url
  if (
    typeof uploadQrCodeForm.groupQrCode === 'object' &&
    uploadQrCodeForm.groupQrCode?.url
  ) {
    qrCodeUrl = uploadQrCodeForm.groupQrCode.url
  } else if (typeof uploadQrCodeForm.groupQrCode === 'string') {
    qrCodeUrl = uploadQrCodeForm.groupQrCode
  }

  if (!qrCodeUrl.trim()) {
    ElMessage.warning('请上传群聊二维码')
    return
  }

  try {
    uploadQrCodeLoading.value = true
    await updateCourseStockGroupQrCode({
      id: uploadQrCodeForm.id,
      groupQrCode: qrCodeUrl,
    })

    ElMessage.success('上传群聊二维码成功')
    uploadQrCodeDialogVisible.value = false
    tableRef.value?.refresh()
  } catch (error) {
    console.error('上传群聊二维码失败:', error)
    ElMessage.error('上传群聊二维码失败')
  } finally {
    uploadQrCodeLoading.value = false
  }
}

/**
 * 处理上传二维码对话框取消
 */
const handleUploadQrCodeCancel = () => {
  uploadQrCodeDialogVisible.value = false
  uploadQrCodeForm.id = ''
  uploadQrCodeForm.groupQrCode = ''
}

/**
 * 处理二维码预览
 * @param url 图片URL
 */
const handleQrCodePreview = (url: string) => {
  console.log('预览二维码:', url)
}

/**
 * 处理tab切换
 * @param tabName 切换到的tab名称
 */
const handleTabChange = (tabName: string) => {
  activeTab.value = tabName
  // 更新搜索条件中的课程类型
  searchForm.params.courseType = tabName
  // 重置课程选择
  searchForm.params.courseId = ''
  // 刷新表格数据
  tableRef.value?.refresh()
  // 重新加载对应类型的课程选项
  loadCourseOptions()
}

/**
 * 页面初始化
 */
onMounted(() => {
  fetchCourseOptions()
})
</script>

<style scoped>
.course-inventory-container {
  padding: 16px;
}

.tab-container {
  margin-bottom: 0;
}

.tab-container :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.tab-container :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}

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

.add-period-btn-container {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 10px;
  margin-left: 275px;
  /* 对齐时间选择器下方 */
}

.add-first-period {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
}

.no-qr-text {
  color: #999;
  font-size: 12px;
}
</style>
