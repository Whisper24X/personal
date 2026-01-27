<template>
  <el-dialog
    v-model="dialogVisible"
    :title="`订单日志 - ${orderData?.orderNumber || ''}`"
    width="1000px"
    :before-close="handleClose"
  >
    <div class="log-container">
      <el-table
        :data="logList"
        stripe
        class="log-table"
        empty-text="暂无操作记录"
        v-loading="loading"
      >
        <el-table-column
          prop="updatedByName"
          label="操作者"
          align="center"
          min-width="120"
        />
        <el-table-column
          prop="operationType"
          label="执行操作"
          align="center"
          min-width="140"
        >
          <template #default="{ row }">
            {{ formatOperationType(row.operationType) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="createdAt"
          label="操作时间"
          align="center"
          min-width="160"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="remark"
          label="操作原因"
          align="center"
          min-width="200"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.remark || '无' }}
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div v-if="total > 0" class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>

      <div v-if="logList.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无操作记录" :image-size="80" />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="handleClose">确定</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { OrderItem } from '../../service.type'
import { getOrderLogList } from '../../service'
import dayjs from 'dayjs'

interface LogItem {
  id: string
  operationType: string
  operatorId: string
  oldData: string
  newData: string
  createdAt: string
  updatedBy: string
  updatedByName: string
  module: string
  remark: string
}

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  orderData: {
    type: Object as () => OrderItem | undefined,
    default: undefined,
  },
})

const emit = defineEmits(['update:visible'])

const dialogVisible = ref(props.visible)
const loading = ref(false)
const logList = ref<LogItem[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

watch(
  () => props.visible,
  (newVal) => {
    dialogVisible.value = newVal
    if (newVal && props.orderData) {
      currentPage.value = 1
      loadLogData()
    }
  },
)

watch(
  () => dialogVisible.value,
  (newVal) => {
    emit('update:visible', newVal)
  },
)

/**
 * 加载日志数据
 */
const loadLogData = async () => {
  if (!props.orderData) return

  try {
    loading.value = true

    const res = await getOrderLogList({
      page: currentPage.value,
      pageSize: pageSize.value,
      module: '订单',
      operatorId: props.orderData.id,
    })

    logList.value = res.list || []
    total.value = res.total || 0
  } catch (error) {
    console.error('加载日志失败:', error)
    ElMessage.error('加载日志失败')
    logList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

/**
 * 处理分页大小变化
 */
const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
  loadLogData()
}

/**
 * 处理页码变化
 */
const handleCurrentChange = (val: number) => {
  currentPage.value = val
  loadLogData()
}

/**
 * 格式化操作类型
 */
const formatOperationType = (operationType: string): string => {
  // 如果已经是中文，直接返回
  if (
    operationType === '修改订单状态' ||
    operationType === '操作退款' ||
    operationType === '修改手机号' ||
    operationType === '转为已退款'
  ) {
    return operationType
  }

  // 根据接口返回的操作类型转换为中文
  const typeMap: Record<string, string> = {
    modify_order_status: '修改订单状态',
    refund: '操作退款',
    modify_phone: '修改手机号',
    convert_to_refunded: '转为已退款',
    修改订单状态: '修改订单状态',
    操作退款: '操作退款',
    修改手机号: '修改手机号',
    转为已退款: '转为已退款',
  }
  return typeMap[operationType] || operationType
}

/**
 * 格式化日期时间
 */
const formatDateTime = (dateTimeString: string): string => {
  if (!dateTimeString) return '--'
  return dayjs(dateTimeString).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * 处理对话框关闭
 */
const handleClose = () => {
  dialogVisible.value = false
  logList.value = []
  currentPage.value = 1
  total.value = 0
}
</script>

<style lang="scss" scoped>
// 日志容器
.log-container {
  min-height: 200px;

  // 日志表格
  .log-table {
    width: 100%;
    margin-bottom: 16px;
  }

  // 分页容器
  .pagination-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  // 空状态
  .empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
  }
}

// 对话框底部
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

// 表格样式优化
:deep(.el-table) {
  font-size: 14px;

  th {
    background-color: #fafbfc;
    font-weight: 600;
  }

  td {
    padding: 12px 0;
  }
}
</style>
