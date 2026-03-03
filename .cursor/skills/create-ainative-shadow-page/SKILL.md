---
name: create-ainative-shadow-page
description: 在 ainative-shadow (Vue3 + Element Plus 管理后台) 中创建新页面或功能模块。提供从需求分析到 CRUD 页面实现的完整流程。当用户要求创建新的管理页面、添加 CRUD 功能或实现业务管理界面时使用。
---

# ainative-shadow 创建新页面 Skill

## 技能用途

当需要在 ainative-shadow (Vue3 + Element Plus 管理后台) 中创建新页面或功能模块时使用此技能。

**触发条件**:
- 用户要求创建新的管理页面
- 需要添加新的 CRUD 功能
- 需要实现新的业务管理界面

## 技能步骤

### 1. 需求分析

确认以下信息:
- [ ] 页面功能 (列表/表单/详情等)
- [ ] 数据表结构
- [ ] 后端 API 接口
- [ ] 权限要求
- [ ] 路由配置

### 2. 定义 API 类型

在 `src/types/api/` 目录定义接口类型:

```typescript
// src/types/api/模块名.ts
declare namespace Api {
  namespace ModuleName {
    // 请求参数
    interface SearchParams {
      current: number
      size: number
      name?: string
      status?: string
    }
    
    // 列表项
    interface Item {
      id: string
      name: string
      status: number
      createTime: string
    }
    
    // 列表响应
    type ListResponse = Api.Common.PaginatedResponse<Item>
    
    // 创建/更新参数
    interface SaveParams {
      id?: string
      name: string
      status: number
    }
  }
}
```

### 3. 实现 API 调用

在 `src/service/` 或页面目录下创建 service 文件:

```typescript
// src/pages/模块名/service.ts
import request from '@/utils/http'

/**
 * 获取列表
 */
export function fetchGetList(params: Api.ModuleName.SearchParams) {
  return request.get<Api.ModuleName.ListResponse>({
    url: '/api/module/list',
    params,
  })
}

/**
 * 创建/更新
 */
export function fetchSaveItem(data: Api.ModuleName.SaveParams) {
  return request.post<{ id: string }>({
    url: '/api/module/save',
    data,
    showSuccessMessage: true,
  })
}

/**
 * 删除
 */
export function fetchDeleteItem(id: string) {
  return request.del<void>({
    url: `/api/module/${id}`,
    showSuccessMessage: true,
  })
}
```

### 4. 创建页面目录结构

```
src/pages/
└── 模块名/
    ├── index.vue           # 主页面 (列表页)
    ├── service.ts          # API 调用
    ├── service.type.ts     # 类型定义 (可选)
    └── components/         # 页面组件
        ├── FormDialog.vue  # 表单弹窗
        └── DetailDialog.vue # 详情弹窗 (可选)
```

### 5. 实现列表页面

使用项目封装的 `CommonTable` 组件:

```vue
<template>
  <div class="page-container">
    <!-- 搜索表单 -->
    <el-card class="search-card">
      <el-form :model="searchParams" inline>
        <el-form-item label="名称">
          <el-input v-model="searchParams.name" placeholder="请输入名称" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作按钮 -->
    <el-card class="mt-4">
      <el-button type="primary" @click="handleAdd" v-auth="'module:add'">
        新增
      </el-button>
    </el-card>

    <!-- 数据表格 -->
    <el-card class="mt-4">
      <CommonTable
        :data="tableData"
        :loading="loading"
        :total="total"
        :current-page="searchParams.current"
        :page-size="searchParams.size"
        @page-change="handlePageChange"
        @size-change="handleSizeChange"
      >
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)" v-auth="'module:edit'">
              编辑
            </el-button>
            <el-button link type="danger" @click="handleDelete(row)" v-auth="'module:delete'">
              删除
            </el-button>
          </template>
        </el-table-column>
      </CommonTable>
    </el-card>

    <!-- 表单弹窗 -->
    <FormDialog
      v-model="dialogVisible"
      :data="currentRow"
      @success="handleSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import FormDialog from './components/FormDialog.vue'
import { fetchGetList, fetchDeleteItem } from './service'

// 搜索参数
const searchParams = reactive({
  current: 1,
  size: 10,
  name: '',
})

// 表格数据
const tableData = ref<Api.ModuleName.Item[]>([])
const loading = ref(false)
const total = ref(0)

// 弹窗
const dialogVisible = ref(false)
const currentRow = ref<Api.ModuleName.Item | null>(null)

// 获取列表数据
const fetchData = async () => {
  loading.value = true
  try {
    const res = await fetchGetList(searchParams)
    tableData.value = res.records
    total.value = res.total
  } catch (error) {
    console.error('获取列表失败', error)
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  searchParams.current = 1
  fetchData()
}

// 重置
const handleReset = () => {
  Object.assign(searchParams, {
    current: 1,
    size: 10,
    name: '',
  })
  fetchData()
}

// 分页
const handlePageChange = (page: number) => {
  searchParams.current = page
  fetchData()
}

const handleSizeChange = (size: number) => {
  searchParams.size = size
  searchParams.current = 1
  fetchData()
}

// 新增
const handleAdd = () => {
  currentRow.value = null
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row: Api.ModuleName.Item) => {
  currentRow.value = { ...row }
  dialogVisible.value = true
}

// 删除
const handleDelete = async (row: Api.ModuleName.Item) => {
  try {
    await ElMessageBox.confirm('确认删除该项吗?', '提示', {
      type: 'warning',
    })
    await fetchDeleteItem(row.id)
    fetchData()
  } catch (error) {
    // 用户取消
  }
}

// 保存成功
const handleSuccess = () => {
  dialogVisible.value = false
  fetchData()
}

// 初始化
onMounted(() => {
  fetchData()
})
</script>

<style scoped lang="scss">
.page-container {
  padding: 20px;
}

.search-card {
  margin-bottom: 16px;
}
</style>
```

