<template>
  <el-dialog
    v-model="dialogVisible"
    :title="`操作日志 - ${couponData?.name || ''}`"
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
        <el-table-column prop="updatedByName" label="操作者" align="center" />
        <el-table-column prop="operationType" label="执行操作" align="center">
          <template #default="{ row }">
            <el-tag :type="getOperationType(row.operationType)" size="small">
              {{ row.operationType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="操作时间" align="center">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
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
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CouponItem, SysDataLogInfo } from '../service.type'
import { getSysDataLogList } from '../service'
import dayjs from 'dayjs'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  couponData: {
    type: Object as () => CouponItem | null,
    default: null,
  },
})

const emit = defineEmits(['update:visible'])

const dialogVisible = ref(props.visible)
const loading = ref(false)
const logList = ref<SysDataLogInfo[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

watch(
  () => props.visible,
  (newVal) => {
    dialogVisible.value = newVal
    if (newVal && props.couponData) {
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
  if (!props.couponData) return

  try {
    loading.value = true

    const res = await getSysDataLogList({
      page: currentPage.value,
      pageSize: pageSize.value,
      module: '优惠券',
      operatorId: props.couponData.id,
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
 * 获取操作类型样式
 */
const getOperationType = (operation: string): string => {
  switch (operation) {
    case '新建':
    case '创建':
      return 'primary'
    case '上架':
      return 'success'
    case '下架':
      return 'warning'
    case '编辑':
    case '修改':
      return 'info'
    case '删除':
      return 'danger'
    default:
      return 'info'
  }
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

  // 数据内容
  .data-content {
    max-height: 100px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 12px;
    font-family: 'Courier New', monospace;
    padding: 4px 8px;
    background-color: #f5f7fa;
    border-radius: 4px;

    // 滚动条样式
    &::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }

    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 2px;
    }

    &::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 2px;

      &:hover {
        background: #a8a8a8;
      }
    }
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
