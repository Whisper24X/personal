<template>
  <div class="role-container">
    <!-- 表格 -->
    <div class="table-wrapper">
      <div style="text-align: right; margin-bottom: 16px">
        <el-button v-auth="'permission_role_add'" type="primary" @click="handleAdd">新增角色</el-button>
      </div>
      <CommonTable ref="tableRef" v-loading="loading" :show-search="false" :fetch-data="getList"
        :search-form="queryParams" @search="handleQuery" @reset="resetQuery">
        <!-- 表格列定义 -->
        <el-table-column prop="name" label="角色名称" min-width="120" align="center" />
        <el-table-column prop="remark" label="角色说明" min-width="120" align="center" />
        <el-table-column prop="dataPermission" label="数据权限" align="center">
          <template #default="{ row }">
            {{ getDataPermissionLabel(row.dataPermission) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" align="center">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center">
          <template #default="{ row }">
            <el-button v-auth="'permission_role_edit'" type="primary" link @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button v-auth="'permission_role_viewPermission'" type="primary" link @click="handleViewPermission(row)">
              权限
            </el-button>
            <el-button v-auth="'permission_role_delete'" type="danger" link @click="handleDelete(row)">
              删除
            </el-button>
            <el-button v-auth="'permission_role_disable'" type="primary" link @click="handleDisable(row)">{{ row.status
              === 1 ? '禁用' : '启用' }}</el-button>
          </template>
        </el-table-column>
      </CommonTable>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="700px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="角色说明" prop="remark">
          <el-input v-model="form.remark" type="textarea" placeholder="请输入角色说明" />
        </el-form-item>
        <el-form-item label="数据权限" prop="dataPermission">
          <el-select v-model="form.dataPermission" placeholder="请选择数据权限" style="width: 100%">
            <el-option v-for="item in dataPermissionOptions" :key="item.value" :label="item.label"
              :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色权限" prop="permissionIds">
          <el-tree ref="menuTree" :data="menuTreeData" :default-expand-all="true" :default-checked-keys="filterHalfCheckedKeys(form.permissionIds || [], menuTreeData)
            " show-checkbox node-key="id" @check="handleMenuCheck" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 查看权限弹窗 -->
    <el-dialog title="角色权限" v-model="permissionVisible" width="600px">
      <el-tree ref="menuViewTree" :data="currentRoleMenus" :default-expand-all="true" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { TreeInstance } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import {
  getRoleList,
  createRole,
  updateRole,
  deleteRole,
  getRoleMenus,
} from '@/service/role.service'
import type { Role, CreateRoleParams, UpdateRoleParams } from '@/types/role'
import { dataPermissionOptions, statusOptions } from '@/types/role'
import { formatDateTime } from '@/utils/date'
import { usePermissionTree } from '@/composables/usePermissionTree'
import { useRoleForm } from '@/composables/useRoleForm'

const loading = ref(false)
const permissionVisible = ref(false)
const menuTree = ref<TreeInstance>()
const menuViewTree = ref<TreeInstance>()
const currentRoleMenus = ref<any[]>([])
const tableRef = ref<InstanceType<typeof CommonTable> | null>(null)

const { menuTreeData, getPermissionList, findPermissions } = usePermissionTree()
const { formRef, dialogVisible, dialogTitle, form, rules, resetForm } =
  useRoleForm()

// 查询参数
const queryParams = reactive({
  page: 1,
  pageSize: 10,
  name: '',
  dataPermission: undefined as string | undefined,
  status: undefined as number | undefined,
})

// 获取角色列表
const getList = async (params: any) => {
  try {
    loading.value = true
    const res = await getRoleList({
      page: params.page || 1,
      pageSize: params.pageSize || 10,
      name: params.name,
      dataPermission: params.dataPermission,
      status: params.status,
    })
    return {
      list: res.list,
      total: res.total,
    }
  } catch (error) {
    console.error('获取角色列表失败:', error)
    return {
      list: [],
      total: 0,
    }
  } finally {
    loading.value = false
  }
}

// 查询
const handleQuery = () => {
  getList(queryParams)
  if (tableRef.value) {
    tableRef.value.refresh()
  }
}

// 重置查询
const resetQuery = () => {
  Object.assign(queryParams, {
    page: 1,
    pageSize: 10,
    name: '',
    dataPermission: undefined,
    status: undefined,
  })
  handleQuery()
}

/**
 * 过滤掉半选状态的节点
 * @param keys 所有选中的权限ID数组
 * @param tree 权限树数据
 * @returns 过滤后的权限ID数组（只包含完全选中的节点）
 */
const filterHalfCheckedKeys = (keys: string[], tree: any[]): string[] => {
  const newTree = JSON.parse(JSON.stringify(tree))
  const allKeys = JSON.parse(JSON.stringify(keys))
  console.log('filterHalfCheckedKeys-allKeys', allKeys)
  console.log('filterHalfCheckedKeys-newTree', newTree)
  const result: string[] = []
  const traverse = (nodes: any[]) => {
    for (const node of nodes) {
      if (allKeys.includes(node.id)) {
        // 如果当前节点在权限列表中，且没有子节点或子节点都不在权限列表中，则保留
        if (
          !node.children?.length ||
          !node.children.some((child: any) => allKeys.includes(child.id))
        ) {
          result.push(node.id)
        }
      }
      if (node.children?.length) {
        traverse(node.children)
      }
    }
  }
  traverse(newTree)
  console.log('filterHalfCheckedKeys-result', result)
  return result
}

/**
 * 新增角色
 * 重置表单并打开弹窗
 */
const handleAdd = async () => {
  resetForm()
  dialogTitle.value = '新增角色'
  await getPermissionList()
  dialogVisible.value = true
}

/**
 * 编辑角色
 * @param row 当前行数据
 */
const handleEdit = async (row: Role) => {
  dialogTitle.value = '编辑角色'
  menuTree.value?.setCheckedKeys([], false)
  // 回填表单数据
  Object.assign(form, row)
  // 设置权限ID
  console.log('handleEdit-row', row)
  form.permissionIds = row.permissionIds || []
  console.log('handleEdit-form', form.permissionIds)
  dialogVisible.value = true
}

/**
 * 查看角色权限
 * @param row 当前行数据
 */
const handleViewPermission = async (row: Role) => {
  try {
    if (!row?.id) return

    // 过滤树节点，保留选中节点及其子节点
    const filterTreeByIds = (tree: any[], permissionIds: string[]): any[] => {
      return tree.filter((node) => {
        // 如果当前节点在权限列表中，保留整个子树
        if (permissionIds.includes(node.id)) {
          return true
        }

        // 如果有子节点，递归过滤
        if (node.children && node.children.length) {
          const filteredChildren = filterTreeByIds(node.children, permissionIds)
          node.children = filteredChildren
          // 如果过滤后还有子节点，保留该节点
          return filteredChildren.length > 0
        }

        return false
      })
    }

    console.log('menuTreeData', menuTreeData)
    console.log('form.permissionIds', row.permissionIds)
    const checkedIds = filterHalfCheckedKeys(
      row.permissionIds || [],
      menuTreeData.value,
    )
    console.log('checkedIds', checkedIds)
    // 使用角色的权限ID过滤完整的菜单树
    currentRoleMenus.value = filterTreeByIds(
      JSON.parse(JSON.stringify(menuTreeData.value)),
      checkedIds,
    )
    permissionVisible.value = true
  } catch (error) {
    console.error('获取权限失败:', error)
  }
}

/**
 * 删除角色
 * @param row 当前行数据
 */
const handleDelete = (row: Role) => {
  ElMessageBox.confirm('确认删除该角色吗？删除后不可恢复！', '提示', {
    type: 'warning',
    confirmButtonText: '确认',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      if (!row?.id) return
      await deleteRole(row.id.toString())
      ElMessage.success('删除成功')
      handleQuery()
    } catch (error: any) {
      console.error('删除失败:', error)
      ElMessage.error(error.message || '删除失败')
    }
  })
}

/**
 * 禁用角色
 * @param row 当前行数据
 */
const handleDisable = (row: Role) => {
  const confirmMessage =
    row.status === 1
      ? '确认禁用该角色吗？禁用后该角色将无法使用！'
      : '确认启用该角色吗？'
  const tips = row.status === 1 ? '禁用成功' : '启用成功'

  ElMessageBox.confirm(confirmMessage, '提示', {
    type: 'warning',
    confirmButtonText: '确认',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      if (!row?.id) return
      await updateRole({
        id: row.id.toString(),
        status: row.status === 1 ? -1 : 1,
      })
      ElMessage.success(tips)
      handleQuery()
    } catch (error) {
      console.error(tips, error)
      ElMessage.error(tips)
    }
  })
}