### 6. 创建表单弹窗组件

```vue
<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑' : '新增'"
    width="600px"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item label="名称" prop="name">
        <el-input v-model="formData.name" placeholder="请输入名称" />
      </el-form-item>
      
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio :label="1">启用</el-radio>
          <el-radio :label="0">禁用</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { fetchSaveItem } from '../service'

const props = defineProps<{
  modelValue: boolean
  data: Api.ModuleName.Item | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const formRef = ref<FormInstance>()
const submitLoading = ref(false)

const isEdit = computed(() => !!props.data?.id)

// 表单数据
const formData = reactive({
  id: '',
  name: '',
  status: 1,
})

// 校验规则
const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

// 监听数据变化
watch(() => props.data, (newData) => {
  if (newData) {
    Object.assign(formData, newData)
  } else {
    resetForm()
  }
}, { immediate: true })

// 重置表单
const resetForm = () => {
  Object.assign(formData, {
    id: '',
    name: '',
    status: 1,
  })
  formRef.value?.clearValidate()
}

// 提交
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate()
  
  submitLoading.value = true
  try {
    await fetchSaveItem(formData)
    emit('success')
    handleClose()
  } catch (error) {
    console.error('保存失败', error)
  } finally {
    submitLoading.value = false
  }
}

// 关闭
const handleClose = () => {
  emit('update:modelValue', false)
}
</script>
```

### 7. 配置路由

在 `src/routers/modules/` 创建路由文件:

```typescript
// src/routers/modules/模块名.ts
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/module',
    name: 'Module',
    component: () => import('@/pages/模块名/index.vue'),
    meta: {
      title: '模块管理',
      icon: 'document',
      requiresAuth: true,
    },
  },
]

export default routes
```

在 `src/routers/modules/index.ts` 中导入:

```typescript
import moduleRoutes from './模块名'

export default [
  ...moduleRoutes,
  // ...其他路由
]
```

### 8. 添加权限配置

在后端菜单管理中添加菜单项和权限:
- 菜单名称: 模块管理
- 路由路径: /module
- 权限标识:
  - `module:view` - 查看
  - `module:add` - 新增
  - `module:edit` - 编辑
  - `module:delete` - 删除

### 9. 测试验证

```bash
# 启动开发服务器
pnpm dev

# 代码检查
pnpm lint

# 构建
pnpm build:prod
```

## 关键规范

### 样式规范
- 使用 Element Plus 组件库
- 使用 SCSS 编写自定义样式
- 遵循 BEM 命名规范

### 组件规范
- 使用 `CommonTable` 封装表格
- 表单使用 Element Plus 的 Form 组件
- 使用 TypeScript 严格类型

### API 规范
- 函数命名: `fetchXxx`
- 成功操作显示提示: `showSuccessMessage: true`
- 统一错误处理

### 权限控制
- 使用 `v-auth` 指令控制按钮显示
- 路由级权限在 meta 中配置

## 常见问题

**Q: 如何处理文件上传?**

```vue
<FileUpload
  v-model="formData.fileUrl"
  :limit="1"
  accept="image/*"
/>
```

**Q: 如何导出 Excel?**

```typescript
const handleExport = async () => {
  const blob = await fetchExportData(searchParams)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '导出数据.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
```

## 相关文档

- [ainative-shadow 开发指南](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-shadow/README.md)
- [API 调用规范](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-shadow/references/api-http.md)
- [组件开发规范](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-shadow/references/component-development.md)
