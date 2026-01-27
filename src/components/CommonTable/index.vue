<template>
  <div class="common-table">
    <el-card class="common-table__nav" v-if="!!slots.header || showSearch">
      <!-- 顶部插槽 -->
      <div class="common-table__header" v-if="!!slots.header">
        <slot name="header"></slot>
      </div>

      <!-- 搜索区域 -->
      <div class="common-table__search" v-if="showSearch">
        <el-form :model="searchForm" inline ref="searchFormRef">
          <slot name="search-items"></slot>

          <!-- 操作按钮区域 -->
          <el-form-item class="search-buttons">
            <el-button type="primary" @click="handleSearch">搜索</el-button>
            <el-button @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-card>

    <!-- 表格区域 -->
    <el-card class="common-table__content">
      <div class="common-table__extra-button" v-if="!!slots['extra-buttons']">
        <slot name="extra-buttons"></slot>
      </div>
      <!-- 标签区域 -->
      <div class="common-table__tabs" v-if="!!slots['tabs']">
        <slot name="tabs"></slot>
      </div>

      <el-table v-loading="loading" :data="tableData" style="width: 100%" @selection-change="handleSelectionChange"
        height="100%" :rowKey="rowKey" :cell-class-name="cellClassName">
        <slot></slot>
      </el-table>

      <!-- 分页 -->
      <div class="common-table__pagination">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[10, 20, 50, 100]"
          :default-page-size="props.pageSize" :total="total" @size-change="handleSizeChange"
          @current-change="handleCurrentChange" layout="total, sizes, prev, pager, next, jumper" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * 通用表格组件
 *
 * 使用说明：
 * 1. 组件集成了搜索、表格、分页功能
 * 2. 支持自定义搜索条件和表格列
 * 3. 提供多个插槽用于自定义内容
 * 4. 支持表格数据的刷新和重置
 * 5. 支持表格多选功能
 *
 * 示例：
 * ```vue
 * <CommonTable
 *   ref="tableRef"
 *   :fetch-data="getList"
 *   :search-form="searchForm"
 *   :show-search="true"
 *   @selection-change="handleSelectionChange"
 * >
 *   <!-- 搜索条件 -->
 *   <template #search-items>
 *     <el-form-item label="名称">
 *       <el-input v-model="searchForm.name" />
 *     </el-form-item>
 *   </template>
 *
 *   <!-- 表格选择列 -->
 *   <el-table-column type="selection" width="55" />
 *
 *   <!-- 表格列 -->
 *   <el-table-column prop="name" label="名称" />
 * </CommonTable>
 * ```
 */

import { ref, onMounted, useSlots } from 'vue'
import type { FormInstance, TableProps } from 'element-plus'
import { debug } from 'console'

/**
 * 组件属性定义
 * @interface Props
 * @property {Function} fetchData - 获取表格数据的方法，需要返回 { list: any[], total: number }
 * @property {Object} searchForm - 搜索表单数据对象
 * @property {number} [pageSize=20] - 默认每页显示条数
 * @property {boolean} [showSearch=true] - 是否显示搜索区域
 */
interface Props extends Omit<TableProps<any>, 'data'> {
  fetchData: (params: any) => Promise<{ list: any[]; total: number }>
  searchForm?: Record<string, any>
  defaultSearchForm?: Record<string, any>
  resetSearchForm?: () => void
  pageSize?: number
  showSearch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showSearch: true,
  searchForm: () => ({}),
  defaultSearchForm: () => ({}),
  resetSearchForm: () => { },
  pageSize: 20,
  rowKey: 'id',
})

const slots = useSlots()

// 定义事件
const emit = defineEmits(['selection-change'])

/**
 * 表单相关
 */
const searchFormRef = ref<FormInstance>()
const defaultSearchForm = structuredClone(
  props.defaultSearchForm || props.searchForm,
)

/**
 * 表格相关状态
 */
const loading = ref(false)
const tableData = ref<any[]>([])
const currentPage = ref(1)
const pageSize = ref(props.pageSize)
const total = ref(0)
const selectedRows = ref<any[]>([])

/**
 * 对外暴露的方法
 * refresh: 刷新表格数据
 * reset: 重置搜索条件和表格数据
 * getSelectedRows: 获取选中的行数据
 * clearSelection: 清空表格选择
 */
defineExpose({
  refresh,
  reset: handleReset,
  getSelectedRows: () => selectedRows.value,
  clearSelection: () => {
    selectedRows.value = []
  },
})

/**
 * 加载表格数据
 * 合并分页参数和搜索条件
 */
async function loadData() {
  loading.value = true
  try {
    const params = {
      ...props.searchForm,
      page: currentPage.value,
      pageSize: pageSize.value,
    }
    const { list, total: totalCount } = await props.fetchData(params)
    tableData.value = list
    total.value = totalCount
  } catch (error) {
    console.error('加载数据失败：', error)
  } finally {
    loading.value = false
  }
}

/**
 * 刷新表格数据
 * 保持当前页码和每页条数
 */
function refresh() {
  loadData()
}

/**
 * 处理搜索操作
 * 重置页码到第一页
 */
function handleSearch() {
  currentPage.value = 1
  loadData()
}

/**
 * 重置搜索条件和表格数据
 * 恢复默认搜索条件
 */
function handleReset() {
  if (searchFormRef.value) {
    searchFormRef.value.resetFields()
    // 深层重置搜索表单，确保嵌套对象也被重置
    Object.keys(defaultSearchForm).forEach((key) => {
      if (
        typeof defaultSearchForm[key] === 'object' &&
        defaultSearchForm[key] !== null
      ) {
        props.searchForm[key] = JSON.parse(
          JSON.stringify(defaultSearchForm[key]),
        )
      } else {
        props.searchForm[key] = defaultSearchForm[key]
      }
    })
  }
  currentPage.value = 1
  loadData()
  props.resetSearchForm()
}

/**
 * 处理每页显示条数变化
 */
function handleSizeChange(val: number) {
  pageSize.value = val
  loadData()
}

/**
 * 处理页码变化
 */
function handleCurrentChange(val: number) {
  currentPage.value = val
  loadData()
}

/**
 * 处理表格多选
 * 并触发selection-change事件
 */
function handleSelectionChange(val: any[]) {
  selectedRows.value = val
  emit('selection-change', val)
}

// 组件挂载时加载数据
onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
/**
 * 组件样式定义
 * 使用 BEM 命名规范
 */
.common-table {
  height: 100%;
  display: flex;
  flex-direction: column;

  &__nav {
    margin-bottom: 10px;
  }

  &__header {
    padding: 10px;
  }

  &__search {
    padding: 10px;
    background: #fff;
    border-radius: 4px;

    .search-buttons {
      margin-left: 16px;
    }
  }

  &__content {
    background: #fff;
    padding: 10px;
    border-radius: 4px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 200px;

    .el-table {
      flex: 1;
    }
  }

  &__pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }

  &__extra-button {
    margin-bottom: 20px;
  }
}
</style>
