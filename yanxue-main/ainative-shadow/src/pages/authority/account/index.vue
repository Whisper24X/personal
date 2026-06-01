<template>
  <div class="user-container">
    <div class="table-wrapper">
      <CommonTable ref="tableRef" v-loading="loading" :fetch-data="getList" :search-form="searchForm"
        :show-search="true" :show-extra-buttons="true" :show-search-buttons="false" @search="handleQuery"
        @reset="resetQuery">
        <!-- 搜索条件 -->
        <template #search-items>
          <el-form :inline="true" :model="searchForm.params">
            <el-form-item label="手机号">
              <el-input v-model="searchForm.params.phone" placeholder="请输入手机号" clearable />
            </el-form-item>
            <el-form-item label="部门" style="width: 200px">
              <DeptTreeSelect v-model="searchForm.params.deptIds" multiple />
            </el-form-item>
          </el-form>
        </template>

        <!-- 额外按钮 -->
        <template #extra-buttons>
          <div style="margin-left: 10px; text-align: right">
            <el-button v-auth="'permission_account_add'" type="primary" @click="handleAdd">新增用户</el-button>
          </div>
        </template>
        <!-- 表格列定义 -->
        <el-table-column prop="phone" label="手机号" min-width="120" align="center" />
        <el-table-column prop="nickname" label="昵称" min-width="120" align="center" />
        <el-table-column prop="roleName" label="角色" align="center">
          <template #default="{ row }">
            {{row.roleList?.map((item) => item.roleName).join('、') || '-'}}
          </template>
        </el-table-column>
        <el-table-column prop="deptNames" label="部门" align="center">
          <template #default="{ row }">
            {{ formatDeptPath(row.deptList || []) }}
          </template>
        </el-table-column>
        <el-table-column prop="isChangePwd" label="是否修改密码" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isChangePwd ? 'success' : 'warning'">
              {{ row.isChangePwd ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <!-- <el-table-column prop="status" label="状态" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column> -->
        <el-table-column prop="createdAt" label="创建时间" align="center">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" align="center">
          <template #default="{ row }">
            {{ formatDateTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="250">
          <template #default="{ row }">
            <el-button v-auth="'permission_account_edit'" type="primary" link @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button v-auth="'permission_account_resetPwd'" type="primary" link @click="handleResetPassword(row)">
              重置密码
            </el-button>
            <el-button v-auth="'permission_account_delete'" type="danger" link @click="handleDelete(row)">
              删除
            </el-button>
            <el-button v-auth="'permission_account_disable'" type="primary" link @click="handleDisable(row)">{{
              row.status === 1 ? '禁用' : '启用' }}</el-button>
          </template>
        </el-table-column>
      </CommonTable>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="500px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="角色" prop="roleIds">
          <el-tree-select v-model="form.roleIds" placeholder="请选择角色" multiple :check-strictly="true" :multiple-limit="1"
            :data="roleOptions" node-key="value" :props="{
              value: 'value',
              label: 'label',
              children: 'children',
            }" />
        </el-form-item>
        <el-form-item label="部门" prop="deptIds">
          <DeptTreeSelect v-model="form.deptIds" multiple default-expand-all check-strictly same-level same-parent />
        </el-form-item>
        <!-- <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio
              v-for="item in userStatusOptions"
              :key="item.value"
              :label="item.value"
            >
              {{ item.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item> -->
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
 * 用户管理页面
 * 实现用户的增删改查、重置密码、禁用等功能
 * 支持按手机号和部门筛选
 */

// 导入所需的组件和工具
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import {
  getUserList,
  createUser,
  updateUser,
  deleteUser,
  disableUser,
  resetPassword,
  getUserPermission,
  getDepartmentList,
} from '@/service/account.service'
import { getRoleAll } from '@/service/role.service'
import type {
  User,
  CreateUserParams,
  UpdateUserParams,
  ResetPasswordParams,
} from '@/types/account'
import { userStatusOptions } from '@/types/account'
import { formatDateTime } from '@/utils/date'
import DeptTreeSelect from '@/components/DeptTreeSelect/index.vue'

// 页面状态管理
const loading = ref(false) // 加载状态
const dialogVisible = ref(false) // 弹窗显示状态
const dialogTitle = ref('') // 弹窗标题
const formRef = ref<FormInstance>() // 表单实例引用
const tableRef = ref<InstanceType<typeof CommonTable> | null>(null) // 表格实例引用

/**
 * 树形选择器选项接口定义
 * @interface TreeOption
 * @property {string} label - 显示文本
 * @property {string} value - 选项值
 * @property {TreeOption[]} [children] - 子节点
 */
interface TreeOption {
  label: string // 显示文本
  value: string // 选项值
  children?: TreeOption[] // 子节点
}

// 角色和部门选项
const roleOptions = ref<TreeOption[]>([]) // 角色选项列表
const deptOptions = ref<TreeOption[]>([]) // 部门选项列表

/**
 * 表单数据
 * 包含用户基本信息、角色和部门关联
 */
const form = reactive<Partial<CreateUserParams>>({
  phone: '', // 手机号
  nickname: '', // 昵称
  status: 1, // 状态：1-启用，-1-禁用
  roleIds: [], // 角色ID列表
  deptIds: [], // 部门ID列表
})

/**
 * 表单验证规则
 * 定义必填项和格式验证
 */
const rules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    {
      pattern: /^1[3-9]\d{9}$/,
      message: '请输入正确的手机号',
      trigger: 'blur',
    },
  ],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
  roleIds: [
    { required: true, type: 'array', message: '请选择角色', trigger: 'change' },
  ],
  deptIds: [
    { required: true, type: 'array', message: '请选择部门', trigger: 'change' },
  ],
}

/**
 * 查询参数接口定义
 * @interface SearchParams
 * @property {string} phone - 手机号查询条件
 * @property {string[]} [deptIds] - 部门ID查询条件数组
 */
interface SearchParams {
  phone: string // 手机号查询条件
  deptIds?: string[] // 部门ID查询条件数组
}

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
  params: SearchParams // 查询参数
}

/**
 * 查询表单数据
 * 包含分页信息和查询条件
 */
const searchForm = reactive<SearchForm>({
  page: 1,
  pageSize: 10,
  params: {
    phone: '',
    deptIds: [],
  },
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
      page: params.page,
      pageSize: params.pageSize,
      ...params.params,
    })
    return {
      list: res.list,
      total: res.total,
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
  Object.assign(searchForm, {
    page: 1,
    pageSize: 10,
    params: {
      phone: '',
      deptIds: [],
    },
  })
  handleQuery()
}

/**
 * 新增用户
 */
const handleAdd = () => {
  resetForm()
  dialogTitle.value = '新增用户'
  dialogVisible.value = true
}

/**
 * 编辑用户
 * @param row 当前行数据
 */
const handleEdit = (row: User) => {
  dialogTitle.value = '编辑用户'
  // 回填表单数据
  form.id = row.id
  form.phone = row.phone || ''
  form.nickname = row.nickname || ''
  form.status = row.status
  form.avatar = row.avatar || ''
  // 转换角色和部门数据
  form.roleIds = row.roleList?.map((item) => item.roleId) || []
  form.deptIds = row.deptList?.map((item) => item.deptId) || []

  // 确保选项数据已加载
  if (!roleOptions.value.length) {
    getRoles()
  }
  if (!deptOptions.value.length) {
    getDepts()
  }

  dialogVisible.value = true
}

/**
 * 重置用户密码
 * @param row 当前行数据
 */
const handleResetPassword = (row: User) => {
  ElMessageBox.confirm('重置用户的密码，重置后密码为手机号后六位！', '提示', {
    type: 'warning',
    confirmButtonText: '确认',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      await resetPassword({ id: row.id || '' })
      ElMessage.success('密码重置成功')
    } catch (error) {
      console.error('密码重置失败:', error)
      ElMessage.error('密码重置失败')
    }
  })
}

/**
 * 删除用户
 * @param row 当前行数据
 */
const handleDelete = (row: User) => {
  ElMessageBox.confirm('确认删除该用户吗？删除后不可恢复！', '提示', {
    type: 'warning',
    confirmButtonText: '确认',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      if (!row?.id) return
      await deleteUser(row.id.toString())
      ElMessage.success('删除成功')
      handleQuery()
    } catch (error: any) {
      console.error('删除失败:', error)
      ElMessage.error(error.message || '删除失败')
    }
  })
}

