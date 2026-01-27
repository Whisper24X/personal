<template>
  <div class="contract-record-container">
    <div class="table-wrapper">
      <CommonTable
        ref="tableRef"
        v-loading="loading"
        :fetch-data="getList"
        :search-form="searchForm"
        :show-search="true"
        :show-extra-buttons="true"
        @search="handleQuery"
        :resetSearchForm="resetQuery"
      >
        <!-- 搜索条件 -->
        <template #search-items>
          <el-form :inline="true" :model="searchForm.params">
            <el-form-item label="学生姓名">
              <el-input
                v-model="searchForm.params.childName"
                placeholder="请输入学生姓名"
                clearable
              />
            </el-form-item>
            <el-form-item label="家长手机号">
              <el-input
                v-model="searchForm.params.parentPhone"
                placeholder="请输入家长手机号"
                clearable
              />
            </el-form-item>
            <el-form-item label="研学主题">
              <el-select
                style="width: 140px"
                v-model="searchForm.params.topic"
                placeholder="请选择研学主题"
                clearable
              >
                <el-option
                  v-for="item in topicList"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="合同状态">
              <el-select
                style="width: 140px"
                v-model="searchForm.params.status"
                placeholder="请选择状态"
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
            <el-form-item label="营期类别">
              <el-select
                style="width: 140px"
                v-model="searchForm.params.contractType"
                placeholder="请选择营期类别"
                clearable
              >
                <el-option
                  v-for="item in CAMP_PERIOD_OPTIONS"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="活动开始日期">
              <el-date-picker
                v-model="searchForm.params.activityStartDate"
                type="date"
                placeholder="选择活动开始日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                clearable
              />
            </el-form-item>
          </el-form>
        </template>

        <!-- 额外按钮 -->
        <template #extra-buttons>
          <el-button @click="handleExport">导出Excel</el-button>
          <el-button type="primary" @click="handleImport">导入</el-button>
        </template>

        <!-- 表格列定义 -->
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column
          prop="contractType"
          label="营期类别"
          min-width="120"
          align="center"
        >
          <template #default="{ row }">
            {{ row.contractType === 1 ? '单日营' : '多日营' }}
          </template>
        </el-table-column>
        <el-table-column
          prop="childName"
          label="学生姓名"
          min-width="100"
          align="center"
        />
        <el-table-column
          prop="parentPhone"
          label="家长手机号"
          min-width="120"
          align="center"
        />
        <el-table-column
          prop="topic"
          label="研学主题"
          min-width="150"
          align="center"
        />
        <el-table-column
          prop="activityStartDate"
          label="活动开始日期"
          min-width="120"
          align="center"
        >
          <template #default="{ row }">
            {{ formatDate(row.activityStartDate) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="activityEndDate"
          label="活动结束日期"
          min-width="120"
          align="center"
        >
          <template #default="{ row }">
            {{ formatDate(row.activityEndDate) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="cost"
          label="费用"
          min-width="100"
          align="center"
        />
        <el-table-column
          prop="contractStatus"
          label="合同状态"
          min-width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.contractStatus)">
              {{ getStatusLabel(row.contractStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="contractLink"
          label="合同链接"
          min-width="150"
          align="center"
        />
        <el-table-column
          prop="createdAt"
          label="创建时间"
          min-width="150"
          align="center"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="300" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.contractStatus !== ContractStatus.REVOKED"
              type="danger"
              link
              :disabled="row.contractStatus !== ContractStatus.SIGNING"
              @click="handleRevoke(row)"
            >
              撤销合同
            </el-button>
            <el-button
              type="warning"
              link
              :disabled="row.contractStatus !== ContractStatus.SIGNING"
              @click="handleUrge(row)"
            >
              短信提醒
            </el-button>
            <el-button
              v-if="row.contractStatus === ContractStatus.REVOKED"
              type="success"
              link
              @click="handleRePushContract(row)"
            >
              重新推送
            </el-button>
          </template>
        </el-table-column>
      </CommonTable>
    </div>

    <!-- 导入对话框 -->
    <el-dialog
      :title="dialogTitle"
      v-model="dialogVisible"
      width="1000px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="模板文件" prop="templateUrl">
          <FileUpload
            v-model="form.templateUrl"
            accept=".csv"
            file-path="contract/csv"
            :tip-message="'只能上传csv文件'"
            @file-uploaded="handleFileUploaded"
            @file-removed="handleFileRemoved"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

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
 * 合同记录列表页面
 * 实现合同记录的查询、查看功能
 */

// 导入所需的组件和工具
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElLoading, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import FileUpload from '@/components/FileUpload/index.vue'
import ContractConfirmDialog from './components/ContractConfirmDialog.vue'
import { type ContractInfo } from './components/ContractConfirmDialog.vue'
import {
  queryContractList,
  downloadContract,
  exportContractList,
  importContractUserInfoByCsvFile,
  queryAsyncTaskResult,
  revokeSignFlow,
  urgeSignFlow,
  queryTopicList,
  getContractFieldInfo,
  pushContract,
} from './service'
import {
  ContractRecordItem,
  ContractQueryParams,
  ContractRecordListResponse,
  CONTRACT_STATUS_OPTIONS,
  ContractStatus,
  CAMP_PERIOD_OPTIONS,
} from './service.type'
import dayjs from 'dayjs'

// 页面状态管理
const loading = ref(false) // 加载状态
const tableRef = ref<InstanceType<typeof CommonTable> | null>(null) // 表格实例引用
const showImportDialog = ref(false) // 导入对话框显示状态
const dialogVisible = ref(false) // 导入对话框显示状态
const dialogTitle = ref('导入合同用户信息') // 导入对话框标题
const formRef = ref<FormInstance>() // 表单实例引用
const taskLoadingVisible = ref(false) // 任务加载状态
const taskId = ref('') // 当前任务ID
const topicList = ref<string[]>([]) // 研学主题列表

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

/**
 * 查询参数接口定义
 * @interface SearchParams
 * @property {string} childName - 学生姓名查询条件
 * @property {string} parentPhone - 家长手机号查询条件
 * @property {string} topic - 研学主题查询条件
 * @property {number} status - 合同状态查询条件
 * @property {string} activityStartDate - 活动开始日期查询条件
 * @property {number} contractType - 合同类型查询条件
 */
interface SearchParams {
  childName: string
  parentPhone: string
  topic: string
  status: number | undefined
  activityStartDate: string
  contractType: number | undefined
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
    childName: '',
    parentPhone: '',
    topic: '',
    status: CONTRACT_STATUS_OPTIONS[0].value,
    activityStartDate: '',
    contractType: undefined,
  },
})

/**
 * 获取合同记录列表数据
 * @param params 查询参数
 * @returns 返回列表数据和总数
 */
const getList = async (params: SearchForm) => {
  try {
    loading.value = true
    // 创建一个简单结构的查询参数对象
    const queryParams: ContractQueryParams = {
      childName: params.params.childName,
      parentPhone: params.params.parentPhone,
      topic: params.params.topic,
      status: params.params.status === -1 ? undefined : params.params.status,
      activityStartDate: params.params.activityStartDate,
      contractType: params.params.contractType,
      page: params.page,
      pageSize: params.pageSize,
    }
    const res = await queryContractList(queryParams)
    return {
      list: res.list || [],
      total: res.total || 0,
    }
  } catch (error) {
    console.error('获取合同记录列表失败:', error)
    ElMessage.error('获取合同记录列表失败')
    return {
      list: [],
      total: 0,
    }
  } finally {
    loading.value = false
  }
}

/**
 * 导出功能
 */
const handleExport = async () => {
  try {
    loading.value = true

    const res = await exportContractList({
      ...searchForm.params,
      status:
        searchForm.params.status === -1 ? undefined : searchForm.params.status,
    })

    if (res.downloadUrl) {
      // 创建下载链接
      const link = document.createElement('a')
      link.href = res.downloadUrl
      link.setAttribute('download', '合同记录.xlsx')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      ElMessage.success('导出成功')
    } else {
      ElMessage.warning('导出失败，未获取到下载链接')
    }
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

/**
 * 处理导入
 */
const handleImport = () => {
  dialogVisible.value = true
}

/**
 * 触发查询操作
 */
const handleQuery = () => {
  if (tableRef.value) {
    tableRef.value.refresh()
  }
}

/**
 * 重置查询条件
 */
const resetQuery = () => {
  Object.assign(searchForm, {
    page: 1,
    pageSize: 10,
    params: {
      childName: '',
      parentPhone: '',
      topic: '',
      status: undefined,
      contractType: undefined,
      activityStartDate: '',
    },
  })
  setTimeout(() => {
    handleQuery()
  }, 100)
}

/**
 * 下载/查看合同
 * @param row 当前行数据
 */
const handleDownload = async (row: ContractRecordItem) => {
  try {
    if (!row.contractLink) {
      ElMessage.warning('合同链接不存在')
      return
    }

    const response = await downloadContract(row.contractLink)
    // 创建下载链接
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    // 打开新窗口查看合同
    window.open(url, '_blank')

    // 延迟释放URL对象
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 100)
  } catch (error) {
    console.error('查看合同失败:', error)
    ElMessage.error('查看合同失败')
  }
}

/**
 * 获取状态标签
 * @param status 状态值
 * @returns 状态标签
 */
const getStatusLabel = (status: number): string => {
  const statusItem = CONTRACT_STATUS_OPTIONS.find(
    (item) => item.value === status,
  )
  return statusItem ? statusItem.label : '未知状态'
}

/**
 * 获取状态标签类型
 * @param status 状态值
 * @returns 标签类型
 */
const getStatusType = (status: number): string => {
  switch (status) {
    case ContractStatus.DRAFT:
      return 'info'
    case ContractStatus.SIGNING:
      return 'warning'
    case ContractStatus.COMPLETED:
      return 'success'
    case ContractStatus.REVOKED:
      return 'danger'
    case ContractStatus.EXPIRED:
      return 'danger'
    case ContractStatus.REJECTED:
      return 'danger'
    default:
      return 'info'
  }
}

/**
 * 格式化日期
 * @param dateString 日期字符串
 * @returns 格式化后的日期字符串
 */
const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  return dayjs(dateString).format('YYYY-MM-DD')
}

/**
 * 格式化日期时间
 * @param dateString 日期字符串
 * @returns 格式化后的日期时间字符串
 */
const formatDateTime = (dateString: string) => {
  if (!dateString) return '-'
  return dayjs(dateString).format('YYYY-MM-DD HH:mm:ss')
}

// 表单数据
const form = reactive({
  templateUrl: '', // 文件URL
})

// 表单验证规则
const rules = {
  templateUrl: [
    { required: true, message: '请上传CSV文件', trigger: 'change' },
  ],
}

/**
 * 处理文件上传成功
 * @param file 上传的文件
 */
const handleFileUploaded = (file: any) => {
  form.templateUrl = file.url
}

/**
 * 处理文件删除
 */
const handleFileRemoved = () => {
  form.templateUrl = ''
}

/**
 * 重置表单
 */
const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
  form.templateUrl = ''
}

/**
 * 提交表单
 */
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    loading.value = true
    // 调用导入API
    const response = await importContractUserInfoByCsvFile({
      fileUrl: form.templateUrl,
    })

    // 保存任务ID
    taskId.value = response.asyncTaskId
    dialogVisible.value = false

    // 显示加载状态，并开始轮询任务状态
    taskLoadingVisible.value = true
    await checkTaskStatus(response.asyncTaskId)
  } catch (error) {
    console.error('导入失败:', error)

    // 使用可手动关闭的弹出框展示错误信息
    ElMessageBox.alert(
      (error as any)?.data?.message || '请检查文件格式是否正确',
      '导入失败',
      {
        confirmButtonText: '确定',
        type: 'error',
      },
    )
  } finally {
    loading.value = false
  }
}

/**
 * 查询任务状态
 */
const checkTaskStatus = async (asyncTaskId: string) => {
  if (!asyncTaskId) return

  try {
    // 使用 Element Plus 加载指示器
    const loadingInstance = ElLoading.service({
      lock: true,
      text: '正在处理导入任务，请稍候...',
      background: 'rgba(0, 0, 0, 0.7)',
    })

    // 轮询任务状态，直到完成或失败
    let isCompleted = false
    let currentStatus = 0

    while (!isCompleted) {
      const result = await queryAsyncTaskResult(asyncTaskId)
      currentStatus = result.status

      // 根据任务状态处理
      switch (result.status) {
        case 0: // 待处理
          await new Promise((resolve) => setTimeout(resolve, 1000)) // 等待1秒再查询
          break
        case 1: // 执行中
          await new Promise((resolve) => setTimeout(resolve, 1000)) // 等待1秒再查询
          break
        case 2: // 成功
          ElMessage.success('文件导入成功')
          isCompleted = true
          // 刷新表格
          if (tableRef.value) {
            tableRef.value.refresh()
          }
          break
        case 3: // 失败
          // 关闭加载指示器
          loadingInstance.close()

          // 使用可手动关闭的弹出框展示错误信息
          await ElMessageBox.alert(
            result.errorInfo || '未知错误',
            '文件导入失败',
            {
              confirmButtonText: '确定',
              type: 'error',
            },
          )

          isCompleted = true
          break
        default:
          ElMessage.warning('未知状态，请稍后查看导入结果')
          isCompleted = true
      }
    }

    // 关闭加载指示器（只有在非失败状态下才需要关闭，因为失败时已经关闭）
    if (currentStatus !== 3) {
      loadingInstance.close()
    }
    taskLoadingVisible.value = false
  } catch (error) {
    console.error('查询任务状态失败:', error)
    ElMessage.error('查询任务状态失败')
    taskLoadingVisible.value = false
  }
}

/**
 * 撤销合同
 * @param row 当前行数据
 */
const handleRevoke = async (row: ContractRecordItem) => {
  try {
    // 检查是否符合撤销条件
    if (row.contractStatus !== ContractStatus.SIGNING) {
      ElMessage.warning('只有已完成签署的合同才能撤销')
      return
    }

    // 提示用户确认撤销
    const { value: revokeReason } = await ElMessageBox.prompt(
      '请输入撤销原因',
      '撤销合同',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入撤销原因',
        inputValidator: (value) => {
          if (!value) {
            return '撤销原因不能为空'
          }
          return true
        },
      },
    )

    // 用户取消撤销
    if (!revokeReason) return

    // 提交撤销请求
    loading.value = true
    const res = await revokeSignFlow({
      signFlowId: row.signFlowId,
      revokeReason,
    })

    if (res.isSucceed) {
      ElMessage.success('合同撤销成功')
      // 刷新表格
      handleQuery()
    }
  } catch (error) {
    console.error('撤销合同失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 短信提醒签署合同
 * @param row 当前行数据
 */
const handleUrge = async (row: ContractRecordItem) => {
  try {
    // 检查是否符合短信提醒条件
    if (
      row.contractStatus !== ContractStatus.DRAFT &&
      row.contractStatus !== ContractStatus.SIGNING
    ) {
      ElMessage.warning('只有草稿或签署中的合同才能发送提醒')
      return
    }

    // 确认是否发送短信提醒
    await ElMessageBox.confirm(
      `确定要向 ${row.parentPhone} 发送短信提醒签署合同吗？`,
      '短信提醒',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    // 提交短信提醒请求
    loading.value = true
    const res = await urgeSignFlow({
      signFlowId: row.signFlowId,
      psnAccount: row.parentPhone, // 使用家长手机号作为psnAccount
    })

    if (res.isSucceed) {
      ElMessage.success('短信提醒发送成功')
    }
  } catch (error) {
    console.error('短信提醒发送失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 获取研学主题列表
 */
const fetchTopicList = async () => {
  try {
    const res = await queryTopicList()
    topicList.value = res.list || []
  } catch (error) {
    console.error('获取研学主题列表失败:', error)
    ElMessage.error('获取研学主题列表失败')
  }
}

/**
 * 处理重新推送合同
 * @param row 当前行数据
 */
const handleRePushContract = async (row: ContractRecordItem) => {
  try {
    contractLoading.value = true

    // 调用API获取合同字段信息
    const res = await getContractFieldInfo({ id: row.courseAppointmentId })
    if (!res) {
      throw new Error('获取合同信息失败')
    }

    // 填充合同信息
    contractInfo.courseAppointmentId = row.courseAppointmentId
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
 * 确认重新推送合同
 */
const confirmPushContract = async () => {
  try {
    contractLoading.value = true

    // 调用API推送合同
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
        if (tableRef.value) {
          tableRef.value.refresh()
        }
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

// 初始化页面
onMounted(async () => {
  await fetchTopicList() // 获取研学主题列表
})
</script>

<style lang="scss" scoped>
.contract-record-container {
  padding: 20px;

  .table-wrapper {
    margin-bottom: 20px;
  }
}
</style>
