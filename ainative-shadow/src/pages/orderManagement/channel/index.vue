<template>
  <div class="order-management-container">
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
          <el-form-item label="渠道订单编号">
            <el-input
              v-model="searchForm.params.orderNumber"
              placeholder="请输入渠道订单编号"
              clearable
              style="width: 220px"
            />
          </el-form-item>
          <el-form-item label="手机号">
            <el-input
              v-model="searchForm.params.phone"
              placeholder="请输入手机号"
              clearable
              style="width: 220px"
            />
          </el-form-item>
          <el-form-item label="商品名称">
            <el-input
              v-model="searchForm.params.goodName"
              placeholder="请输入商品名称"
              clearable
              style="width: 220px"
            />
          </el-form-item>
          <el-form-item label="购买渠道">
            <el-select
              v-model="searchForm.params.channelId"
              placeholder="请选择"
              clearable
              style="width: 140px"
              :loading="channelLoading"
            >
              <el-option
                v-for="item in channelOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="支付时间">
            <el-date-picker
              v-model="searchForm.params.paymentTimeRange"
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
          <el-form-item label="商品类型">
            <el-select
              v-model="searchForm.params.goodType"
              placeholder="请选择"
              clearable
              style="width: 140px"
            >
              <el-option label="单日营" value="single" />
              <el-option label="多日营" value="multi" />
            </el-select>
          </el-form-item>
          <el-form-item label="退款时间">
            <el-date-picker
              v-model="searchForm.params.refundTimeRange"
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
          <el-form-item label="服务状态">
            <el-select
              v-model="searchForm.params.serviceStatus"
              placeholder="请选择"
              clearable
              style="width: 140px"
            >
              <el-option
                v-for="item in SERVICE_STATUS_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="订单状态">
            <el-select
              v-model="searchForm.params.orderStatus"
              placeholder="请选择"
              clearable
              style="width: 140px"
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
        <el-button type="primary" @click="handleSyncWeidianOrder"
          >微店订单同步</el-button
        >
        <el-button type="primary" @click="handleImport">导入渠道订单</el-button>
        <el-button type="primary" @click="handleImportPhone"
          >导入手机号</el-button
        >
        <el-button type="success" @click="handleExport">导出</el-button>
        <el-button
          v-auth="'order_csv_mapping'"
          type="warning"
          @click="handleCsvMapping"
          >CSV映射配置</el-button
        >
        <el-button type="primary" @click="handleExportMiniProgramFlow"
          >导出小程序流水</el-button
        >
      </template>

      <!-- 表格列定义 -->
      <!-- 渠道订单编号 -->
      <el-table-column
        prop="orderNumber"
        label="渠道订单编号"
        min-width="140"
        align="center"
      />
      <!-- 渠道商品ID -->
      <el-table-column
        prop="channelGoodId"
        label="渠道商品ID"
        min-width="120"
        align="center"
      />
      <!-- 商品名称 -->
      <el-table-column
        prop="goodName"
        label="商品名称"
        min-width="150"
        align="center"
      />
      <!-- 商品类型 -->
      <el-table-column
        prop="goodType"
        label="商品类型"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ getGoodTypeLabel(row.goodType || '') }}
        </template>
      </el-table-column>
      <!-- 购买渠道 -->
      <el-table-column
        prop="channelName"
        label="购买渠道"
        min-width="100"
        align="center"
      />
      <!-- 实付金额 -->
      <el-table-column
        prop="orderPrice"
        label="实付金额"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ formatMoney(row.orderPrice) }}
        </template>
      </el-table-column>
      <!-- 实收金额 -->
      <el-table-column
        prop="receiptAmount"
        label="实收金额"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ formatMoney(row.receiptAmount) }}
        </template>
      </el-table-column>
      <!-- 平台优惠金额 -->
      <el-table-column
        prop="platformDiscountAmount"
        label="平台优惠金额"
        min-width="120"
        align="center"
      >
        <template #default="{ row }">
          {{ getPlatformDiscountAmountDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 支付优惠金额 -->
      <el-table-column
        prop="paymentDiscountAmount"
        label="支付优惠金额"
        min-width="120"
        align="center"
      >
        <template #default="{ row }">
          {{ getPaymentDiscountAmountDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 店铺优惠金额 -->
      <el-table-column
        prop="shopDiscountAmount"
        label="店铺优惠金额"
        min-width="120"
        align="center"
      >
        <template #default="{ row }">
          {{ getShopDiscountAmountDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 保险费 -->
      <el-table-column
        prop="actualInsured"
        label="保险费"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ getActualInsuredDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 达人佣金 -->
      <el-table-column
        prop="talentCommission"
        label="达人佣金"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ getTalentCommissionDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 达人UID -->
      <el-table-column
        prop="talentUid"
        label="达人UID"
        min-width="120"
        align="center"
      >
        <template #default="{ row }">
          {{ row.talentUid || '--' }}
        </template>
      </el-table-column>
      <!-- 达人名称 -->
      <el-table-column
        prop="talentName"
        label="达人名称"
        min-width="120"
        align="center"
      >
        <template #default="{ row }">
          {{ row.talentName || '--' }}
        </template>
      </el-table-column>
      <!-- 平台手续费 -->
      <el-table-column
        prop="platformFee"
        label="平台手续费"
        min-width="110"
        align="center"
      >
        <template #default="{ row }">
          {{ getPlatformFeeDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 联系方式 -->
      <el-table-column
        prop="phone"
        label="联系方式"
        min-width="120"
        align="center"
      />
      <!-- 支付时间 -->
      <el-table-column
        prop="paymentTime"
        label="支付时间"
        min-width="160"
        align="center"
      >
        <template #default="{ row }">
          {{ formatDateTime(row.paymentTime) }}
        </template>
      </el-table-column>
      <!-- 服务状态 -->
      <el-table-column
        prop="serviceStatus"
        label="服务状态"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          <el-tag
            v-if="row.serviceStatus"
            :type="getServiceStatusType(row.serviceStatus)"
          >
            {{ getServiceStatusLabel(row.serviceStatus) }}
          </el-tag>
          <span v-else>--</span>
        </template>
      </el-table-column>
      <!-- 订单状态 -->
      <el-table-column label="订单状态" min-width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <!-- 退款金额 -->
      <el-table-column
        prop="refundAmount"
        label="退款金额"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ getRefundAmountDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 退款时间 -->
      <el-table-column
        prop="refundTime"
        label="退款时间"
        min-width="160"
        align="center"
      >
        <template #default="{ row }">
          {{ formatDateTime(row.refundTime) }}
        </template>
      </el-table-column>
      <!-- 创建时间 -->
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
      <!-- 更新时间 -->
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
      <!-- 订单编号 -->
      <el-table-column
        prop="id"
        label="订单编号"
        min-width="120"
        align="center"
      />
      <!-- 商品ID -->
      <el-table-column
        prop="goodId"
        label="商品ID"
        min-width="120"
        align="center"
      />
      <!-- 最后编辑人 -->
      <el-table-column
        prop="updatedByName"
        label="最后编辑人"
        min-width="100"
        align="center"
      />
      <el-table-column
        label="操作"
        min-width="240"
        align="center"
        fixed="right"
      >
        <template #default="{ row }">
          <!-- 小程序订单操作 -->
          <template v-if="row.channelName === '小程序'">
            <el-button type="primary" link @click="handleEditPhone(row)">
              修改手机号
            </el-button>
            <el-button
              v-if="['pending', 'success', 'completed'].includes(row.status)"
              v-auth="'order_mini_program_refund'"
              type="danger"
              link
              @click="handleMiniProgramRefund(row)"
            >
              操作退款
            </el-button>
            <el-button
              v-if="row.status === 'failedRefund'"
              type="warning"
              link
              @click="handleConvertToRefunded(row)"
            >
              转为已退款
            </el-button>
            <el-button
              v-if="row.status === 'refunded'"
              type="warning"
              link
              @click="handleViewRefundReason(row)"
            >
              退款详情
            </el-button>
            <el-button type="info" link @click="handleViewProgress(row)">
              核销进度
            </el-button>
            <el-button type="primary" link @click="handleViewLog(row)">
              日志
            </el-button>
            <el-button type="success" link @click="handleViewSubOrders(row)">
              查看子订单
            </el-button>
          </template>
          <!-- 微店和抖音订单操作 -->
          <template
            v-else-if="row.channelName === '微店' || row.channelName === '抖音'"
          >
            <el-button type="primary" link @click="handleEditPhone(row)">
              修改手机号
            </el-button>
            <el-button
              v-if="row.status !== 'refunded'"
              type="danger"
              link
              @click="handleRefund(row)"
            >
              修改订单状态
            </el-button>
            <el-button type="info" link @click="handleViewProgress(row)">
              核销进度
            </el-button>
            <el-button type="primary" link @click="handleViewLog(row)">
              日志
            </el-button>
            <el-button type="success" link @click="handleViewSubOrders(row)">
              查看子订单
            </el-button>
          </template>
          <!-- 其他渠道订单操作 -->
          <template v-else>
            <el-button type="primary" link @click="handleEditPhone(row)">
              修改手机号
            </el-button>
            <el-button
              v-if="row.status !== 'refunded'"
              type="danger"
              link
              @click="handleRefund(row)"
            >
              修改订单状态
            </el-button>
            <el-button type="info" link @click="handleViewProgress(row)">
              核销进度
            </el-button>
            <el-button type="primary" link @click="handleViewLog(row)">
              日志
            </el-button>
            <el-button type="success" link @click="handleViewSubOrders(row)">
              查看子订单
            </el-button>
          </template>
        </template>
      </el-table-column>
    </CommonTable>

    <!-- 导入对话框 -->
    <ImportOrderDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <!-- 导入手机号对话框 -->
    <ImportPhoneDialog
      v-model:visible="importPhoneDialogVisible"
      @success="handleImportSuccess"
    />

    <!-- CSV映射配置对话框 -->
    <CsvMappingDialog
      v-model:visible="csvMappingDialogVisible"
      :channelId="selectedChannelId"
      @refresh="handleCsvMappingRefresh"
    />

    <!-- 修改手机号对话框 -->
    <EditPhoneDialog
      v-model:visible="editPhoneDialogVisible"
      :orderData="selectedOrder"
      @success="handleEditSuccess"
    />

    <!-- 退款确认对话框 -->
    <RefundDialog
      v-model:visible="refundDialogVisible"
      :orderData="selectedOrder"
      @success="handleRefundSuccess"
    />

    <!-- 小程序操作退款对话框 -->
    <MiniProgramRefundDialog
      v-model:visible="miniProgramRefundDialogVisible"
      :orderData="selectedOrder"
      @success="handleMiniProgramRefundSuccess"
    />

    <!-- 退款原因查看对话框 -->
    <RefundReasonDialog
      v-model:visible="refundReasonDialogVisible"
      :orderData="selectedOrder"
    />

    <!-- 核销进度对话框 -->
    <ProgressDialog
      v-model:visible="progressDialogVisible"
      :orderData="selectedOrder"
    />

    <!-- 导出小程序流水对话框 -->
    <ExportMiniProgramFlowDialog
      v-model:visible="exportMiniProgramFlowDialogVisible"
      @success="handleExportMiniProgramFlowSuccess"
    />

    <!-- 订单日志对话框 -->
    <OrderLogDialog
      v-model:visible="orderLogDialogVisible"
      :orderData="selectedOrder"
    />

    <!-- 转为已退款对话框 -->
    <ConvertToRefundedDialog
      v-model:visible="convertToRefundedDialogVisible"
      :orderData="selectedOrder"
      @success="handleConvertToRefundedSuccess"
    />

    <!-- 子订单对话框 -->
    <SubOrderDialog
      v-model:visible="subOrderDialogVisible"
      :orderData="selectedOrder"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 订单管理页面
 */

// 导入所需的组件和工具
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import ImportOrderDialog from './components/ImportOrderDialog/index.vue'
import ImportPhoneDialog from './components/ImportPhoneDialog/index.vue'
import CsvMappingDialog from './components/CsvMappingDialog/index.vue'
import EditPhoneDialog from './components/EditPhoneDialog/index.vue'
import RefundDialog from './components/RefundDialog/index.vue'
import MiniProgramRefundDialog from './components/MiniProgramRefundDialog/index.vue'
import RefundReasonDialog from './components/RefundReasonDialog/index.vue'
import ProgressDialog from './components/ProgressDialog/index.vue'
import ExportMiniProgramFlowDialog from './components/ExportMiniProgramFlowDialog/index.vue'
import OrderLogDialog from './components/OrderLogDialog/index.vue'
import ConvertToRefundedDialog from './components/ConvertToRefundedDialog/index.vue'
import SubOrderDialog from './components/SubOrderDialog/index.vue'
import { useRouter } from 'vue-router'
import {
  getOrderList,
  importOrdersByCsvFile,
  importPhonesByCsvFile,
  exportOrders,
  getChannelList,
  updateOrderPhone,
  updateOrderStatus,
  getOrderProgress,
  syncWeidianOrder,
} from './service'
import {
  OrderItem,
  STATUS_OPTIONS,
  CHANNEL_OPTIONS,
  ChannelItem,
  SERVICE_STATUS_OPTIONS,
  getStatusType,
  getStatusLabel,
  getServiceStatusType,
  getServiceStatusLabel,
  getGoodTypeLabel,
} from './service.type'
import { formatMoney } from '@/utils/money'
import dayjs from 'dayjs'

// 页面状态管理
const loading = ref(false)
const channelLoading = ref(false)
const tableRef = ref<InstanceType<typeof CommonTable> | null>(null)
const selectedRows = ref<OrderItem[]>([])
const channelOptions = ref(CHANNEL_OPTIONS)
const router = useRouter()

// 对话框显示状态
const importDialogVisible = ref(false)
const importPhoneDialogVisible = ref(false)
const csvMappingDialogVisible = ref(false)
const editPhoneDialogVisible = ref(false)
const refundDialogVisible = ref(false)
const miniProgramRefundDialogVisible = ref(false)
const refundReasonDialogVisible = ref(false)
const progressDialogVisible = ref(false)
const exportMiniProgramFlowDialogVisible = ref(false)
const orderLogDialogVisible = ref(false)
const convertToRefundedDialogVisible = ref(false)
const subOrderDialogVisible = ref(false)

// 选中的数据
const selectedChannelId = ref('')
const selectedOrder = ref<OrderItem | undefined>(undefined)

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
  orderNumber: string
  goodName: string
  channelId: string
  paymentTimeRange: [string, string] | null
  orderStatus: string
  phone: string
  goodType: string
  refundTimeRange: [string, string] | null
  serviceStatus: string
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
    orderNumber: '',
    goodName: '',
    channelId: '',
    paymentTimeRange: null,
    orderStatus: '',
    phone: '',
    goodType: '',
    refundTimeRange: null,
    serviceStatus: '',
  },
})

const defaultSearchForm = reactive<SearchForm>({
  page: 1,
  pageSize: 10,
  params: {
    orderNumber: '',
    goodName: '',
    channelId: '',
    paymentTimeRange: null,
    orderStatus: '',
    phone: '',
    goodType: '',
    refundTimeRange: null,
    serviceStatus: '',
  },
})

/**
 * 获取订单列表数据
 * @param params 查询参数
 * @returns 返回列表数据和总数
 */
const getList = async (params: SearchForm) => {
  try {
    loading.value = true

    // 转换查询参数
    const queryParams = {
      orderNumber: params.params.orderNumber,
      goodName: params.params.goodName,
      channelId: params.params.channelId,
      startDate: params.params.paymentTimeRange?.[0], // 将被服务层转换为paymentTimeStart
      endDate: params.params.paymentTimeRange?.[1], // 将被服务层转换为paymentTimeEnd
      orderStatus: params.params.orderStatus,
      phone: params.params.phone,
      goodType: params.params.goodType,
      refundTimeStart: params.params.refundTimeRange?.[0],
      refundTimeEnd: params.params.refundTimeRange?.[1],
      serviceStatus: params.params.serviceStatus,
      page: params.page,
      pageSize: params.pageSize,
    }

    console.log('getList:queryParams', queryParams)

    const res = await getOrderList(queryParams)
    return {
      list: res.list,
      total: res.total,
    }
  } catch (error) {
    console.error('获取订单列表失败:', error)
    // 确保即使在出错的情况下也返回有效的对象
    return {
      list: [],
      total: 0,
    }
  } finally {
    loading.value = false
  }
}

/**
 * 处理表格选择行变化
 * @param rows 选中的行
 */
const handleSelectionChange = (rows: OrderItem[]) => {
  selectedRows.value = rows
}

/**
 * 处理导入
 */
const handleImport = () => {
  importDialogVisible.value = true
}

/**
 * 处理导入手机号
 */
const handleImportPhone = () => {
  importPhoneDialogVisible.value = true
}

/**
 * 处理CSV映射配置
 */
const handleCsvMapping = () => {
  selectedChannelId.value = searchForm.params.channelId || ''
  csvMappingDialogVisible.value = true
}

/**
 * 处理CSV映射配置刷新
 */
const handleCsvMappingRefresh = () => {
  // 可以在这里添加一些刷新逻辑，如果需要的话
  ElMessage.success('映射配置已更新')
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
      orderNumber: searchForm.params.orderNumber,
      goodName: searchForm.params.goodName,
      channelId: searchForm.params.channelId,
      startDate: searchForm.params.paymentTimeRange?.[0],
      endDate: searchForm.params.paymentTimeRange?.[1],
      orderStatus: searchForm.params.orderStatus,
      phone: searchForm.params.phone,
      goodType: searchForm.params.goodType,
      refundTimeStart: searchForm.params.refundTimeRange?.[0],
      refundTimeEnd: searchForm.params.refundTimeRange?.[1],
      serviceStatus: searchForm.params.serviceStatus,
    }

    // 调用导出API获取下载URL
    const res = await exportOrders(queryParams)

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
      loadingMessage.close()
      ElMessage.error('导出失败：未获取到下载链接')
    }
  } catch (error) {
    console.error('导出失败:', error)
    loadingMessage.close()
    ElMessage.error('导出失败，请稍后重试')
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
 * 获取优惠金额显示内容
 * @param row 订单行数据
 * @returns 优惠金额显示文本
 */
const getDiscountAmountDisplay = (row: OrderItem) => {
  if (row.discountAmount && row.discountAmount > 0) {
    return formatMoney(row.discountAmount)
  } else {
    return '无'
  }
}

/**
 * 获取平台优惠金额显示内容
 * @param row 订单行数据
 * @returns 平台优惠金额显示文本
 */
const getPlatformDiscountAmountDisplay = (row: OrderItem) => {
  if (
    row.platformDiscountAmount !== undefined &&
    row.platformDiscountAmount !== null &&
    row.platformDiscountAmount > 0
  ) {
    return formatMoney(row.platformDiscountAmount)
  }
  return '--'
}

/**
 * 获取支付优惠金额显示内容
 * @param row 订单行数据
 * @returns 支付优惠金额显示文本
 */
const getPaymentDiscountAmountDisplay = (row: OrderItem) => {
  if (
    row.paymentDiscountAmount !== undefined &&
    row.paymentDiscountAmount !== null &&
    row.paymentDiscountAmount > 0
  ) {
    return formatMoney(row.paymentDiscountAmount)
  }
  return '--'
}

/**
 * 获取店铺优惠金额显示内容
 * @param row 订单行数据
 * @returns 店铺优惠金额显示文本
 */
const getShopDiscountAmountDisplay = (row: OrderItem) => {
  if (
    row.shopDiscountAmount !== undefined &&
    row.shopDiscountAmount !== null &&
    row.shopDiscountAmount > 0
  ) {
    return formatMoney(row.shopDiscountAmount)
  }
  return '--'
}

/**
 * 获取保险费显示内容
 * @param row 订单行数据
 * @returns 保险费显示文本
 */
const getActualInsuredDisplay = (row: OrderItem) => {
  if (
    row.actualInsured !== undefined &&
    row.actualInsured !== null &&
    row.actualInsured > 0
  ) {
    return formatMoney(row.actualInsured)
  }
  return '--'
}

/**
 * 获取达人佣金显示内容
 * @param row 订单行数据
 * @returns 达人佣金显示文本
 */
const getTalentCommissionDisplay = (row: OrderItem) => {
  if (
    row.talentCommission !== undefined &&
    row.talentCommission !== null &&
    row.talentCommission > 0
  ) {
    return formatMoney(row.talentCommission)
  }
  return '--'
}

/**
 * 获取平台手续费显示内容
 * @param row 订单行数据
 * @returns 平台手续费显示文本
 */
const getPlatformFeeDisplay = (row: OrderItem) => {
  if (
    row.platformFee !== undefined &&
    row.platformFee !== null &&
    row.platformFee > 0
  ) {
    return formatMoney(row.platformFee)
  }
  return '--'
}

/**
 * 获取退款金额显示内容
 * @param row 订单行数据
 * @returns 退款金额显示文本
 */
const getRefundAmountDisplay = (row: OrderItem) => {
  if (
    row.refundAmount !== undefined &&
    row.refundAmount !== null &&
    row.refundAmount > 0
  ) {
    return formatMoney(row.refundAmount)
  }
  return '--'
}

/**
 * 加载渠道列表
 */
const loadChannelOptions = async () => {
  try {
    channelLoading.value = true
    const res = await getChannelList()
    if (res && res.list && res.list.length > 0) {
      // 转换API返回的数据格式为选项格式
      const options = res.list.map((item) => ({
        label: item.name,
        value: item.id,
      }))

      // 添加"全部"选项
      channelOptions.value = [{ label: '全部', value: '' }, ...options]
    }
  } catch (error) {
    console.error('获取渠道列表失败:', error)
    ElMessage.error('获取渠道列表失败，请刷新页面重试')
  } finally {
    channelLoading.value = false
  }
}

/**
 * 处理修改手机号
 * @param row 订单行数据
 */
const handleEditPhone = (row: OrderItem) => {
  selectedOrder.value = row
  editPhoneDialogVisible.value = true
}

/**
 * 处理退款（微店和抖音）
 * @param row 订单行数据
 */
const handleRefund = (row: OrderItem) => {
  selectedOrder.value = row
  refundDialogVisible.value = true
}

/**
 * 处理小程序操作退款
 * @param row 订单行数据
 */
const handleMiniProgramRefund = (row: OrderItem) => {
  selectedOrder.value = row
  miniProgramRefundDialogVisible.value = true
}

/**
 * 处理查看退款原因
 * @param row 订单行数据
 */
const handleViewRefundReason = (row: OrderItem) => {
  selectedOrder.value = row
  refundReasonDialogVisible.value = true
}

/**
 * 处理查看核销进度
 * @param row 订单行数据
 */
const handleViewProgress = (row: OrderItem) => {
  selectedOrder.value = row
  progressDialogVisible.value = true
}

/**
 * 处理导出小程序流水
 */
const handleExportMiniProgramFlow = () => {
  exportMiniProgramFlowDialogVisible.value = true
}

/**
 * 处理导出小程序流水成功
 */
const handleExportMiniProgramFlowSuccess = () => {
  // 可以在这里添加一些后续处理逻辑
}

/**
 * 处理查看日志
 * @param row 订单行数据
 */
const handleViewLog = (row: OrderItem) => {
  selectedOrder.value = row
  orderLogDialogVisible.value = true
}

/**
 * 处理转为已退款
 * @param row 订单行数据
 */
const handleConvertToRefunded = (row: OrderItem) => {
  selectedOrder.value = row
  convertToRefundedDialogVisible.value = true
}

/**
 * 处理转为已退款成功
 */
const handleConvertToRefundedSuccess = () => {
  if (tableRef.value) {
    tableRef.value.refresh()
  }
}

/**
 * 处理导入成功
 */
const handleImportSuccess = () => {
  if (tableRef.value) {
    tableRef.value.refresh()
  }
}

/**
 * 处理编辑成功
 */
const handleEditSuccess = () => {
  if (tableRef.value) {
    tableRef.value.refresh()
  }
}

/**
 * 处理退款成功
 */
const handleRefundSuccess = () => {
  if (tableRef.value) {
    tableRef.value.refresh()
  }
}

/**
 * 处理小程序退款成功
 */
const handleMiniProgramRefundSuccess = () => {
  if (tableRef.value) {
    tableRef.value.refresh()
  }
}

/**
 * 处理微店订单同步
 */
const handleSyncWeidianOrder = async () => {
  try {
    ElMessage.success('微店订单同步中,请5分钟后刷新页面')
    await syncWeidianOrder()
  } catch (error) {
    console.error('微店订单同步失败:', error)
    ElMessage.error('微店订单同步失败，请稍后重试')
  }
}

/**
 * 处理查看子订单
 * @param row 订单行数据
 */
const handleViewSubOrders = (row: OrderItem) => {
  selectedOrder.value = row
  subOrderDialogVisible.value = true
}

// 初始化
onMounted(() => {
  // 加载渠道列表
  loadChannelOptions()
})
</script>

<style scoped>
.order-management-container {
  padding: 0;
}

.refund-confirm-content {
  padding: 10px 0;
}

.refund-confirm-content p {
  margin: 10px 0;
  line-height: 1.5;
}

.progress-header {
  margin-bottom: 20px;
}

.progress-header p {
  margin: 10px 0;
  line-height: 1.5;
}

.appointment-item,
.verification-item {
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.appointment-item p,
.verification-item p {
  margin: 5px 0;
  line-height: 1.5;
}

.category-container {
  margin-bottom: 20px;
}

.category-container h3 {
  margin-bottom: 10px;
  font-size: 16px;
  color: #303133;
}
</style>
