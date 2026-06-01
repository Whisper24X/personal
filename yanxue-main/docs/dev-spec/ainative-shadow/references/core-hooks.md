# 核心 Hooks 指南

## 概述

项目封装了一系列企业级 Hooks，用于处理常见的业务场景，提高开发效率和代码质量。

**位置**: `src/hooks/core/`

---

## useTable - 企业级表格管理

### 功能特性

- ✅ 自动处理分页、搜索、排序
- ✅ 智能缓存（可选）
- ✅ 请求防抖和重试
- ✅ 加载状态和错误处理
- ✅ 多种刷新策略
- ✅ 动态列配置（可选）

### 基础用法

```typescript
<script setup lang="ts">
import { useTable } from '@/hooks/core/useTable'
import { fetchGetUserList } from '@/api/system-manage'

const {
  data,                    // 表格数据
  loading,                 // 加载状态
  pagination,              // 分页信息
  searchParams,            // 搜索参数
  fetchData,               // 加载数据
  handleSizeChange,        // 分页大小变化
  handleCurrentChange,     // 当前页变化
  resetSearchParams        // 重置搜索
} = useTable({
  core: {
    apiFn: fetchGetUserList,    // API 函数
    immediate: true              // 立即加载
  }
})
</script>

<template>
  <art-table :data="data" :loading="loading">
    <el-table-column prop="userName" label="用户名" />
    <el-table-column prop="email" label="邮箱" />
  </art-table>
  
  <el-pagination
    v-model:current-page="pagination.current"
    v-model:page-size="pagination.size"
    :total="pagination.total"
    @size-change="handleSizeChange"
    @current-change="handleCurrentChange"
  />
</template>
```

### 配置选项

```typescript
interface UseTableConfig {
  // 核心配置
  core: {
    apiFn: Function              // API 请求函数（必填）
    apiParams?: object           // 默认请求参数
    immediate?: boolean          // 是否立即加载（默认 true）
    columnsFactory?: Function    // 列配置工厂函数
    paginationKey?: {            // 分页字段映射
      current?: string           // 当前页字段名（默认 'current'）
      size?: string              // 每页条数字段名（默认 'size'）
    }
  }

  // 数据处理
  transform?: {
    dataTransformer?: Function   // 数据转换函数
    responseAdapter?: Function   // 响应适配器
  }

  // 性能优化
  performance?: {
    enableCache?: boolean        // 启用缓存（默认 false）
    cacheTime?: number           // 缓存时间（默认 5分钟）
    debounceTime?: number        // 防抖时间（默认 300ms）
    maxCacheSize?: number        // 最大缓存条数（默认 50）
  }

  // 生命周期钩子
  hooks?: {
    onSuccess?: Function         // 成功回调
    onError?: Function           // 错误回调
    onCacheHit?: Function        // 缓存命中回调
    resetFormCallback?: Function // 重置表单回调
  }

  // 调试配置
  debug?: {
    enableLog?: boolean          // 启用日志（默认 false）
    logLevel?: 'info' | 'warn' | 'error'
  }
}
```

### 进阶用法

#### 1. 带搜索条件

```typescript
const {
  data,
  loading,
  searchParams,
  getDataDebounced,     // 防抖搜索
  resetSearchParams
} = useTable({
  core: {
    apiFn: fetchGetUserList,
    apiParams: {          // 默认参数
      status: 'active'
    }
  }
})

// 搜索
const handleSearch = () => {
  getDataDebounced()
}

// 重置
const handleReset = () => {
  resetSearchParams()
}
```

```vue
<template>
  <el-form :model="searchParams">
    <el-form-item label="用户名">
      <el-input v-model="searchParams.userName" @input="handleSearch" />
    </el-form-item>
    <el-form-item label="邮箱">
      <el-input v-model="searchParams.email" @input="handleSearch" />
    </el-form-item>
    <el-button @click="handleReset">重置</el-button>
  </el-form>
</template>
```

#### 2. 启用缓存

