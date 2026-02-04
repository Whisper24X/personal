---
name: shadow-dev
description: Guides development for ainative-shadow admin dashboard (Vue3 + Element Plus + Pinia). Provides 7-step workflow, uses useTable/art-table patterns, follows TypeScript strict mode. Use when developing admin pages, lists, forms, or user mentions ainative-shadow, management console, backend dashboard.
---

# ainative-shadow 开发指南

指导 Vue3 + Element Plus 管理后台开发，遵循项目规范和最佳实践。

## 技术栈

- **框架**: Vue 3 + TypeScript + Vite
- **UI**: Element Plus + TailwindCSS
- **状态**: Pinia
- **路由**: Vue Router
- **HTTP**: Axios
- **工具**: VueUse

## 7 步开发流程

根据场景选择起始步骤：

| 场景 | 起始步骤 |
|------|---------|
| 新增页面模块 | 步骤 2 - 定义 API 类型 |
| 已有页面新增功能 | 步骤 4 - 状态管理 |
| 仅修改 UI 样式 | 步骤 5 - 组件开发 |
| 新增路由菜单 | 步骤 6 - 路由配置 |

---

### 步骤 1: 审计需求

确认：
- 是否需要新的后端接口
- 是否需要新增页面/组件
- 是否需要更新权限/菜单

### 步骤 2: 定义 API 类型

在 `src/types/api/api.d.ts` 添加类型定义：

```typescript
declare namespace Api {
  namespace ModuleName {
    // 请求参数
    interface RequestParams {
      id?: string
      name?: string
    }

    // 响应数据
    interface ResponseData {
      id: string
      name: string
      status: number
      createdAt: string
    }

    // 列表响应（使用通用分页类型）
    type ListResponse = Api.Common.PaginatedResponse<ResponseData>
  }
}
```

**规范**:
- 使用 `namespace` 按模块组织
- 参数/响应分离定义
- 利用 `Api.Common` 通用类型
- 添加 JSDoc 注释

→ 详见 [references/api-types.md](references/api-types.md)

### 步骤 3: 实现 API 调用

在 `src/api/` 创建模块文件：

```typescript
import request from '@/utils/http'

/**
 * 获取列表
 */
export function fetchList(params: Api.ModuleName.RequestParams) {
  return request.get<Api.ModuleName.ListResponse>({
    url: '/api/module/list',
    params
  })
}

/**
 * 创建数据
 */
export function createData(data: Api.ModuleName.RequestParams) {
  return request.post<Api.ModuleName.ResponseData>({
    url: '/api/module/create',
    data
  })
}
```

**规范**:
- 使用已定义的类型
- 添加函数注释
- 正确的 HTTP 方法（get/post/put/delete）

→ 详见 [references/api-implementation.md](references/api-implementation.md)

### 步骤 4: 状态管理（可选）

复杂状态在 `src/store/modules/` 创建 Pinia Store：

```typescript
import { defineStore } from 'pinia'

export const useModuleStore = defineStore('module', () => {
  const data = ref<Api.ModuleName.ResponseData[]>([])
  const loading = ref(false)

  const fetchData = async () => {
    loading.value = true
    try {
      data.value = await fetchList()
    } finally {
      loading.value = false
    }
  }

  return { data, loading, fetchData }
})
```

**何时使用**:
- ✅ 跨组件共享状态
- ✅ 复杂的状态逻辑
- ❌ 简单页面（直接用 useTable）

→ 详见 [references/state-management.md](references/state-management.md)

### 步骤 5: 组件开发

#### 5.1 列表页面（推荐模式）

使用 `useTable` Hook + `art-table` 组件：

```vue
<script setup lang="ts">
import { useTable } from '@/hooks/core/useTable'
import { fetchList, deleteData } from '@/api/module'

defineOptions({ name: 'ModuleList' })

// useTable 自动处理分页、搜索、加载状态
const {
  data,
  loading,
  pagination,
  searchParams,
  fetchData,
  handleSizeChange,
  handleCurrentChange,
  resetSearchParams
} = useTable({
  core: {
    apiFn: fetchList,
    immediate: true
  }
})

// 删除操作
const handleDelete = async (id: string) => {
  await ElMessageBox.confirm('确定删除吗？', '提示', { type: 'warning' })
  await deleteData(id)
  ElMessage.success('删除成功')
  fetchData()
}
</script>

<template>
  <div class="module-list">
    <!-- 搜索表单 -->
    <ElForm :inline="true" :model="searchParams">
      <ElFormItem label="名称">
        <ElInput v-model="searchParams.name" clearable />
      </ElFormItem>
      <ElFormItem>
        <ElButton type="primary" @click="fetchData">搜索</ElButton>
        <ElButton @click="resetSearchParams">重置</ElButton>
      </ElFormItem>
    </ElForm>

    <!-- 数据表格 -->
    <art-table :data="data" :loading="loading">
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="status" label="状态" />
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <ElButton link type="primary" size="small">编辑</ElButton>
          <ElButton link type="danger" size="small" @click="handleDelete(row.id)">
            删除
          </ElButton>
        </template>
      </el-table-column>
    </art-table>

    <!-- 分页 -->
    <el-pagination
      v-model:current-page="pagination.current"
      v-model:page-size="pagination.size"
      :total="pagination.total"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>
```

**关键点**:
- ✅ 使用 `useTable` 自动管理表格状态
- ✅ 使用 `art-table` 企业级表格组件
- ✅ TypeScript 类型完整
- ✅ 添加 `defineOptions` 声明组件名