/**
 * 禁用用户
 * @param row 当前行数据
 */
const handleDisable = (row: User) => {
  const confirmMessage =
    row.status === 1
      ? '确认禁用该用户吗？禁用后用户将无法登录！'
      : '确认启用该用户吗？'
  const tips = row.status === 1 ? '禁用成功' : '启用成功'

  ElMessageBox.confirm(confirmMessage, '提示', {
    type: 'warning',
    confirmButtonText: '确认',
    cancelButtonText: '取消',
  }).then(async () => {
    await disableUser({
      id: row.id || '',
      status: row.status === 1 ? -1 : 1,
    })
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
    const submitData: CreateUserParams = {
      phone: form.phone || '',
      nickname: form.nickname || '',
      avatar: form.avatar || '',
      status: form.status || 1,
      roleIds: form.roleIds || [],
      deptIds: form.deptIds || [],
    }

    if (form.id) {
      submitData.id = form.id
    }

    await createUser(submitData)
    if (form.id) {
      ElMessage.success('更新成功')
    } else {
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
    phone: '',
    nickname: '',
    avatar: '',
    status: 1,
    roleIds: [],
    deptIds: [],
  })
}

/**
 * 获取角色列表并格式化为树形结构
 */
const getRoles = async () => {
  try {
    const res = await getRoleAll({ status: 1 })
    const treeData = res.list
    const formatRoles = (roles: any[]): TreeOption[] => {
      return roles.map((role) => ({
        label: role.name,
        value: role.id as string,
        children: role.children?.length
          ? formatRoles(role.children)
          : undefined,
      }))
    }
    roleOptions.value = formatRoles(treeData)
  } catch (error) {
    console.error('获取角色列表失败:', error)
  }
}

/**
 * 获取部门列表并格式化为树形结构
 */
const getDepts = async () => {
  try {
    const res = await getDepartmentList()
    const formatDepts = (depts: any[]): TreeOption[] => {
      return depts.map((dept) => ({
        label: dept.name,
        value: dept.id,
        children: dept.children?.length
          ? formatDepts(dept.children)
          : undefined,
      }))
    }
    deptOptions.value = formatDepts(res.list)
  } catch (error) {
    console.error('获取部门列表失败:', error)
  }
}

/**
 * 获取部门的完整路径
 * @param deptId 部门ID
 * @param tree 树形数据
 * @returns 部门路径数组
 */
const getDeptFullPath = (deptId: string, tree: TreeOption[]): string[] => {
  const path: string[] = []
  const find = (nodes: TreeOption[], target: string) => {
    for (const node of nodes) {
      if (node.value === target) {
        path.unshift(node.label)
        return true
      }
      if (node.children && find(node.children, target)) {
        path.unshift(node.label)
        return true
      }
    }
    return false
  }
  find(tree, deptId)
  return path
}

/**
 * 格式化部门路径显示
 * @param deptList 部门列表
 * @returns 格式化后的部门路径字符串
 */
const formatDeptPath = (deptList: { deptId: string; deptName: string }[]) => {
  if (!deptList.length || !deptOptions.value.length) return '-'

  return deptList
    .map((dept) => {
      const path = getDeptFullPath(dept.deptId, deptOptions.value)
      // 只返回父级和当前级
      const displayPath = path.slice(-2)
      return displayPath.join(' / ')
    })
    .join('、')
}

/**
 * 页面初始化
 * 加载列表数据和选项数据
 */
onMounted(() => {
  handleQuery() // 加载列表数据
  getRoles() // 加载角色选项
  getDepts() // 加载部门选项
})
</script>

/** * 页面样式定义 */
<style scoped>
.user-container {
  padding: 20px;
}

.table-wrapper {
  margin-bottom: 20px;
}
</style>
