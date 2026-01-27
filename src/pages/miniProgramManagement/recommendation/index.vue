<template>
    <div class="recommendation-management-container">
        <CommonTable ref="tableRef" v-loading="loading" :fetch-data="getList" :search-form="searchForm"
            :default-search-form="defaultSearchForm" :show-search="false" :show-extra-buttons="true"
            @selection-change="handleSelectionChange">
            <!-- 搜索条件 -->
            <template #search-items>
                <el-form :inline="true" :model="searchForm.params">
                    <el-form-item label="分类名称">
                        <el-input v-model="searchForm.params.categoryName" placeholder="请输入分类名称" clearable
                            style="width: 220px" />
                    </el-form-item>
                    <el-form-item label="状态">
                        <el-select v-model="searchForm.params.status" placeholder="请选择" clearable style="width: 140px">
                            <el-option v-for="item in STATUS_OPTIONS" :key="item.value" :label="item.label"
                                :value="item.value" />
                        </el-select>
                    </el-form-item>
                </el-form>
            </template>

            <!-- 额外按钮 -->
            <template #extra-buttons>
                <el-button type="primary" @click="handleAdd">新增分类</el-button>
            </template>

            <!-- 表格列定义 -->
            <el-table-column prop="name" label="分类名称" min-width="150" align="center" />
            <el-table-column label="分类图标" min-width="100" align="center">
                <template #default="{ row }">
                    <el-image v-if="row.icon" :src="row.icon" style="width: 32px; height: 32px; border-radius: 4px;"
                        fit="cover" :preview-src-list="[row.icon]" preview-teleported>
                        <template #error>
                            <div class="image-error">
                                <el-icon>
                                    <Picture />
                                </el-icon>
                            </div>
                        </template>
                    </el-image>
                    <div v-else class="image-placeholder">
                        <el-icon>
                            <Picture />
                        </el-icon>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="状态" min-width="100" align="center">
                <template #default="{ row }">
                    <el-tag :type="getStatusType(row.status)">
                        {{ getStatusLabel(row.status) }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="sortOrder" label="排序" min-width="100" align="center" />
            <el-table-column label="关联商品数量" min-width="120" align="center">
                <template #default="{ row }">
                    {{ row.goodItems ? row.goodItems.length : 0 }}
                </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" min-width="160" align="center">
                <template #default="{ row }">
                    {{ formatDateTime(row.updatedAt) }}
                </template>
            </el-table-column>
            <el-table-column prop="updatedByName" label="修改人" min-width="100" align="center" />
            <el-table-column label="操作" min-width="280" align="center" fixed="right">
                <template #default="{ row }">
                    <el-button type="primary" link @click="handleConfigGoods(row)">
                        配置商品
                    </el-button>
                    <el-button type="primary" link @click="handleEdit(row)">
                        编辑
                    </el-button>
                    <el-button v-if="row.status === -1" type="success" link @click="handleStatusChange(row, 1)">
                        上架
                    </el-button>
                    <el-button v-if="row.status === 1" type="warning" link @click="handleStatusChange(row, -1)">
                        下架
                    </el-button>
                </template>
            </el-table-column>
        </CommonTable>

        <!-- 新增/编辑对话框 -->
        <AddEditDialog v-model:visible="addEditDialogVisible" :editData="selectedItem"
            @success="handleOperationSuccess" />

        <!-- 配置商品对话框 -->
        <ConfigGoodsDialog v-model:visible="configGoodsDialogVisible" :categoryData="selectedItem"
            @success="handleOperationSuccess" />
    </div>
</template>

<script setup lang="ts">
/**
 * 推荐管理页面
 */

// 导入所需的组件和工具
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture } from '@element-plus/icons-vue'
import CommonTable from '@/components/CommonTable/index.vue'
import AddEditDialog from './components/AddEditDialog/index.vue'
import ConfigGoodsDialog from './components/ConfigGoodsDialog/index.vue'
import {
    getRecommendationList,
    updateRecommendationStatus
} from './service'
import {
    RecommendationItem,
    STATUS_OPTIONS,
    getStatusType,
    getStatusLabel
} from './service.type'
import dayjs from 'dayjs'

// 页面状态管理
const loading = ref(false)
const tableRef = ref<InstanceType<typeof CommonTable> | null>(null)
const selectedRows = ref<RecommendationItem[]>([])

// 对话框显示状态
const addEditDialogVisible = ref(false)
const configGoodsDialogVisible = ref(false)

// 选中的数据
const selectedItem = ref<RecommendationItem | undefined>(undefined)

/**
 * 查询参数接口定义
 */
interface SearchParams {
    categoryName: string
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
        categoryName: '',
        status: ''
    }
})

const defaultSearchForm = reactive<SearchForm>({
    page: 1,
    pageSize: 10,
    params: {
        categoryName: '',
        status: ''
    }
})

/**
 * 获取推荐分类列表数据
 * @param params 查询参数
 * @returns 返回列表数据和总数
 */
const getList = async (params: SearchForm) => {
    try {
        loading.value = true

        const queryParams = {
            categoryName: params.params.categoryName,
            status: params.params.status,
            page: params.page,
            pageSize: params.pageSize
        }

        console.log('getList:queryParams', queryParams)

        const res = await getRecommendationList(queryParams)
        return {
            list: res.list,
            total: res.total
        }
    } catch (error) {
        console.error('获取推荐分类列表失败:', error)
        return {
            list: [],
            total: 0
        }
    } finally {
        loading.value = false
    }
}

/**
 * 处理表格选择行变化
 * @param rows 选中的行
 */
const handleSelectionChange = (rows: RecommendationItem[]) => {
    selectedRows.value = rows
}

/**
 * 处理新增分类
 */
const handleAdd = () => {
    selectedItem.value = undefined
    addEditDialogVisible.value = true
}

/**
 * 处理编辑分类
 * @param row 分类行数据
 */
const handleEdit = (row: RecommendationItem) => {
    selectedItem.value = row
    addEditDialogVisible.value = true
}

/**
 * 处理配置商品
 * @param row 分类行数据
 */
const handleConfigGoods = (row: RecommendationItem) => {
    selectedItem.value = row
    configGoodsDialogVisible.value = true
}

/**
 * 处理状态变更（上架/下架）
 * @param row 分类行数据
 * @param newStatus 新状态
 */
const handleStatusChange = async (row: RecommendationItem, newStatus: number) => {
    const actionText = newStatus === 1 ? '上架' : '下架'

    try {
        await ElMessageBox.confirm(
            `确定要${actionText}分类"${row.name}"吗？`,
            `${actionText}确认`,
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }
        )

        await updateRecommendationStatus({
            id: row.id,
            status: newStatus
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
 * 处理操作成功
 */
const handleOperationSuccess = () => {
    if (tableRef.value) {
        tableRef.value.refresh()
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

// 初始化
onMounted(() => {
    // 这里可以添加一些初始化逻辑
})
</script>

<style scoped>
.recommendation-management-container {
    padding: 0;
}

.image-error,
.image-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background-color: #f5f7fa;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    color: #c0c4cc;
    font-size: 14px;
}

.image-error:hover,
.image-placeholder:hover {
    background-color: #ecf5ff;
    border-color: #b3d8ff;
    color: #409eff;
}
</style>