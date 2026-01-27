<template>
  <div class="permission-container">

    <CommonTable ref="tableRef" :fetch-data="fetchData" :search-form="searchForm" :cell-class-name="cellClassName"
      :show-search="false">
      <template #extra-buttons>
        <ElButton type="primary" @click="handleAdd(null)">新增权限</ElButton>
      </template>
      <!-- 表格列定义 -->
      <ElTableColumn prop="title" label="权限名称" min-width="300">
        <template #default="{ row }">
          <div class="permission-title">
            <!-- 缩进占位 -->
            <span v-if="row.level > 0" class="indent" />
            <!-- 层级标识线 -->
            <span v-if="row.level > 0" class="level-line" />
            <!-- 文件夹图标 -->
            <ElIcon class="icon" :size="16">
              <FolderOpened v-if="row.type === RuleType.菜单目录" />
              <Document v-else-if="row.type === RuleType.菜单项" />
              <Operation v-else />
            </ElIcon>
            <!-- 标题文本 -->
            <span class="title-text">{{ row.title }}</span>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="name" label="规则名称" min-width="120" />
      <ElTableColumn prop="path" label="路由路径" min-width="120" />
      <ElTableColumn prop="type" label="类型" width="120">
        <template #default="{ row }">
          <ElTag :type="getType(row.type).type">{{
            getType(row.type).text
            }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" fixed="right" width="200" align="center">
        <template #default="{ row }">
          <ElButton type="primary" link @click="handleAdd(row)" v-auth="'permission_list_add'">
            新增下级
          </ElButton>
          <ElButton type="primary" link @click="handleEdit(row)" v-auth="'permission_list_edit'">
            编辑
          </ElButton>
          <ElButton type="danger" link @click="handleDelete(row)" v-auth="'permission_list_delete'">
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </CommonTable>

    <!-- 新增/编辑对话框 -->
    <ElDialog :title="dialogTitle" v-model="dialogVisible" width="500px" destroy-on-close>
      <ElForm ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <ElFormItem label="上级权限" v-if="currentParent">
          <ElInput v-model="currentParent.title" disabled />
        </ElFormItem>
        <ElFormItem label="权限类型" prop="type">
          <ElSelect v-model="formData.type" placeholder="请选择权限类型">
            <ElOption v-for="{ label, value } in ruleTypeList" :key="value" :label="label" :value="value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="权限名称" prop="title">
          <ElInput v-model="formData.title" placeholder="请输入权限名称" />
        </ElFormItem>
        <ElFormItem label="规则名称" prop="name">
          <ElInput v-model="formData.name" placeholder="请输入规则名称" />
        </ElFormItem>
        <ElFormItem label="权限标识" prop="path">
          <ElInput v-model="formData.path" placeholder="请输入权限标识" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="handleSubmit">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ElMessage,
  ElMessageBox,
  FormInstance,
  ElSelect,
  ElOption,
  ElTag,
  ElIcon,
} from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import {
  queryPermissionRules,
  createPermissionRule,
  deletePermissionRule,
  PermissionRule,
  RuleType,
  ruleTypeList,
} from '@/service/permission.service'
import { FolderOpened, Document, Operation } from '@element-plus/icons-vue'

const tableRef = ref<InstanceType<typeof CommonTable> | null>(null)
const dialogVisible = ref(false)
const currentParent = ref<PermissionRule | null>(null)
const isEdit = ref(false)
const formRef = ref<FormInstance>()

// 搜索表单
const searchForm = ref({
  title: '',
  type: '',
})

const formData = ref({
  title: '',
  name: '',
  path: '',
  type: RuleType.菜单目录,
  pid: '',
})

const rules = {
  type: [{ required: true, message: '请选择权限类型', trigger: 'change' }],
  title: [{ required: true, message: '请输入权限名称', trigger: 'blur' }],
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  path: [{ required: true, message: '请输入权限标识', trigger: 'blur' }],
}

const dialogTitle = computed(() => {
  return isEdit.value
    ? '编辑权限'
    : currentParent.value
      ? '新增下级权限'
      : '新增权限'
})

const getType = (type: RuleType) => {
  const tagMap = {
    [RuleType.菜单目录]: 'success',
    [RuleType.菜单项]: 'warning',
    [RuleType.页面按钮]: 'primary',
  }
  return {
    type: tagMap[type],
    text: ruleTypeList.find((v) => v.value === type)?.label || '',
  }
}

const cellClassName = ({ column }: any) => {
  return column.property === 'title' ? 'title-cell' : ''
}

// 获取表格数据
const fetchData = async (params: any) => {
  try {
    const res = await queryPermissionRules()
    // 添加层级信息
    const addLevel = (items: PermissionRule[], level = 0): PermissionRule[] => {
      return items.map((item) => ({
        ...item,
        level,
        children: item.children ? addLevel(item.children, level + 1) : [],
      }))
    }

    return {
      list: addLevel(res.list || []),
    }
  } catch (error) {
    return {
      list: [],
      total: 0,
    }
  }
}

const handleAdd = (row: PermissionRule | null) => {
  isEdit.value = false
  currentParent.value = row
  formData.value = {
    title: '',
    name: '',
    path: '',
    type: RuleType.菜单目录,
    pid: row?.id || '',
  }
  dialogVisible.value = true
}

const handleEdit = (row: PermissionRule) => {
  isEdit.value = true
  currentParent.value = null
  formData.value = {
    ...row,
    pid: row.pid,
  }
  dialogVisible.value = true
}

const handleDelete = async (row: PermissionRule) => {
  try {
    await ElMessageBox.confirm('确认删除该权限吗？', '提示', {
      type: 'warning',
    })
    await deletePermissionRule(row.id)
    ElMessage.success('删除成功')

    handleSearch()
  } catch (error) {
    // 用户取消删除操作，不需要处理
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await createPermissionRule(formData.value)
        ElMessage.success(`${isEdit.value ? '编辑' : '新增'}成功`)
        dialogVisible.value = false
        handleSearch()
      } catch (error) {
        ElMessage.error(`${isEdit.value ? '编辑' : '新增'}失败`)
      }
    }
  })
}

const handleSearch = () => {
  if (tableRef.value) {
    tableRef.value.refresh()
  }
}

const handleReset = () => {
  if (tableRef.value) {
    tableRef.value.reset()
  }
}
</script>

<style lang="scss" scoped>
.permission-container {
  padding: 20px;
}

.permission-title {
  display: flex;
  align-items: center;
  height: 32px;

  .indent {
    display: inline-block;
    height: 100%;
  }

  .level-line {
    position: relative;
    display: inline-block;
    width: 12px;
    height: 100%;
    margin-right: 8px;

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      height: 1px;
      background-color: #dcdfe6;
    }

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 1px;
      height: 100%;
      background-color: #dcdfe6;
    }
  }

  .icon {
    margin-right: 8px;
    color: #909399;
    width: 16px;
    text-align: center;
  }

  .title-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 32px;
  }

  &:hover {
    .title-text {
      color: #409eff;
    }

    .icon {
      color: #409eff;
    }
  }
}

:deep(.title-cell) {
  .cell {
    display: flex;
    align-items: center;
  }
}

// 为最后一个子项添加特殊样式
:deep(.el-table__row:last-child) {
  .level-line::after {
    height: 50%;
  }
}

:deep(.el-form-item) {
  margin-bottom: 18px;
  width: 100%;

  .el-form-item__label {
    padding-right: 8px;
    width: 80px !important;
  }

  .el-form-item__content {
    flex: 1;
    min-width: 200px;
  }
}
</style>
