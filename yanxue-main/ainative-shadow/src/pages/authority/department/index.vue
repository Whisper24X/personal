<template>
  <div class="department-container">
    <!-- 表格 -->
    <div class="table-wrapper">
      <el-table
        v-loading="loading"
        :data="departmentList"
        row-key="id"
        default-expand-all
        :tree-props="{ children: 'children' }"
        style="width: 100%"
      >
        <el-table-column prop="name" label="部门名称" min-width="200" />
        <el-table-column prop="createdAt" label="创建时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="修改时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="remark"
          label="描述"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              v-auth="'permission_department_add_child'"
              v-if="['root', 'child'].includes(row.type)"
              type="primary"
              link
              @click="handleAdd(row)"
              :disabled="row.status === -1 ? true : false"
            >
              添加子部门
            </el-button>
            <el-button
              v-auth="'permission_department_edit'"
              type="primary"
              link
              @click="handleEdit(row)"
              :disabled="row.status === -1 ? true : false"
            >
              编辑
            </el-button>
            <el-button
              v-auth="'permission_department_delete'"
              type="danger"
              link
              @click="handleDelete(row)"
              :disabled="row.status === -1 ? true : false"
            >
              删除
            </el-button>

            <!-- <el-button v-auth="'permission_department_disable'" type="primary" link @click="handleDisable(row)">禁用</el-button> -->
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      :title="dialogTitle"
      v-model="dialogVisible"
      width="500px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="部门名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入部门名称" />
        </el-form-item>

        <el-form-item
          v-if="form.type !== 'root'"
          label="是否为门店"
          prop="type"
        >
          <el-radio-group
            v-model="form.type"
            :disabled="form.children && form.children.length > 0"
          >
            <el-radio label="child">否</el-radio>
            <el-radio label="leaf">是</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="form.remark"
            type="textarea"
            placeholder="请输入描述"
          />
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import {
  getDepartmentTree,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '@/service/department.service'
import type { Department } from '@/types/department'
import { formatDateTime } from '@/utils/date'

const loading = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('')
const formRef = ref<FormInstance>()
const departmentList = ref<Department[]>([])

const form = reactive<Partial<Department>>({
  name: '',
  pid: '',
  status: 1,
  remark: '',
  type: 'child', // 默认设置为根节点
})

const rules = {
  name: [{ required: true, message: '请输入部门名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择部门类型', trigger: 'change' }],
}

const currentParentId = ref<string | number>('')

// 获取部门列表（现在返回的是树形结构）
const getList = async () => {
  try {
    loading.value = true
    const res = await getDepartmentTree()
    departmentList.value = res.list
  } finally {
    loading.value = false
  }
}

// 新增部门
const handleAdd = (row?: Department) => {
  resetForm()
  dialogTitle.value = row ? `添加 ${row.name} 的子部门` : '新增部门'
  currentParentId.value = row?.id || ''
  form.pid = row?.id || ''
  dialogVisible.value = true
}

// 编辑部门
const handleEdit = (row: Department) => {
  resetForm()
  console.log('handleEdit-row', row)
  dialogTitle.value = '编辑部门'
  currentParentId.value = row.pid
  Object.assign(form, row)
  console.log('handleEdit-form', form)
  dialogVisible.value = true
}

// 删除部门
const handleDelete = (row: Department) => {
  resetForm()

  if (row.children?.length) {
    ElMessage.warning('该部门下存在子部门，无法删除')
    return
  }

  ElMessageBox.confirm('确认删除该部门吗？删除后不可恢复！', '提示', {
    type: 'warning',
    confirmButtonText: '确认',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      await deleteDepartment(row.id.toString()) // 转换为字符串类型
      ElMessage.success('删除成功')
      getList()
    } catch (error) {
      console.error('删除失败:', error)
    }
  })
}

// 禁用部门
const handleDisable = (row: Department) => {
  resetForm()

  console.log('handleDisable-row', row)
  ElMessageBox.confirm('确认禁用该部门吗？禁用后该部门将无法使用！', '提示', {
    type: 'warning',
    confirmButtonText: '确认',
    cancelButtonText: '取消',
  }).then(async () => {
    console.log('handleDisable-confirm')
    await updateDepartment({
      id: row.id.toString(),
      status: -1,
    })
    ElMessage.success('禁用成功')
    getList()
  })
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate()

  try {
    console.log('handleSubmit', JSON.stringify(form))
    await createDepartment(form as any)
    if (form.id) {
      ElMessage.success('更新成功')
    } else {
      ElMessage.success('创建成功')
    }
    resetForm()

    dialogVisible.value = false
    getList()
  } catch (error) {
    console.error('提交失败:', error)
  }
}

// 重置表单
const resetForm = () => {
  console.log('resetForm')
  if (formRef.value) {
    formRef.value.resetFields()
  }
  // 重置所有表单字段为初始值
  for (const key in form) {
    if (Object.prototype.hasOwnProperty.call(form, key)) {
      let value = Array.isArray(form[key]) ? [] : ''
      if (key === 'status') {
        value = 1
      }
      form[key as keyof typeof form] = value
    }
  }
  currentParentId.value = ''
}

onMounted(() => {
  getList()
})
</script>

<style scoped>
.department-container {
  padding: 20px;
}
.search-wrapper {
  margin-bottom: 20px;
}
.table-wrapper {
  margin-bottom: 20px;
}
</style>
