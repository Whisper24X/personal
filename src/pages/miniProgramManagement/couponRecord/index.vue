<template>
  <div class="coupon-record-container">
    <CommonTable
      ref="tableRef"
      :fetch-data="getCouponRecordList"
      :search-form="searchParams"
      :default-search-form="defaultSearchParams"
      :reset-search-form="resetSearchForm"
      :page-size="10"
      :show-search="true"
    >
      <!-- 搜索条件 -->
      <template #search-items>
        <el-form-item label="状态">
          <el-select
            v-model="searchParams.status"
            placeholder="请选择状态"
            clearable
            style="width: 120px"
          >
            <el-option
              v-for="option in STATUS_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="优惠券名称">
          <el-input
            v-model="searchParams.couponName"
            placeholder="请输入优惠券名称"
            clearable
            style="width: 200px"
          />
        </el-form-item>

        <el-form-item label="用户手机">
          <el-input
            v-model="searchParams.phone"
            placeholder="请输入用户手机号"
            clearable
            style="width: 200px"
          />
        </el-form-item>

        <el-form-item label="领取时间">
          <el-date-picker
            v-model="claimTimeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 380px"
            @change="handleClaimTimeChange"
          />
        </el-form-item>

        <el-form-item label="到期时间">
          <el-date-picker
            v-model="expireTimeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 380px"
            @change="handleExpireTimeChange"
          />
        </el-form-item>
      </template>

      <!-- 表格列 -->
      <el-table-column prop="id" label="ID" align="center" />
      <el-table-column
        prop="couponName"
        label="优惠券名称"
        min-width="150"
        align="center"
      />
      <el-table-column prop="status" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="ph" label="用户手机号" align="center" />
      <el-table-column
        prop="pushType"
        label="推送方式"
        width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ getPushTypeLabel(row.pushType) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="claimTime"
        label="领取时间"
        width="180"
        align="center"
      >
        <template #default="{ row }">
          {{ formatTime(row.claimTime) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="expireTime"
        label="到期时间"
        width="180"
        align="center"
      >
        <template #default="{ row }">
          {{ formatTime(row.expireTime) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="orderNumber"
        label="订单编号"
        width="180"
        align="center"
      >
        <template #default="{ row }">
          {{ row.orderNumber || '—' }}
        </template>
      </el-table-column>
      <el-table-column
        prop="useTime"
        label="使用时间"
        width="180"
        align="center"
      >
        <template #default="{ row }">
          {{ formatTime(row.useTime) }}
        </template>
      </el-table-column>
    </CommonTable>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import CommonTable from '@/components/CommonTable/index.vue'
import { getCouponRecordList } from './service'
import {
  STATUS_OPTIONS,
  getStatusType,
  getStatusLabel,
  getPushTypeLabel,
} from './service.type'
import { formatTime } from '@/utils/date'

// 搜索参数类型（不包含分页参数，因为CommonTable会自动处理）
interface SearchParams {
  status: string
  couponName: string
  phone: string
  claimStartTime: string
  claimEndTime: string
  expireTimeStartTime: string
  expireTimeEndTime: string
}

// 表格引用
const tableRef = ref()

// 搜索参数
const searchParams = reactive<SearchParams>({
  status: '',
  couponName: '',
  phone: '',
  claimStartTime: '',
  claimEndTime: '',
  expireTimeStartTime: '',
  expireTimeEndTime: '',
})

// 默认搜索参数（用于重置）
const defaultSearchParams = reactive<SearchParams>({
  status: '',
  couponName: '',
  phone: '',
  claimStartTime: '',
  claimEndTime: '',
  expireTimeStartTime: '',
  expireTimeEndTime: '',
})

// 时间范围
const claimTimeRange = ref<[string, string] | null>(null)
const expireTimeRange = ref<[string, string] | null>(null)

/**
 * 处理领取时间变化
 */
const handleClaimTimeChange = (value: [string, string] | null) => {
  if (value) {
    searchParams.claimStartTime = value[0]
    searchParams.claimEndTime = value[1]
  } else {
    searchParams.claimStartTime = ''
    searchParams.claimEndTime = ''
  }
}

/**
 * 处理到期时间变化
 */
const handleExpireTimeChange = (value: [string, string] | null) => {
  if (value) {
    searchParams.expireTimeStartTime = value[0]
    searchParams.expireTimeEndTime = value[1]
  } else {
    searchParams.expireTimeStartTime = ''
    searchParams.expireTimeEndTime = ''
  }
}

/**
 * 重置搜索表单
 */
const resetSearchForm = () => {
  Object.assign(searchParams, defaultSearchParams)
  claimTimeRange.value = null
  expireTimeRange.value = null
}
</script>

<style lang="scss" scoped>
.coupon-record-container {
  background-color: #fff;
  border-radius: 8px;
  min-height: calc(100vh - 120px);
}
</style>