```typescript
const { data, loading, cacheInfo } = useTable({
  core: { apiFn: fetchGetUserList },
  performance: {
    enableCache: true,      // 启用缓存
    cacheTime: 5 * 60 * 1000,  // 5分钟
    maxCacheSize: 50        // 最多缓存50条
  }
})

// 查看缓存信息
console.log(cacheInfo.value)
// { total: 10, size: '2.5KB', hitRate: '5 avg hits' }
```

#### 3. 数据转换

```typescript
const { data } = useTable({
  core: { apiFn: fetchGetUserList },
  transform: {
    dataTransformer: (data) => {
      // 转换数据格式
      return data.map(item => ({
        ...item,
        fullName: `${item.firstName} ${item.lastName}`,
        statusText: item.status === '1' ? '启用' : '禁用'
      }))
    }
  }
})
```

#### 4. 刷新策略

```typescript
const {
  refreshData,      // 全量刷新（清空所有缓存）
  refreshSoft,      // 软刷新（保持分页状态）
  refreshCreate,    // 新增后刷新（回到第一页）
  refreshUpdate,    // 更新后刷新（保持当前页）
  refreshRemove     // 删除后刷新（智能处理页码）
} = useTable({
  core: { apiFn: fetchGetUserList }
})

// 新增用户后
const handleCreate = async () => {
  await createUser(formData)
  await refreshCreate()  // 回到第一页
}

// 更新用户后
const handleUpdate = async () => {
  await updateUser(formData)
  await refreshUpdate()  // 保持当前页
}

// 删除用户后
const handleDelete = async (id: string) => {
  await deleteUser(id)
  await refreshRemove()  // 智能处理：如果当前页为空，自动回到上一页
}
```

#### 5. 动态列配置

```typescript
const {
  data,
  columns,          // 列配置
  columnChecks,     // 列显示控制
  toggleColumn,     // 切换列显示
  resetColumns      // 重置列配置
} = useTable({
  core: {
    apiFn: fetchGetUserList,
    columnsFactory: () => [
      { prop: 'userName', label: '用户名', visible: true },
      { prop: 'email', label: '邮箱', visible: true },
      { prop: 'phone', label: '手机号', visible: false }
    ]
  }
})
```

```vue
<template>
  <!-- 列显示控制 -->
  <el-checkbox-group v-model="columnChecks">
    <el-checkbox label="userName">用户名</el-checkbox>
    <el-checkbox label="email">邮箱</el-checkbox>
    <el-checkbox label="phone">手机号</el-checkbox>
  </el-checkbox-group>

  <!-- 表格 -->
  <art-table :data="data">
    <el-table-column
      v-for="col in columns"
      :key="col.prop"
      :prop="col.prop"
      :label="col.label"
    />
  </art-table>
</template>
```

### 返回值说明

```typescript
{
  // 数据相关
  data,                      // 表格数据
  loading,                   // 加载状态（只读）
  error,                     // 错误信息（只读）
  isEmpty,                   // 数据是否为空
  hasData,                   // 是否有数据

  // 分页相关
  pagination,                // 分页信息（只读）
  paginationMobile,          // 移动端分页配置
  handleSizeChange,          // 分页大小变化
  handleCurrentChange,       // 当前页变化

  // 搜索相关
  searchParams,              // 搜索参数（响应式）
  resetSearchParams,         // 重置搜索参数

  // 数据操作
  fetchData,                 // 加载数据（保持当前页）
  getData,                   // 获取数据（重置到第一页）
  getDataDebounced,          // 防抖获取数据
  clearData,                 // 清空数据

  // 刷新策略
  refreshData,               // 全量刷新
  refreshSoft,               // 软刷新
  refreshCreate,             // 新增后刷新
  refreshUpdate,             // 更新后刷新
  refreshRemove,             // 删除后刷新

  // 缓存控制
  cacheInfo,                 // 缓存统计信息
  clearCache,                // 清除缓存
  clearExpiredCache,         // 清理过期缓存

  // 请求控制
  cancelRequest,             // 取消当前请求

  // 列配置（如果提供了 columnsFactory）
  columns,                   // 列配置
  columnChecks,              // 列显示控制
  toggleColumn,              // 切换列显示
  updateColumn,              // 更新列配置
  resetColumns               // 重置列配置
}
```

---

## useAuth - 认证管理

### 功能特性