#### 5.2 表单页面

```vue
<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'

const formRef = ref<FormInstance>()
const formData = reactive<Api.ModuleName.RequestParams>({
  name: '',
  status: 1
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }]
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  await createData(formData)
  ElMessage.success('保存成功')
}
</script>

<template>
  <ElForm ref="formRef" :model="formData" :rules="rules" label-width="100px">
    <ElFormItem label="名称" prop="name">
      <ElInput v-model="formData.name" />
    </ElFormItem>
    <ElFormItem>
      <ElButton type="primary" @click="handleSubmit">提交</ElButton>
    </ElFormItem>
  </ElForm>
</template>
```

→ 详见 [references/component-patterns.md](references/component-patterns.md)

### 步骤 6: 路由配置

#### 静态路由

在 `src/router/routes/staticRoutes.ts` 添加：

```typescript
export const staticRoutes = [
  {
    path: '/module',
    name: 'Module',
    component: () => import('@/views/module/index.vue'),
    meta: {
      title: '模块管理',
      icon: 'icon-module'
    }
  }
]
```

#### 动态路由

后端菜单管理添加菜单项，前端路由文件存在即自动加载。

→ 详见 [references/routing.md](references/routing.md)

### 步骤 7: 测试验证

```bash
# 启动开发服务器
pnpm dev

# 代码检查
pnpm lint

# 构建
pnpm build
```

**检查清单**:
- [ ] TypeScript 无错误
- [ ] API 类型完整
- [ ] Props/Emits 类型声明
- [ ] 路由配置正确
- [ ] 功能测试通过

---

## 核心模式

### 1. useTable Hook（推荐）

企业级表格管理，自动处理：
- 分页、搜索、排序
- 加载状态、错误处理
- 智能缓存（可选）

```typescript
const { data, loading, pagination, fetchData } = useTable({
  core: {
    apiFn: fetchList,
    immediate: true
  }
})
```

### 2. art-table 组件（推荐）

增强的 Element Plus Table：
- 自动高度计算
- 列配置管理
- 导出功能

```vue
<art-table :data="data" :loading="loading">
  <el-table-column prop="name" label="名称" />
</art-table>
```

### 3. 组件结构

```vue
<script setup lang="ts">
// 1. imports
// 2. defineOptions (组件名)
// 3. Props/Emits 定义
// 4. 响应式数据
// 5. computed
// 6. 方法
// 7. 生命周期
// 8. defineExpose (可选)
</script>

<template>
  <!-- 模板 -->
</template>

<style scoped lang="scss">
/* 样式 */
</style>
```

---

## 常见场景

### 场景 1: 数据列表 + CRUD

1. 定义 API 类型
2. 实现 API 调用（list, create, update, delete）
3. 使用 `useTable` + `art-table`
4. 添加操作按钮（编辑/删除）
5. 配置路由

### 场景 2: 表单提交

1. 定义表单数据类型
2. 创建表单组件
3. 添加表单验证
4. 实现提交逻辑

### 场景 3: 对话框表单

```vue
<script setup lang="ts">
const dialogVisible = ref(false)
const formData = reactive({ name: '' })

const handleOpen = (row?: any) => {
  if (row) Object.assign(formData, row) // 编辑
  dialogVisible.value = true
}

const handleSubmit = async () => {
  // 提交逻辑
  dialogVisible.value = false
}
</script>

<template>
  <ElDialog v-model="dialogVisible" title="编辑">
    <ElForm :model="formData">
      <!-- 表单项 -->
    </ElForm>
    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" @click="handleSubmit">确定</ElButton>
    </template>
  </ElDialog>
</template>
```

---

## 代码规范

### TypeScript
- ✅ 使用严格模式
- ✅ 避免 `any`，使用 `unknown` 或具体类型
- ✅ Props/Emits 完整类型定义
- ✅ API 请求/响应类型化

### 命名
- 组件：PascalCase (`UserList.vue`)
- 文件：kebab-case (`user-list.ts`)
- 变量/函数：camelCase (`handleSubmit`)
- 常量：UPPER_SNAKE_CASE (`API_BASE_URL`)

### 组件
- 使用 `<script setup>`
- 添加 `defineOptions({ name: 'ComponentName' })`
- Props/Emits TypeScript 接口定义
- 添加 JSDoc 注释

---

## 快速参考

### 项目目录

```
ainative-shadow/src/
├── api/              # API 调用
├── components/       # 公共组件
├── hooks/           # 企业级 Hooks
├── router/          # 路由配置
├── store/           # Pinia 状态
├── types/           # TypeScript 类型
├── utils/           # 工具函数
└── views/           # 页面组件
```

### 常用导入

```typescript
import { useTable } from '@/hooks/core/useTable'
import request from '@/utils/http'
import { ElMessage, ElMessageBox } from 'element-plus'
```

### 命令

```bash
pnpm dev        # 开发
pnpm build      # 构建
pnpm lint       # 检查
pnpm preview    # 预览
```

---

## 详细文档

完整规范请查看：

- **API 开发**: [references/api-types.md](references/api-types.md)
- **组件模式**: [references/component-patterns.md](references/component-patterns.md)
- **核心 Hooks**: [references/core-hooks.md](references/core-hooks.md)
- **路由配置**: [references/routing.md](references/routing.md)
- **状态管理**: [references/state-management.md](references/state-management.md)

完整文档：[docs/dev-spec/ainative-shadow/README.md](../../../docs/dev-spec/ainative-shadow/README.md)
