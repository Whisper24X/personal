<template>
  <div class="evaluation-template-container">
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
          <el-form-item label="模板名称">
            <el-input
              v-model="searchForm.params.templateName"
              placeholder="请输入模板名称"
              clearable
              style="width: 220px"
            />
          </el-form-item>
        </el-form>
      </template>

      <!-- 额外按钮 -->
      <template #extra-buttons>
        <el-button type="primary" @click="handleAddTemplate"
          >新增模板</el-button
        >
      </template>

      <!-- 表格列定义 -->
      <el-table-column
        type="selection"
        width="55"
        align="center"
        v-if="false"
      />
      <el-table-column
        type="index"
        label="序号"
        min-width="80"
        align="center"
      />
      <el-table-column
        prop="templateName"
        label="模板名称"
        min-width="150"
        align="center"
      />
      <el-table-column
        prop="business"
        label="所属业务"
        min-width="120"
        align="center"
      />
      <el-table-column
        prop="updatedByName"
        label="操作人"
        min-width="120"
        align="center"
      />
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
      <el-table-column
        prop="updatedAt"
        label="最后更新"
        min-width="160"
        align="center"
      >
        <template #default="{ row }">
          {{ formatDateTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="评价链接" min-width="200" align="center">
        <template #default="{ row }">
          <el-tooltip
            :content="getEvaluationUrl(row.id)"
            placement="top"
            effect="light"
          >
            <span class="evaluation-url-text">{{
              getEvaluationUrl(row.id)
            }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        min-width="120"
        align="center"
        fixed="right"
      >
        <template #default="{ row }">
          <el-button type="primary" link @click="handleEdit(row)">
            编辑
          </el-button>
          <el-button type="danger" link @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </CommonTable>

    <!-- 新增/编辑模板对话框 -->
    <TemplateForm
      ref="templateFormRef"
      :formData="formData"
      v-model:visible="dialogVisible"
      :title="dialogTitle"
      :loading="formLoading"
      @submit="handleSubmit"
      @cancel="handleDialogCancel"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 评价模板管理页面
 * 实现评价模板的查询、新增、编辑、删除功能
 */

// 导入所需的组件和工具
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import TemplateForm from './components/TemplateForm.vue'
import dayjs from 'dayjs'
import {
  getEvaluationTemplateList,
  createEvaluationTemplate,
  updateEvaluationTemplate,
  deleteEvaluationTemplate,
  getEvaluationTemplateDetail,
} from './service'
import {
  BUSINESS_TYPE_OPTIONS,
  getBusinessTypeLabel,
  getBusinessTypeValue,
  type EvaluationTemplateItem,
  type EvaluationTemplateForm,
} from './service.type'

// 页面状态管理
const loading = ref(false)
const formLoading = ref(false)
const tableRef = ref<InstanceType<typeof CommonTable> | null>(null)
const dialogVisible = ref(false)
const dialogTitle = ref('新增评价模板')
const selectedRows = ref<EvaluationTemplateItem[]>([])
const templateFormRef = ref<InstanceType<typeof TemplateForm> | null>(null)

// 所属业务选项
const businessOptions = BUSINESS_TYPE_OPTIONS

/**
 * 搜索表单接口
 */
interface SearchParams {
  templateName?: string
}

/**
 * 查询表单接口
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
    templateName: '',
  },
})

const defaultSearchForm = reactive<SearchForm>({
  page: 1,
  pageSize: 10,
  params: {
    templateName: '',
  },
})

// 表单数据
const formData = reactive<EvaluationTemplateForm>({
  id: '',
  templateName: '',
  business: '',
  evaluationObject: '',
  evaluationDimension: [],
  evaluationLabel: [],
  tips: '',
  isEdit: false,
})

/**
 * 获取列表数据
 */
const getList = async (
  params: any,
): Promise<{ list: any[]; total: number }> => {
  loading.value = true
  try {
    // 转换查询参数
    const queryParams = {
      page: params.page,
      pageSize: params.pageSize,
      templateName: params.params?.templateName || undefined,
      businessType: params.params?.businessType || undefined,
    }

    // 调用API获取数据
    const data = await getEvaluationTemplateList(queryParams)
    console.log(data, 'data')

    return {
      list: data.list || [],
      total: data.total || 0,
    }
  } catch (error) {
    console.error('获取评价模板列表失败:', error)
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
 */
const handleSelectionChange = (rows: EvaluationTemplateItem[]) => {
  selectedRows.value = rows
}

/**
 * 格式化日期时间
 */
const formatDateTime = (dateTimeString: string) => {
  if (!dateTimeString) return '--'
  return dayjs(dateTimeString).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * 处理新增模板
 */
const handleAddTemplate = () => {
  // 重置表单数据
  Object.assign(formData, {
    id: '',
    templateName: '',
    business: '',
    evaluationObject: '',
    evaluationDimension: [''],
    evaluationLabel: [''],
    tips: '',
    isEdit: false,
  })

  dialogTitle.value = '新建评价模板'
  dialogVisible.value = true
}

/**
 * 处理编辑模板
 */
const handleEdit = async (row: any) => {
  try {
    formLoading.value = true

    // 获取模板详情
    const data = await getEvaluationTemplateDetail(row.id)
    const detail = data.info
    console.log(detail, 'detail')

    // 填充表单数据
    Object.assign(formData, {
      id: detail.id,
      templateName: detail.templateName,
      business: detail.business,
      evaluationObject: detail.evaluationObject,
      evaluationDimension: detail.evaluationDimension || [],
      evaluationLabel: detail.evaluationLabel || [],
      tips: detail.tips,
      isEdit: true,
    })

    dialogTitle.value = '编辑评价模板'
    dialogVisible.value = true
  } catch (error) {
    console.error('获取模板详情失败:', error)
    ElMessage.error('获取模板详情失败，请稍后重试')
  } finally {
    formLoading.value = false
  }
}

/**
 * 处理删除模板
 */
const handleDelete = async (row: EvaluationTemplateItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模板"${row.templateName}"吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    loading.value = true
    // 调用API删除模板
    await deleteEvaluationTemplate(row.id)

    ElMessage.success('删除成功')
    tableRef.value?.refresh()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}

/**
 * 处理表单提交
 */
const handleSubmit = async (submitData: any) => {
  try {
    formLoading.value = true

    // 将表单数据转换为API需要的格式
    const apiData = {
      id: submitData.id,
      templateName: submitData.templateName,
      business: submitData.business,
      evaluationObject: submitData.evaluationObject,
      evaluationDimension: submitData.evaluationDimension,
      evaluationLabel: submitData.evaluationLabel,
      tips: submitData.tips,
    }

    if (submitData.isEdit) {
      // 更新模板
      await updateEvaluationTemplate(apiData)
      ElMessage.success('更新成功')
    } else {
      // 创建模板
      delete apiData.id
      await createEvaluationTemplate(apiData)
      ElMessage.success('创建成功')
    }

    dialogVisible.value = false
    tableRef.value?.refresh()
  } catch (error) {
    console.error(submitData.isEdit ? '更新失败:' : '创建失败:', error)
    ElMessage.error(
      submitData.isEdit ? '更新失败，请稍后重试' : '创建失败，请稍后重试',
    )
  } finally {
    formLoading.value = false
  }
}

/**
 * 处理对话框取消
 */
const handleDialogCancel = () => {
  dialogVisible.value = false
}

/**
 * 获取评价链接
 */
const getEvaluationUrl = (id: string | number) => {
  return `${process.env.H5_BASE_URL}/trip-h5/feedback?template=${id}`
}

// 初始化
onMounted(() => {
  // 可以在这里添加初始化逻辑
})
</script>

<style scoped>
.evaluation-template-container {
  padding: 0;
}

.evaluation-url-text {
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
