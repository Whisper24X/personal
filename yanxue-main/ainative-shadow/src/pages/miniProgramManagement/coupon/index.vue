<template>
  <div class="coupon-management-container">
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
        <el-form :inline="true" :model="searchForm.params" label-width="80px">
          <el-form-item label="优惠券名称" label-width="100">
            <el-input
              v-model="searchForm.params.name"
              placeholder="请输入优惠券名称"
              clearable
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item label="推送方式">
            <el-select
              v-model="searchForm.params.pushType"
              placeholder="请选择推送方式"
              clearable
              style="width: 160px"
            >
              <el-option
                v-for="item in PUSH_METHOD_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select
              v-model="searchForm.params.status"
              placeholder="请选择状态"
              clearable
              style="width: 150px"
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
        <el-button type="primary" @click="handleAdd">新建优惠券</el-button>
      </template>

      <!-- 表格列定义 -->
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column
        prop="id"
        label="优惠券ID"
        min-width="100"
        align="center"
      />
      <el-table-column
        prop="name"
        label="优惠券名称"
        min-width="150"
        align="center"
      />
      <el-table-column
        prop="couponType"
        label="券类型"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ row.couponType === 'common' ? '通用' : '商品' }}
        </template>
      </el-table-column>
      <el-table-column
        prop="minAmount"
        label="门槛"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ row.minAmount === 0 ? '无门槛' : `${row.minAmount}元` }}
        </template>
      </el-table-column>
      <el-table-column
        prop="discountAmount"
        label="优惠金额"
        min-width="100"
        align="center"
      >
        <template #default="{ row }"> {{ row.discountAmount }}元 </template>
      </el-table-column>
      <el-table-column label="状态" min-width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="pushType"
        label="推送方式"
        min-width="120"
        align="center"
      >
        <template #default="{ row }">
          {{ row.pushType === 'public' ? '公开' : '私密' }}
        </template>
      </el-table-column>
      <el-table-column label="领取时间" min-width="240" align="center">
        <template #default="{ row }">
          {{
            row.claimStartTime && row.claimEndTime
              ? `${row.claimStartTime}到${row.claimEndTime}`
              : '--'
          }}
        </template>
      </el-table-column>
      <el-table-column label="使用时间" min-width="240" align="center">
        <template #default="{ row }">
          {{
            row.validStartTime && row.validEndTime
              ? `${row.validStartTime}到${row.validEndTime}`
              : '--'
          }}
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        min-width="200"
        align="center"
        fixed="right"
      >
        <template #default="{ row }">
          <div class="operation-buttons">
            <el-button type="primary" link @click="handleView(row)">
              查看
            </el-button>
            <el-button
              :type="row.status === 'putOn' ? 'warning' : 'success'"
              link
              @click="
                handleStatusChange(
                  row,
                  row.status === 'putOn' ? 'putOff' : 'putOn',
                )
              "
            >
              {{ row.status === 'putOn' ? '下架' : '上架' }}
            </el-button>
            <el-button type="info" link @click="handleLog(row)">
              日志
            </el-button>
          </div>
        </template>
      </el-table-column>
    </CommonTable>

    <!-- 新建优惠券对话框 -->
    <CreateCouponDialog
      v-model:visible="createDialogVisible"
      @success="handleOperationSuccess"
    />

    <!-- 优惠券详情查看对话框 -->
    <CouponDetailDialog
      v-model:visible="detailDialogVisible"
      :couponData="selectedItem"
    />

    <!-- 操作日志对话框 -->
    <CouponLogDialog
      v-model:visible="logDialogVisible"
      :couponData="selectedItem"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 优惠券列表管理页面
 */

import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import CreateCouponDialog from './components/CreateCouponDialog.vue'
import CouponDetailDialog from './components/CouponDetailDialog.vue'
import CouponLogDialog from './components/CouponLogDialog.vue'
import { getCouponList, updateCouponStatus } from './service'
import {
  CouponItem,
  CouponStatus,
  STATUS_OPTIONS,
  PUSH_METHOD_OPTIONS,
  getStatusType,
  getStatusLabel,
} from './service.type'

// 页面状态管理
const loading = ref(false)
const tableRef = ref<InstanceType<typeof CommonTable> | null>(null)
const selectedRows = ref<CouponItem[]>([])

// 对话框状态
const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const logDialogVisible = ref(false)

// 选中的数据
const selectedItem = ref<CouponItem | undefined>(undefined)

/**
 * 查询参数接口定义
 */
interface SearchParams {
  name: string
  pushType: string
  status: string
}

/**
 * 查询表单接口定义
 */
interface SearchForm {
  page: number
  pageSize: number
  params: SearchParams
}

/**
 * 查询表单数据
 */
const searchForm = reactive<SearchForm>({
  page: 1,
  pageSize: 10,
  params: {
    name: '',
    pushType: '',
    status: '',
  },
})

const defaultSearchForm = reactive<SearchForm>({
  page: 1,
  pageSize: 10,
  params: {
    name: '',
    pushType: '',
    status: '',
  },
})

/**
 * 获取优惠券列表数据
 * @param params 查询参数
 * @returns 返回列表数据和总数
 */
const getList = async (params: SearchForm) => {
  try {
    loading.value = true

    const queryParams = {
      name: params.params.name,
      pushType: params.params.pushType,
      status: params.params.status,
      page: params.page,
      pageSize: params.pageSize,
    }

    console.log('getList:queryParams', queryParams)

    const res = await getCouponList(queryParams)
    return {
      list: res.list,
      total: res.total,
    }
  } catch (error) {
    console.error('获取优惠券列表失败:', error)
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
const handleSelectionChange = (rows: CouponItem[]) => {
  selectedRows.value = rows
}

/**
 * 处理新增优惠券
 */
const handleAdd = () => {
  createDialogVisible.value = true
}

/**
 * 处理查看优惠券
 * @param row 优惠券行数据
 */
const handleView = (row: CouponItem) => {
  selectedItem.value = row
  detailDialogVisible.value = true
}

/**
 * 处理日志查看
 * @param row 优惠券行数据
 */
const handleLog = (row: CouponItem) => {
  selectedItem.value = row
  logDialogVisible.value = true
}

/**
 * 处理状态变更（上架/下架）
 * @param row 优惠券行数据
 * @param newStatus 新状态
 */
const handleStatusChange = async (row: CouponItem, newStatus: string) => {
  const actionText = newStatus === 'putOn' ? '上架' : '下架'

  try {
    await ElMessageBox.confirm(
      `确定要${actionText}优惠券"${row.name}"吗？`,
      `${actionText}确认`,
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    await updateCouponStatus({
      id: row.id,
      status: newStatus,
    })

    ElMessage.success(`${actionText}成功`)

    if (tableRef.value) {
      tableRef.value.refresh()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error(`${actionText}失败:`, error)
      ElMessage.error(`${actionText}失败，请稍后重试`)
    }
  }
}

/**
 * 处理操作成功（刷新表格）
 */
const handleOperationSuccess = () => {
  if (tableRef.value) {
    tableRef.value.refresh()
  }
}

// 初始化
onMounted(() => {
  // 这里可以添加一些初始化逻辑
})
</script>

<style scoped>
.coupon-management-container {
  padding: 0;
}

.operation-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 优化表格单元格内容显示 */
:deep(.el-table .cell) {
  padding: 8px 4px;
}

/* 优化操作按钮的显示 */
.operation-buttons .el-button {
  margin: 0;
  padding: 4px 8px;
}
</style>
