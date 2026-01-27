<template>
    <div class="template-container">
        <div class="table-wrapper">
            <CommonTable ref="tableRef" v-loading="loading" :fetch-data="getList" :search-form="searchForm"
                :show-search="true" :show-extra-buttons="true" @search="handleQuery" :resetSearchForm="resetQuery">
                <!-- 搜索条件 -->
                <template #search-items>
                    <el-form :inline="true" :model="searchForm.params">
                        <el-form-item label="模板名称">
                            <el-input v-model="searchForm.params.templateName" placeholder="请输入模板名称" clearable />
                        </el-form-item>
                    </el-form>
                </template>

                <!-- 额外按钮 -->
                <template #extra-buttons>
                    <el-button type="primary" @click="handleAdd">新建模板</el-button>
                </template>
                <!-- 表格列定义 -->
                <el-table-column type="index" label="序号" min-width="120" align="center" />
                <el-table-column prop="templateType" label="营期类型" min-width="120" align="center">
                    <template #default="{ row }">
                        {{ row.templateType === 1 ? '单日营' : '多日营' }}
                    </template>
                </el-table-column>
                <el-table-column prop="templateName" label="研学主题" min-width="120" align="center" />
                <el-table-column prop="updatedByName" label="操作人" min-width="120" align="center" />
                <el-table-column prop="createAt" label="创建时间" align="center">
                    <template #default="{ row }">
                        {{ formatDateTime(row.createAt) }}
                    </template>
                </el-table-column>
                <el-table-column prop="updatedAt" label="最后更新" align="center">
                    <template #default="{ row }">
                        {{ formatDateTime(row.updatedAt) }}
                    </template>
                </el-table-column>
                <el-table-column prop="status" label="状态" align="center">
                    <template #default="{ row }">
                        <el-tag :type="row.status === 1 ? 'success' : 'danger'">
                            {{ row.status === 1 ? '启用' : '禁用' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="操作" align="center" width="250">
                    <template #default="{ row }">
                        <a :href="row.templateUrl" target="_blank" class="el-button el-button--primary is-link">
                            下载
                        </a>
                        <el-button type="primary" link @click="handleToggleStatus(row)">
                            {{ row.status === 1 ? '禁用' : '启用' }}
                        </el-button>
                        <el-button type="primary" link @click="handleEdit(row)">
                            编辑
                        </el-button>
                    </template>
                </el-table-column>
            </CommonTable>
        </div>

        <!-- 新增/编辑弹窗 -->
        <el-dialog :title="dialogTitle" v-model="dialogVisible" width="1000px" @close="resetForm">
            <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
                <el-form-item label="模板名称" prop="templateName">
                    <el-input v-model="form.templateName" :disabled="form.id" placeholder="请输入模板名称" />
                </el-form-item>
                <!-- 新增营期选择，单日营还是多日营 -->
                <el-form-item label="营期类型" prop="templateType">
                    <el-radio-group v-model="form.templateType" :disabled="form.id">
                        <el-radio v-for="item in TEMPLATE_TYPE_OPTIONS" :key="item.value" :label="item.value"
                            :value="item.value">{{ item.label }}</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="模板文件" prop="templateUrl">
                    <FileUpload v-model="form.templateUrl" accept=".doc,.docx" file-path="contract/template"
                        :tip-message="'只能上传doc/docx文件'" @file-uploaded="handleFileUploaded"
                        @file-removed="handleFileRemoved" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" @click="handleSubmit">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
/**
 * 合同模板管理页面
 * 实现合同模板的增删改查、启用/禁用等功能
 * 支持按模板名称筛选
 */

// 导入所需的组件和工具
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, UploadFile, UploadUserFile } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import {
    queryContractTemplateList,
    createContractTemplate,
    updateContractTemplate,
    deleteContractTemplate,
    updateContractTemplateStatus,
    downloadContractTemplate
} from './service'
import {
    ContractTemplateItem,
    ContractTemplateQueryParams,
    ContractTemplateListResponse,
    ToggleContractTemplateStatusParams,
    TEMPLATE_TYPE_OPTIONS
} from './service.type'
import dayjs from 'dayjs'
import FileUpload from '@/components/FileUpload/index.vue'

// 页面状态管理
const loading = ref(false) // 加载状态
const dialogVisible = ref(false) // 弹窗显示状态
const dialogTitle = ref('') // 弹窗标题
const formRef = ref<FormInstance>() // 表单实例引用
const tableRef = ref<InstanceType<typeof CommonTable> | null>(null) // 表格实例引用

/**
 * 表单数据
 * 包含合同模板基本信息
 */
const form = reactive({
    id: undefined as string | undefined,
    templateName: '',
    status: 1,
    templateType: 1,
    templateUrl: '', // 文件URL
})

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
 * 表单验证规则
 * 定义必填项和格式验证
 */
const rules = {
    templateName: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
    templateUrl: [{ required: true, message: '请上传模板文件', trigger: 'change' }],
    templateType: [{ required: true, message: '请选择营期类型', trigger: 'change' }],
}

/**
 * 查询参数接口定义
 * @interface SearchParams
 * @property {string} templateName - 模板名称查询条件
 */
interface SearchParams {
    templateName: string
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
        templateName: '',
    },
})

