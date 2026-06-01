<template>
  <div class="sub-order-management-container">
    <CommonTable ref="tableRef" v-loading="loading" :fetch-data="getList" :search-form="searchForm"
      :default-search-form="defaultSearchForm" :show-search="true" :show-extra-buttons="true"
      @selection-change="handleSelectionChange">
      <!-- 搜索条件 -->
      <template #search-items>
        <el-form :inline="true" :model="searchForm.params">
          <el-form-item label="渠道订单编号">
            <el-input v-model="searchForm.params.orderNumber" placeholder="请输入渠道订单编号" clearable style="width: 220px" />
          </el-form-item>
          <el-form-item label="手机号">
            <el-input v-model="searchForm.params.phone" placeholder="请输入手机号" clearable style="width: 220px" />
          </el-form-item>
          <el-form-item label="商品名称">
            <el-input v-model="searchForm.params.goodName" placeholder="请输入商品名称" clearable style="width: 220px" />
          </el-form-item>
          <el-form-item label="购买渠道">
            <el-select v-model="searchForm.params.channelId" placeholder="请选择" clearable style="width: 140px"
              :loading="channelLoading">
              <el-option v-for="item in channelOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="支付时间">
            <el-date-picker v-model="searchForm.params.paymentTimeRange" type="daterange" range-separator="至"
              start-placeholder="开始日期" end-placeholder="结束日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD"
              :shortcuts="dateShortcuts" style="width: 260px" />
          </el-form-item>
          <el-form-item label="退款时间">
            <el-date-picker v-model="searchForm.params.refundTimeRange" type="daterange" range-separator="至"
              start-placeholder="开始日期" end-placeholder="结束日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD"
              :shortcuts="dateShortcuts" style="width: 260px" />
          </el-form-item>
          <el-form-item label="参营时间">
            <el-date-picker v-model="searchForm.params.campTimeRange" type="daterange" range-separator="至"
              start-placeholder="开始日期" end-placeholder="结束日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD"
              :shortcuts="dateShortcuts" style="width: 260px" />
          </el-form-item>
          <el-form-item label="服务状态">
            <el-select v-model="searchForm.params.serviceStatus" placeholder="请选择" clearable style="width: 140px">
              <el-option v-for="item in SERVICE_STATUS_OPTIONS" :key="item.value" :label="item.label"
                :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="订单状态">
            <el-select v-model="searchForm.params.orderStatus" placeholder="请选择" clearable style="width: 140px">
              <el-option v-for="item in SUB_ORDER_STATUS_OPTIONS" :key="item.value" :label="item.label"
                :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="商品类型">
            <el-select v-model="searchForm.params.goodType" placeholder="请选择" clearable style="width: 140px">
              <el-option v-for="item in GOOD_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>

      <!-- 额外按钮 -->
      <template #extra-buttons>
        <el-button type="success" @click="handleExport">导出订单</el-button>
      </template>

      <!-- 表格列定义 -->
      <!-- 渠道订单编号 -->
      <el-table-column prop="orderNumber" label="渠道订单编号" min-width="140" align="center" />
      <!-- 渠道商品ID -->
      <el-table-column prop="channelGoodId" label="渠道商品ID" min-width="120" align="center" />
      <!-- 商品名称 -->
      <el-table-column prop="goodName" label="商品名称" min-width="150" align="center">
        <template #default="{ row }">
          {{ row.goodName || '--' }}
        </template>
      </el-table-column>
      <!-- 商品类型 -->
      <el-table-column prop="goodType" label="商品类型" min-width="100" align="center">
        <template #default="{ row }">
          {{ getGoodTypeLabel(row.goodType || '') }}
        </template>
      </el-table-column>
      <!-- 购买渠道 -->
      <el-table-column prop="channelId" label="购买渠道" min-width="100" align="center">
        <template #default="{ row }">
          {{ getChannelName(row.channelId) }}
        </template>
      </el-table-column>
      <!-- 实付金额 -->
      <el-table-column prop="orderPrice" label="实付金额" min-width="100" align="center">
        <template #default="{ row }">
          {{ formatMoney(row.orderPrice) }}
        </template>
      </el-table-column>
      <!-- 实收金额 -->
      <el-table-column prop="receiptAmount" label="实收金额" min-width="100" align="center">
        <template #default="{ row }">
          {{ getReceiptAmountDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 平台优惠金额 -->
      <el-table-column prop="platformDiscountAmount" label="平台优惠金额" min-width="120" align="center">
        <template #default="{ row }">
          {{ getPlatformDiscountAmountDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 支付优惠金额 -->
      <el-table-column prop="paymentDiscountAmount" label="支付优惠金额" min-width="120" align="center">
        <template #default="{ row }">
          {{ getPaymentDiscountAmountDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 店铺优惠金额 -->
      <el-table-column prop="shopDiscountAmount" label="店铺优惠金额" min-width="120" align="center">
        <template #default="{ row }">
          {{ getShopDiscountAmountDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 保险费 -->
      <el-table-column prop="actualInsured" label="保险费" min-width="100" align="center">
        <template #default="{ row }">
          {{ getActualInsuredDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 达人佣金 -->
      <el-table-column prop="talentCommission" label="达人佣金" min-width="100" align="center">
        <template #default="{ row }">
          {{ getTalentCommissionDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 达人UID -->
      <el-table-column prop="talentUid" label="达人UID" min-width="120" align="center">
        <template #default="{ row }">
          {{ row.talentUid || row.talentUId || '--' }}
        </template>
      </el-table-column>
      <!-- 达人名称 -->
      <el-table-column prop="talentName" label="达人名称" min-width="120" align="center">
        <template #default="{ row }">
          {{ row.talentName || '--' }}
        </template>
      </el-table-column>
      <!-- 平台手续费 -->
      <el-table-column prop="platformFee" label="平台手续费" min-width="110" align="center">
        <template #default="{ row }">
          {{ getPlatformFeeDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 联系方式 -->
      <el-table-column prop="phone" label="联系方式" min-width="120" align="center">
        <template #default="{ row }">
          {{ row.phone || row.ph || '--' }}
        </template>
      </el-table-column>
      <!-- 支付时间 -->
      <el-table-column prop="paymentTime" label="支付时间" min-width="160" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.paymentTime) }}
        </template>
      </el-table-column>
      <!-- 参营时间 -->
      <el-table-column prop="campTime" label="参营时间" min-width="160" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.campTime) }}
        </template>
      </el-table-column>
      <!-- 服务状态 -->
      <el-table-column prop="serviceStatus" label="服务状态" min-width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.serviceStatus" :type="getServiceStatusType(row.serviceStatus)">
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
      <el-table-column prop="refundAmount" label="退款金额" min-width="100" align="center">
        <template #default="{ row }">
          {{ getRefundAmountDisplay(row) }}
        </template>
      </el-table-column>
      <!-- 退款时间 -->
      <el-table-column prop="refundTime" label="退款时间" min-width="160" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.refundTime) }}
        </template>
      </el-table-column>

      <!-- 创建时间 -->
      <el-table-column prop="createdAt" label="创建时间" min-width="160" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>
      <!-- 更新时间 -->
      <el-table-column prop="updatedAt" label="更新时间" min-width="160" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <!-- 结算时间 -->
      <el-table-column prop="settlementTime" label="结算时间" min-width="160" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.settlementTime) }}
        </template>
      </el-table-column>
      <!-- 订单编号 -->
      <el-table-column prop="id" label="订单编号" min-width="120" align="center" />
      <!-- 商品ID -->
      <el-table-column prop="goodId" label="商品ID" min-width="120" align="center" />
      <!-- 最后编辑人 -->
      <el-table-column prop="updatedByName" label="最后编辑人" min-width="100" align="center">
        <template #default="{ row }">
          {{ row.updatedByName || '--' }}
        </template>
      </el-table-column>
    </CommonTable>
  </div>
</template>

<script setup lang="ts">
/**
 * 子订单管理页面
 */

// 导入所需的组件和工具
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import {
  getSubOrderList,
  getChannelList,
  exportSubOrders,
} from './service'
import {
  SubOrderItem,
  SUB_ORDER_STATUS_OPTIONS,
  CHANNEL_OPTIONS,
  SERVICE_STATUS_OPTIONS,
  GOOD_TYPE_OPTIONS,
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
const selectedRows = ref<SubOrderItem[]>([])
const channelOptions = ref(CHANNEL_OPTIONS)

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
  campTimeRange: [string, string] | null
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
    campTimeRange: null,
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
    campTimeRange: null,
  },
})

