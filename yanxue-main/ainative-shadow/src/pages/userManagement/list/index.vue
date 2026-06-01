<template>
    <div class="user-container">
        <div class="table-wrapper">
            <CommonTable ref="tableRef" v-loading="loading" :fetch-data="getList" :search-form="searchForm"
                :show-search="true" :show-extra-buttons="true" :show-search-buttons="false" @search="handleQuery"
                :resetSearchForm="resetQuery">
                <!-- 搜索条件 -->
                <template #search-items>
                    <el-form :inline="true" :model="searchForm">
                        <el-form-item label="手机号">
                            <el-input v-model="searchForm.phone" placeholder="请输入手机号" clearable />
                        </el-form-item>
                    </el-form>
                </template>
                <!-- 表格列定义 -->
                <el-table-column prop="phone" label="手机号" min-width="120" align="center" />
                <el-table-column prop="nickname" label="用户昵称" min-width="120" align="center" />
                <el-table-column prop="userWxInfo.unionid" label="微信unionid" min-width="180" align="center" />
                <el-table-column prop="userWxInfo.miniprogramOpenId" label="小程序openid" min-width="180" align="center" />
                <el-table-column prop="userWxInfo.offiaccountOpenId" label="公众号openid" min-width="180" align="center" />
                <el-table-column prop="userWxInfo.offiaccountFollow" label="公众号是否关注" align="center">
                    <template #default="{ row }">
                        <el-tag :type="row.userWxInfo.offiaccountFollow ? 'success' : 'danger'">
                            {{ row.userWxInfo.offiaccountFollow ? '是' : '否' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="userWxInfo.nickname" label="微信昵称" min-width="120" align="center" />   
                <el-table-column prop="userWxInfo.headimgurl" label="微信头像" min-width="120" align="center">  
                    <template #default="{ row }">
                        <el-image v-if="row.userWxInfo && row.userWxInfo.headimgurl" 
                                 :src="row.userWxInfo.headimgurl" 
                                 style="width: 50px; height: 50px;" 
                                 fit="cover" />
                    </template>
                </el-table-column>
                <el-table-column prop="userWxInfo.sex" label="性别" min-width="120" align="center">
                    <template #default="{ row }">
                        {{ row.userWxInfo.sex === 1 ? '男' : row.userWxInfo.sex === 2 ? '女' : '' }}
                    </template>
                </el-table-column>
                <el-table-column prop="userWxInfo.country" label="国家" min-width="120" align="center" />
                <el-table-column prop="userWxInfo.province" label="省份" min-width="120" align="center" />
                <el-table-column prop="userWxInfo.city" label="城市" min-width="120" align="center" />
                <el-table-column prop="createdAt" label="绑定时间" align="center" min-width="120">
                    <template #default="{ row }">
                        {{ formatDateTime(row.createdAt) }}
                    </template>
                </el-table-column>
                <!-- <el-table-column prop="status" label="状态" align="center">
                    <template #default="{ row }">
                        <el-tag :type="row.status === 1 ? 'success' : 'danger'">
                            {{ row.status === 1 ? '正常' : '禁用' }}
                        </el-tag>
                    </template>
                </el-table-column> -->
                <el-table-column label="操作" align="center" width="200" fixed="right">
                    <template #default="{ row }">
                        <el-button v-if="row.userWxInfo && row.userWxInfo.unionid" type="primary" link
                            @click="handleUnbind(row)">
                            解绑
                        </el-button>
                        <!-- <el-button :type="row.status === 1 ? 'danger' : 'success'" link
                            @click="handleStatusChange(row)">
                            {{ row.status === 1 ? '禁用' : '启用' }}
                        </el-button> -->
                    </template>
                </el-table-column>
            </CommonTable>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * 用户管理页面
 * 实现用户的解绑等功能
 * 支持按手机号筛选
 */

// 导入所需的组件和工具
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import {
    getUserList,
    unbindUserWx,
    updateUserStatus,
    type User,
} from './service'
import { formatDateTime } from '@/utils/date'

// 页面状态管理
const loading = ref(false) // 加载状态
const tableRef = ref<InstanceType<typeof CommonTable> | null>(null) // 表格实例引用


/**
 * 查询表单接口定义
 * @interface SearchForm
 * @property {number} page - 当前页码
 * @property {number} pageSize - 每页条数
 * @property {SearchParams} params - 查询参数
 */
interface SearchForm {
    page: number // 当前页码
    pageSize: number // 每页条数
    phone: string // 手机号查询条件
}

/**
 * 查询表单数据
 * 包含分页信息和查询条件
 */
const searchForm = reactive<SearchForm>({
    page: 1,
    pageSize: 10,
    phone: '',
})

/**
 * 获取用户列表数据
 * @param params 查询参数
 * @returns 返回列表数据和总数
 */
const getList = async (params: SearchForm) => {
    try {
        loading.value = true
        const res = await getUserList({
            phone: params.phone,
            page: params.page,
            pageSize: params.pageSize,
        })
        return {
            list: res.list || [],
            total: res.total || 0,
        }
    } catch (error) {
        console.error('获取用户列表失败:', error)
        ElMessage.error('获取用户列表失败')
        return {
            list: [],
            total: 0,
        }
    } finally {
        loading.value = false
    }
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
    // 直接设置各个字段，确保响应式更新
    searchForm.page = 1
    searchForm.pageSize = 10
    searchForm.phone = ''

    // 确保表格刷新
    handleQuery()
}

/**
 * 解绑用户微信
 * @param row 当前行数据
 */
const handleUnbind = (row: User) => {
    ElMessageBox.confirm('确认解绑该用户的微信吗？解绑后需要重新绑定！', '提示', {
        type: 'warning',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
    }).then(async () => {
        try {
            if (!row?.id) return
            await unbindUserWx({ id: row.id })
            ElMessage.success('解绑成功')
            handleQuery()
        } catch (error: any) {
            console.error('解绑失败:', error)
            ElMessage.error(error.message || '解绑失败')
        }
    })
}

/**
 * 修改用户状态（启用1/禁用-1）
 * @param row 当前行数据
 */
const handleStatusChange = (row: User) => {
    const newStatus = row.status === 1 ? -1 : 1
    const actionText = newStatus === 1 ? '启用' : '禁用'

    ElMessageBox.confirm(`确认${actionText}该用户吗？`, '提示', {
        type: 'warning',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
    }).then(async () => {
        try {
            if (!row?.id) return
            await updateUserStatus({
                id: row.id,
                status: newStatus
            })
            ElMessage.success(`${actionText}成功`)
            handleQuery()
        } catch (error: any) {
            console.error(`${actionText}失败:`, error)
            ElMessage.error(error.message || `${actionText}失败`)
        }
    })
}
</script>

<style scoped>
.user-container {
    padding: 20px;
}

.table-wrapper {
    margin-bottom: 20px;
}
</style>