/**
 * 获取合同模板列表数据
 * @param params 查询参数
 * @returns 返回列表数据和总数
 */
const getList = async (params: SearchForm) => {
    try {
        loading.value = true
        // 创建一个简单结构的查询参数对象
        const queryParams: ContractTemplateQueryParams = {
            page: params.page,
            pageSize: params.pageSize,
            templateName: params.params.templateName,
        }

        const res = await queryContractTemplateList(queryParams)
        return {
            list: res.list || [],
            total: res.total || 0,
        }
    } catch (error) {
        console.error('获取合同模板列表失败:', error)
        ElMessage.error('获取合同模板列表失败')
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
    Object.assign(searchForm, {
        page: 1,
        pageSize: 10,
        params: {
            templateName: '',
        },
    })
    setTimeout(() => {
        handleQuery()
    }, 100)
}

/**
 * 新增合同模板
 */
const handleAdd = () => {
    resetForm()
    dialogTitle.value = '新建模板'
    dialogVisible.value = true
}

/**
 * 编辑合同模板
 * @param row 当前行数据
 */
const handleEdit = (row: ContractTemplateItem) => {
    dialogTitle.value = '编辑模板'
    // 回填表单数据
    form.id = row.id
    form.templateName = row.templateName
    form.status = row.status
    form.templateType = row.templateType
    form.templateUrl = row.templateUrl || ''

    // 如果是编辑模式，文件是可选的
    rules.templateUrl = []

    dialogVisible.value = true
}
/**
 * 删除合同模板
 * @param row 当前行数据
 */
const handleDelete = (row: ContractTemplateItem) => {
    ElMessageBox.confirm('确认删除该模板吗？删除后不可恢复！', '提示', {
        type: 'warning',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
    }).then(async () => {
        try {
            if (!row?.id) return
            await deleteContractTemplate(row.id)
            ElMessage.success('删除成功')
            handleQuery()
        } catch (error: any) {
            console.error('删除失败:', error)
            ElMessage.error(error.message || '删除失败')
        }
    })
}

/**
 * 启用/禁用合同模板
 * @param row 当前行数据
 */
const handleToggleStatus = (row: ContractTemplateItem) => {
    const confirmMessage =
        row.status === 1
            ? '确认禁用该模板吗？'
            : '确认启用该模板吗？'
    const tips = row.status === 1 ? '禁用成功' : '启用成功'

    ElMessageBox.confirm(confirmMessage, '提示', {
        type: 'warning',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
    }).then(async () => {
        const statusParams: ToggleContractTemplateStatusParams = {
            id: row.id || '',
            status: row.status === 1 ? -1 : 1, // 切换状态
        }

        await updateContractTemplateStatus(statusParams)
        ElMessage.success(tips)
        handleQuery()
    })
}

/**
 * 提交表单
 * 验证表单并提交数据
 */
const handleSubmit = async () => {
    if (!formRef.value) return

    await formRef.value.validate()

    try {
        if (form.id) {
            await updateContractTemplate(form)
            ElMessage.success('更新成功')
        } else {
            await createContractTemplate(form)
            ElMessage.success('创建成功')
        }

        dialogVisible.value = false
        resetForm()
        handleQuery()
    } catch (error) {
        console.error('提交失败:', error)
        ElMessage.error('提交失败')
    }
}

/**
 * 重置表单
 */
const resetForm = () => {
    if (formRef.value) {
        formRef.value.resetFields()
    }

    Object.assign(form, {
        id: undefined,
        templateName: '',
        status: 1,
        templateType: 1,
        templateUrl: '',
    })

    rules.templateUrl = [{ required: true, message: '请上传模板文件', trigger: 'change' }]
}

/**
 * 格式化日期时间
 * @param dateString 日期字符串
 * @returns 格式化后的日期字符串
 */
const formatDateTime = (dateString: string) => {
    if (!dateString) return '-'
    return dayjs(dateString).format('YYYY-MM-DD HH:mm:ss')
}

</script>

<style lang="scss" scoped>
.template-container {
    padding: 20px;

    .table-wrapper {
        margin-bottom: 20px;
    }
}

:deep(.upload-demo) {
    .el-upload {
        width: 100%;
    }
}
</style>