- ✅ 登录/登出
- ✅ Token 管理
- ✅ 用户信息获取
- ✅ 权限验证

### 基础用法

```typescript
import { useAuth } from '@/hooks/core/useAuth'

const {
  isLogin,          // 是否登录
  userInfo,         // 用户信息
  hasPermission,    // 权限验证
  login,            // 登录
  logout            // 登出
} = useAuth()

// 登录
const handleLogin = async () => {
  await login({ userName: 'admin', password: '123456' })
  router.push('/dashboard')
}

// 登出
const handleLogout = () => {
  logout()
}

// 权限验证
const canEdit = hasPermission('user:edit')
```

---

## useChart - 图表管理

### 功能特性

- ✅ ECharts 实例管理
- ✅ 响应式自动 resize
- ✅ 主题切换
- ✅ 自动销毁

### 基础用法

```typescript
<script setup lang="ts">
import { useChart } from '@/hooks/core/useChart'
import { ref, onMounted } from 'vue'

const chartRef = ref<HTMLDivElement>()

const { setOptions, resize, dispose } = useChart(chartRef)

onMounted(() => {
  setOptions({
    title: { text: '用户统计' },
    xAxis: { type: 'category', data: ['一月', '二月', '三月'] },
    yAxis: { type: 'value' },
    series: [{ data: [120, 200, 150], type: 'bar' }]
  })
})
</script>

<template>
  <div ref="chartRef" style="width: 100%; height: 400px"></div>
</template>
```

---

## useCommon - 通用工具

### 功能特性

- ✅ 首页路径获取
- ✅ 主题配置
- ✅ 语言切换
- ✅ 设备信息

### 基础用法

```typescript
import { useCommon } from '@/hooks/core/useCommon'

const {
  homePath,         // 首页路径
  theme,            // 主题配置
  locale,           // 当前语言
  isMobile          // 是否移动端
} = useCommon()

// 跳转首页
router.push(homePath.value)

// 切换主题
theme.value = 'dark'
```

---

## useTableHeight - 表格高度计算

### 功能特性

- ✅ 自动计算表格高度
- ✅ 响应式适配
- ✅ 扣除页头页脚高度

### 基础用法

```typescript
<script setup lang="ts">
import { useTableHeight } from '@/hooks/core/useTableHeight'

const tableHeight = useTableHeight({
  offsetHeight: 200  // 扣除的高度
})
</script>

<template>
  <art-table :data="data" :height="tableHeight">
    <el-table-column prop="name" label="名称" />
  </art-table>
</template>
```

---

## useTableColumns - 列配置管理

### 功能特性

- ✅ 动态显示/隐藏列
- ✅ 列排序
- ✅ 配置持久化

### 基础用法

```typescript
import { useTableColumns } from '@/hooks/core/useTableColumns'

const {
  columns,          // 列配置
  columnChecks,     // 列显示控制
  toggleColumn,     // 切换列显示
  reorderColumns,   // 重新排序
  resetColumns      // 重置配置
} = useTableColumns(() => [
  { prop: 'name', label: '名称', visible: true },
  { prop: 'age', label: '年龄', visible: true },
  { prop: 'email', label: '邮箱', visible: false }
])

// 切换列显示
toggleColumn('email')

// 重置所有列配置
resetColumns()
```

---

## 自定义 Hook 开发

### Hook 模板

```typescript
import { ref, computed } from 'vue'

export function useCustom() {
  // 响应式状态
  const state = ref(initialValue)
  
  // 计算属性
  const computedValue = computed(() => state.value * 2)
  
  // 方法
  const doSomething = () => {
    state.value = newValue
  }
  
  // 返回
  return {
    state,
    computedValue,
    doSomething
  }
}
```

### 最佳实践

1. **明确职责**: 一个 Hook 只做一件事
2. **响应式设计**: 返回 ref 或 computed
3. **类型安全**: 使用 TypeScript 定义类型
4. **文档注释**: 添加详细的 JSDoc 注释
5. **可组合**: 可以在其他 Hook 中使用

---

## 相关文档

- [组件开发规范](component-development.md)
- [状态管理规范](state-management.md)
- [核心组件库](core-components.md)