/**
 * 处理菜单权限选择
 * @param node 当前节点
 * @param checkedInfo 选中状态信息，包含完全选中和半选中的节点
 */
const handleMenuCheck = (
  node: any,
  {
    checkedKeys,
    halfCheckedKeys,
  }: { checkedKeys: string[]; halfCheckedKeys: string[] },
) => {
  console.log('handleMenuCheck-checkedKeys', checkedKeys)
  console.log('handleMenuCheck-halfCheckedKeys', halfCheckedKeys)
  // 合并完全选中和半选中的节点ID
  form.permissionIds = [...checkedKeys, ...halfCheckedKeys]
}

/**
 * 获取数据权限标签文本
 * @param value 权限值
 * @returns 权限标签文本
 */
const getDataPermissionLabel = (value: string) => {
  const option = dataPermissionOptions.find((item) => item.value === value)
  return option?.label || value
}

/**
 * 获取状态标签文本
 * @param value 状态值
 * @returns 状态标签文本
 */
const getStatusLabel = (value: number) => {
  const option = statusOptions.find((item) => item.value === value)
  return option?.label || value
}

/**
 * 提交表单
 * 验证表单并提交数据
 */
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate()

  // 额外检查权限是否已选择
  if (!form.permissionIds?.length) {
    ElMessage.warning('请至少选择一个权限')
    return
  }

  try {
    await createRole(form as CreateRoleParams)
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

onMounted(() => {
  getList(queryParams)
  getPermissionList()
})
</script>

<style scoped>
.role-container {
  padding: 20px;
}

.table-wrapper {
  margin-bottom: 20px;
}
</style>
