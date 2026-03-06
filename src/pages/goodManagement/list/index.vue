<template>
  <div class="good-management-container">
    <CommonTable
      ref="tableRef"
      :fetch-data="fetchData"
      :search-form="searchForm"
      :default-search-form="defaultSearchForm"
      :show-search="true"
    >
      <!-- 搜索条件 -->
      <template #search-items>
        <el-form-item label="商品名称">
          <el-input
            v-model="searchForm.name"
            placeholder="请输入商品名称"
            clearable
            style="width: 200px"
          />
        </el-form-item>
      </template>

      <!-- 额外按钮 -->
      <template #extra-buttons>
        <el-button type="primary" @click="handleAddPlatformGood"
          >新增商品</el-button
        >
      </template>

      <!-- 表格列 -->
      <el-table-column
        type="index"
        label="商品编号"
        width="100"
        align="center"
      />
      <el-table-column
        prop="name"
        label="商品名称"
        show-overflow-tooltip
        align="center"
      />
      <el-table-column
        prop="goodType"
        label="商品类别"
        width="120"
        align="center"
      >
        <template #default="scope">
          <el-tag
            :type="scope.row.goodType === 'single' ? 'success' : scope.row.goodType === 'multi' ? 'primary' : 'warning'"
          >
            {{ scope.row.goodType === 'single' ? '单日营' : scope.row.goodType === 'multi' ? '多日营' : '定金' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sales" label="销量" width="80" align="center" />
      <el-table-column prop="createdAt" label="创建时间" align="center">
        <template #default="scope">
          {{ formatDateTime(scope.row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" align="center">
        <template #default="scope">
          {{ formatDateTime(scope.row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="updatedByName" label="最后编辑人" align="center" />
      <el-table-column label="操作" fixed="right">
        <template #default="scope">
          <el-button type="primary" link @click="handleView(scope.row)"
            >查看</el-button
          >
          <el-button type="primary" link @click="handleEdit(scope.row)"
            >修改</el-button
          >
        </template>
      </el-table-column>
    </CommonTable>

    <!-- 商品弹窗 (新增/修改共用) -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '新增平台商品' : '修改平台商品'"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="商品名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入商品名称" />
        </el-form-item>
        <el-form-item label="商品类别" prop="goodType">
          <el-select
            v-model="form.goodType"
            placeholder="请选择商品类别"
            style="width: 100%"
            :disabled="dialogType === 'edit'"
          >
            <el-option label="单日营" value="single" />
            <el-option label="多日营" value="multi" />
            <el-option label="定金" value="deposit" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm" :loading="formLoading">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getPlatformGoodList,
  createPlatformGood,
  updatePlatformGood,
} from './service'
import type { PlatformGoodInfo } from './service.type'
import CommonTable from '@/components/CommonTable/index.vue'
import { formatDateTime } from '@/utils/date'
import { useRouter } from 'vue-router'

const tableRef = ref()
const router = useRouter()

// 搜索表单
const searchForm = reactive({
  name: '',
})

const defaultSearchForm = reactive({
  name: '',
})

// 获取平台商品列表数据
const fetchData = async (params: any) => {
  try {
    const res = await getPlatformGoodList({
      name: params.name,
      page: params.page,
      pageSize: params.pageSize,
    })
    return {
      list: res.list || [],
      total: res.total || 0,
    }
  } catch (error) {
    console.error('获取平台商品列表失败', error)
    ElMessage.error('获取平台商品列表失败')
    return {
      list: [],
      total: 0,
    }
  }
}

// 查看商品渠道列表
const handleView = (row: PlatformGoodInfo) => {
  router.push(
    `/good/channel/${row.id}?name=${encodeURIComponent(row.name)}&goodType=${
      row.goodType
    }`,
  )
}

// 商品弹窗相关
const dialogVisible = ref(false)
const dialogType = ref<'add' | 'edit'>('add')
const formLoading = ref(false)
const formRef = ref()
const form = reactive({
  id: '',
  name: '',
  goodType: '' as 'single' | 'multi' | 'deposit' | '',
})
const formRules = computed(() => ({
  name: [
    { required: true, message: '请输入商品名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' },
  ],
  goodType:
    dialogType.value === 'add'
      ? [{ required: true, message: '请选择商品类别', trigger: 'change' }]
      : [],
}))

// 打开新增平台商品弹窗
const handleAddPlatformGood = () => {
  dialogType.value = 'add'
  dialogVisible.value = true
  form.id = ''
  form.name = ''
  form.goodType = ''
}

// 打开修改平台商品弹窗
const handleEdit = (row: PlatformGoodInfo) => {
  dialogType.value = 'edit'
  dialogVisible.value = true
  form.id = row.id
  form.name = row.name
  form.goodType = row.goodType
}

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      formLoading.value = true
      try {
        if (dialogType.value === 'add') {
          // 新增商品
          const res = await createPlatformGood({
            name: form.name,
            goodType: form.goodType as 'single' | 'multi' | 'deposit',
          })

          if (res.id) {
            ElMessage.success('新增平台商品成功')
            dialogVisible.value = false
            // 刷新列表
            tableRef.value.refresh()
          } else {
            ElMessage.error('新增平台商品失败')
          }
        } else {
          // 修改商品
          await updatePlatformGood({
            id: form.id,
            name: form.name,
          })

          ElMessage.success('修改平台商品成功')
          dialogVisible.value = false
          // 刷新列表
          tableRef.value.refresh()
        }
      } catch (error) {
        console.error(
          `${dialogType.value === 'add' ? '新增' : '修改'}平台商品失败`,
          error,
        )
        ElMessage.error(
          `${dialogType.value === 'add' ? '新增' : '修改'}平台商品失败`,
        )
      } finally {
        formLoading.value = false
      }
    }
  })
}

// 格式化价格
const formatPrice = (price: number) => {
  return `¥${price.toFixed(2)}`
}

// 获取状态类型
const getStatusType = (status: string) => {
  const statusMap: Record<string, string> = {
    putOn: 'success',
    putOff: 'info',
    pending: 'warning',
    delete: 'danger',
  }
  return statusMap[status] || ''
}

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    putOn: '已上架',
    putOff: '已下架',
    pending: '待上架',
    delete: '已删除',
  }
  return statusMap[status] || ''
}
</script>

<style lang="scss" scoped>
.good-management-container {
  padding: 20px;
}
</style>
