# 核心 Hooks

项目企业级 Hooks 使用指南（链接到详细文档）。

## useTable

**位置**: `src/hooks/core/useTable.ts`

企业级表格管理 Hook，自动处理分页、搜索、加载状态。

### 快速使用

```typescript
const { data, loading, pagination, fetchData } = useTable({
  core: {
    apiFn: fetchUserList,
    immediate: true
  }
})
```

### 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| data | `Ref<T[]>` | 表格数据 |
| loading | `Ref<boolean>` | 加载状态 |
| pagination | `Reactive` | 分页信息 |
| searchParams | `Reactive` | 搜索参数 |
| fetchData | `Function` | 加载数据 |
| resetSearchParams | `Function` | 重置搜索 |

### 配置选项

```typescript
interface UseTableConfig {
  core: {
    apiFn: Function      // API 函数（必填）
    immediate?: boolean  // 立即加载（默认 true）
  }
  performance?: {
    enableCache?: boolean  // 启用缓存
    debounceTime?: number  // 防抖时间
  }
}
```

**完整文档**: [docs/dev-spec/ainative-shadow/references/core-hooks.md](../../../../docs/dev-spec/ainative-shadow/references/core-hooks.md)

---

## useAuth

**位置**: `src/hooks/core/useAuth.ts`

认证相关 Hook。

```typescript
const { user, isLoggedIn, login, logout } = useAuth()
```

---

## useCommon

**位置**: `src/hooks/core/useCommon.ts`

通用工具 Hook。

```typescript
const { formatDate, formatMoney } = useCommon()
```

---

## 自定义 Hook 规范

### 命名

- 以 `use` 开头
- camelCase 命名
- 描述性名称

### 结构

```typescript
export function useCustomHook() {
  // 1. 响应式数据
  const data = ref()
  
  // 2. computed
  const computed = computed(() => ...)
  
  // 3. 方法
  const method = () => {}
  
  // 4. 生命周期（如需要）
  onMounted(() => {})
  
  // 5. 返回
  return {
    data,
    computed,
    method
  }
}
```

### 示例：自定义表单 Hook

```typescript
export function useForm<T>(initialValue: T) {
  const formRef = ref<FormInstance>()
  const formData = reactive<T>(initialValue)
  const loading = ref(false)
  
  const validate = async () => {
    return formRef.value?.validate()
  }
  
  const reset = () => {
    formRef.value?.resetFields()
  }
  
  const submit = async (apiFn: Function) => {
    await validate()
    loading.value = true
    try {
      return await apiFn(formData)
    } finally {
      loading.value = false
    }
  }
  
  return {
    formRef,
    formData,
    loading,
    validate,
    reset,
    submit
  }
}
```