/**
 * 获取子订单列表数据
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
      startDate: params.params.paymentTimeRange?.[0],
      endDate: params.params.paymentTimeRange?.[1],
      orderStatus: params.params.orderStatus,
      phone: params.params.phone,
      goodType: params.params.goodType,
      refundTimeStart: params.params.refundTimeRange?.[0],
      refundTimeEnd: params.params.refundTimeRange?.[1],
      serviceStatus: params.params.serviceStatus,
      campTimeStart: params.params.campTimeRange?.[0],
      campTimeEnd: params.params.campTimeRange?.[1],
      page: params.page,
      pageSize: params.pageSize,
    }

    console.log('getList:queryParams', queryParams)

    const res = await getSubOrderList(queryParams)
    return {
      list: res.list || [],
      total: res.total !== undefined ? res.total : (res.list?.length || 0),
    }
  } catch (error) {
    console.error('获取子订单列表失败:', error)
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
const handleSelectionChange = (rows: SubOrderItem[]) => {
  selectedRows.value = rows
}

/**
 * 处理导出订单
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
      paymentTimeStart: searchForm.params.paymentTimeRange?.[0],
      paymentTimeEnd: searchForm.params.paymentTimeRange?.[1],
      orderStatus: searchForm.params.orderStatus,
      phone: searchForm.params.phone,
      goodType: searchForm.params.goodType,
      refundTimeStart: searchForm.params.refundTimeRange?.[0],
      refundTimeEnd: searchForm.params.refundTimeRange?.[1],
      serviceStatus: searchForm.params.serviceStatus,
      campTimeStart: searchForm.params.campTimeRange?.[0],
      campTimeEnd: searchForm.params.campTimeRange?.[1],
    }

    // 调用导出API获取下载URL
    const res = await exportSubOrders(queryParams)

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
 * 获取实收金额显示内容
 * @param row 订单行数据
 * @returns 实收金额显示文本
 */
const getReceiptAmountDisplay = (row: SubOrderItem) => {
  if (
    row.receiptAmount !== undefined &&
    row.receiptAmount !== null &&
    row.receiptAmount > 0
  ) {
    return formatMoney(row.receiptAmount)
  }
  return '--'
}

/**
 * 获取优惠金额显示内容
 * @param row 订单行数据
 * @returns 优惠金额显示文本
 */
const getDiscountAmountDisplay = (row: SubOrderItem) => {
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
const getPlatformDiscountAmountDisplay = (row: SubOrderItem) => {
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
const getPaymentDiscountAmountDisplay = (row: SubOrderItem) => {
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
const getShopDiscountAmountDisplay = (row: SubOrderItem) => {
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
const getActualInsuredDisplay = (row: SubOrderItem) => {
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
const getTalentCommissionDisplay = (row: SubOrderItem) => {
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
const getPlatformFeeDisplay = (row: SubOrderItem) => {
  if (
    row.platformFee !== undefined &&
    row.platformFee !== null
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
const getRefundAmountDisplay = (row: SubOrderItem) => {
  if (
    row.refundAmount !== undefined &&
    row.refundAmount !== null
  ) {
    return formatMoney(row.refundAmount)
  }
  return '--'
}

/**
 * 根据渠道ID获取渠道名称
 * @param channelId 渠道ID
 * @returns 渠道名称
 */
const getChannelName = (channelId: string): string => {
  if (!channelId) return '--'
  const channel = channelOptions.value.find((item) => item.value === channelId)
  return channel ? channel.label : '--'
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

// 初始化
onMounted(() => {
  // 加载渠道列表
  loadChannelOptions()
})
</script>

<style scoped>
.sub-order-management-container {
  padding: 0;
}
</style>
