# 组件开发规范

## 概述

本文档介绍 Vue 3 组件开发的最佳实践和规范,帮助开发者编写高质量、可维护的组件代码。

---

## 组件基本结构

### 推荐的组件模板

```vue
<script setup lang="ts">
/**
 * 组件名称
 * 
 * @description 组件功能描述
 * @author 作者名
 * @example
 * ```vue
 * <MyComponent :prop1="value" @event1="handler" />
 * ```
 */

import { ref, computed, onMounted } from 'vue'

// Props 定义
interface Props {
  /** 属性1说明 */
  prop1: string
  /** 属性2说明（可选） */
  prop2?: number
}

// 使用默认值
const props = withDefaults(defineProps<Props>(), {
  prop2: 0
})

// Emits 定义
interface Emits {
  (e: 'event1', value: string): void
  (e: 'event2', id: number): void
}

const emit = defineEmits<Emits>()

// 响应式数据
const count = ref(0)

// 计算属性
const doubleCount = computed(() => count.value * 2)

// 方法
const handleClick = () => {
  emit('event1', 'value')
}

// 生命周期
onMounted(() => {
  console.log('组件已挂载')
})

// 对外暴露的方法（可选）
defineExpose({
  reset: () => { count.value = 0 }
})
</script>

<template>
  <div class="my-component">
    <div>{{ count }}</div>
    <button @click="handleClick">点击</button>
  </div>
</template>

<style scoped lang="scss">
.my-component {
  padding: 16px;
  
  button {
    padding: 8px 16px;
  }
}
</style>
```

---

## Props 定义规范

### 1. 使用 TypeScript 接口

```typescript
// ✅ 推荐
interface Props {
  /** 用户名 */
  userName: string
  /** 年龄（可选） */
  age?: number
  /** 状态（默认 active） */
  status?: 'active' | 'inactive'
}

const props = withDefaults(defineProps<Props>(), {
  status: 'active'
})

// ❌ 不推荐
const props = defineProps({
  userName: String,
  age: Number,
  status: String
})
```

### 2. Props 命名规范

```typescript
// ✅ 推荐：使用 camelCase
interface Props {
  userId: number
  userName: string
  isActive: boolean
}

// ❌ 不推荐：使用 snake_case 或 PascalCase
interface Props {
  user_id: number
  UserName: string
}
```

### 3. 布尔类型 Props

```typescript
// ✅ 推荐：使用 is/has/can 前缀
interface Props {
  isVisible: boolean
  hasPermission: boolean
  canEdit: boolean
}

// 模板中使用
<template>
  <div v-if="isVisible">内容</div>
</template>
```

### 4. 复杂类型 Props

```typescript
// 定义类型
interface UserInfo {
  id: number
  name: string
  email: string
}

interface Props {
  user: UserInfo
  list: UserInfo[]
  config: Record<string, any>
}

// 使用
const props = defineProps<Props>()
```

---

## Emits 定义规范

### 1. 使用 TypeScript 定义

```typescript
// ✅ 推荐
interface Emits {
  /** 值变化事件 */
  (e: 'update:modelValue', value: string): void
  /** 删除事件 */
  (e: 'delete', id: number): void
  /** 提交事件 */
  (e: 'submit', data: FormData): void
}

const emit = defineEmits<Emits>()

// 使用
emit('update:modelValue', 'new value')
emit('delete', 123)

// ❌ 不推荐
const emit = defineEmits(['update:modelValue', 'delete', 'submit'])
```

### 2. 事件命名规范

```typescript
// ✅ 推荐：使用动词或动词短语
interface Emits {
  (e: 'click', event: MouseEvent): void
  (e: 'change', value: string): void
  (e: 'beforeClose', done: () => void): void
}

// ❌ 不推荐
interface Emits {
  (e: 'onSubmit', data: any): void  // 不要使用 on 前缀
  (e: 'user', id: number): void     // 不要使用名词
}
```

### 3. v-model 支持

```typescript
<script setup lang="ts">
interface Props {
  modelValue: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 计算属性实现双向绑定
const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>

<template>
  <input v-model="localValue" />
</template>
```

---

## 响应式数据

### 1. ref vs reactive

```typescript
// ✅ 推荐：基本类型使用 ref
const count = ref(0)
const name = ref('张三')
const isActive = ref(false)

// ✅ 推荐：对象类型使用 reactive
const state = reactive({
  count: 0,
  name: '张三',
  isActive: false
})

// ⚠️ 注意：reactive 的解构会失去响应式
const { count } = state  // count 不再是响应式

// ✅ 解决方案：使用 toRefs
const { count, name } = toRefs(state)
```

### 2. 计算属性

```typescript
// ✅ 推荐：只读计算属性
const doubleCount = computed(() => count.value * 2)

// ✅ 推荐：可写计算属性
const fullName = computed({
  get: () => `${firstName.value} ${lastName.value}`,
  set: (value) => {
    const [first, last] = value.split(' ')
    firstName.value = first
    lastName.value = last
  }
})

// ❌ 不推荐：在计算属性中修改状态
const badComputed = computed(() => {
  count.value++  // 副作用
  return count.value
})
```

### 3. 侦听器

```typescript
// ✅ 推荐：侦听 ref
watch(count, (newVal, oldVal) => {
  console.log(`count 从 ${oldVal} 变为 ${newVal}`)
})

// ✅ 推荐：侦听多个源
watch([count, name], ([newCount, newName], [oldCount, oldName]) => {
  console.log('count 或 name 变化了')
})

// ✅ 推荐：侦听 reactive 对象的属性
watch(
  () => state.count,
  (newVal) => {
    console.log('state.count 变化了')
  }
)

// ✅ 推荐：深度侦听
watch(
  state,
  (newVal) => {
    console.log('state 的任何属性变化了')
  },
  { deep: true }
)

// ✅ 推荐：立即执行
watch(
  count,
  (newVal) => {
    console.log(newVal)
  },
  { immediate: true }
)
```

---

## 生命周期

### 1. 生命周期钩子

```typescript
import { 
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted
} from 'vue'

// 挂载前
onBeforeMount(() => {
  console.log('组件即将挂载')
})

// 挂载后（常用：初始化数据、DOM 操作）
onMounted(() => {
  console.log('组件已挂载')
  fetchData()
})

// 更新前
onBeforeUpdate(() => {
  console.log('组件即将更新')
})

// 更新后
onUpdated(() => {
  console.log('组件已更新')
})

// 卸载前（常用：清理定时器、事件监听）
onBeforeUnmount(() => {
  console.log('组件即将卸载')
  clearInterval(timer)
})

// 卸载后
onUnmounted(() => {
  console.log('组件已卸载')
})
```

### 2. 清理副作用

```typescript
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

let timer: NodeJS.Timeout

onMounted(() => {
  // 设置定时器
  timer = setInterval(() => {
    console.log('tick')
  }, 1000)
  
  // 添加事件监听
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // 清理定时器
  if (timer) {
    clearInterval(timer)
  }
  
  // 移除事件监听
  window.removeEventListener('resize', handleResize)
})
</script>
```

---

## 组件通信

### 1. 父子组件通信

```typescript
// 父组件
<template>
  <ChildComponent
    :user="userInfo"
    @update="handleUpdate"
  />
</template>

<script setup lang="ts">
const userInfo = ref({ name: '张三', age: 25 })

const handleUpdate = (data: UserInfo) => {
  userInfo.value = data
}
</script>

// 子组件
<script setup lang="ts">
interface Props {
  user: UserInfo
}

interface Emits {
  (e: 'update', data: UserInfo): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleClick = () => {
  emit('update', { ...props.user, age: 26 })
}
</script>
```

### 2. 祖先后代通信 (Provide/Inject)

```typescript
// 祖先组件
<script setup lang="ts">
import { provide, ref } from 'vue'

const theme = ref('light')
const updateTheme = (newTheme: string) => {
  theme.value = newTheme
}

provide('theme', theme)
provide('updateTheme', updateTheme)
</script>

// 后代组件
<script setup lang="ts">
import { inject } from 'vue'

const theme = inject<Ref<string>>('theme')
const updateTheme = inject<(theme: string) => void>('updateTheme')

const toggleTheme = () => {
  updateTheme?.(theme?.value === 'light' ? 'dark' : 'light')
}
</script>
```

### 3. 兄弟组件通信 (Event Bus)

```typescript
// utils/eventBus.ts
import mitt from 'mitt'

export const eventBus = mitt()

// 组件 A（发送）
<script setup lang="ts">
import { eventBus } from '@/utils/eventBus'

const sendMessage = () => {
  eventBus.emit('message', { text: 'Hello' })
}
</script>

// 组件 B（接收）
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { eventBus } from '@/utils/eventBus'

const handleMessage = (data: any) => {
  console.log('收到消息:', data)
}

onMounted(() => {
  eventBus.on('message', handleMessage)
})

onUnmounted(() => {
  eventBus.off('message', handleMessage)
})
</script>
```

---

## 插槽使用

### 1. 默认插槽

```typescript
// 子组件
<template>
  <div class="card">
    <slot>默认内容</slot>
  </div>
</template>

// 父组件
<template>
  <Card>
    <p>自定义内容</p>
  </Card>
</template>
```

### 2. 具名插槽

```typescript
// 子组件
<template>
  <div class="layout">
    <header>
      <slot name="header"></slot>
    </header>
    <main>
      <slot></slot>
    </main>
    <footer>
      <slot name="footer"></slot>
    </footer>
  </div>
</template>

// 父组件
<template>
  <Layout>
    <template #header>
      <h1>标题</h1>
    </template>
    
    <p>主要内容</p>
    
    <template #footer>
      <p>页脚</p>
    </template>
  </Layout>
</template>
```

### 3. 作用域插槽

```typescript
// 子组件
<script setup lang="ts">
const items = ref([
  { id: 1, name: '项目1' },
  { id: 2, name: '项目2' }
])
</script>

<template>
  <div>
    <div v-for="item in items" :key="item.id">
      <slot :item="item" :index="index">
        {{ item.name }}
      </slot>
    </div>
  </div>
</template>

// 父组件
<template>
  <MyList>
    <template #default="{ item, index }">
      <div>{{ index + 1 }}. {{ item.name }}</div>
    </template>
  </MyList>
</template>
```

---

## 组件封装最佳实践

### 1. 单一职责原则

```typescript
// ✅ 推荐：组件只做一件事
<script setup lang="ts">
// UserAvatar.vue - 只负责显示头像
interface Props {
  avatar: string
  size?: number
}
</script>

// ❌ 不推荐：组件做太多事情
<script setup lang="ts">
// UserCard.vue - 显示头像、用户信息、操作按钮...
// 应该拆分为多个小组件
</script>
```

### 2. 可配置性

```typescript
// ✅ 推荐：提供配置选项
<script setup lang="ts">
interface Props {
  size?: 'small' | 'medium' | 'large'
  type?: 'primary' | 'success' | 'warning'
  disabled?: boolean
  loading?: boolean
}
</script>
```

### 3. 可扩展性

```typescript
// ✅ 推荐：支持插槽扩展
<template>
  <div class="card">
    <div class="card-header">
      <slot name="header">{{ title }}</slot>
    </div>
    <div class="card-body">
      <slot></slot>
    </div>
    <div class="card-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>
```

### 4. 错误边界

```typescript
<script setup lang="ts">
import { onErrorCaptured } from 'vue'

const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err
  console.error('组件错误:', err)
  return false  // 阻止错误继续向上传播
})
</script>

<template>
  <div v-if="error">
    <p>出错了: {{ error.message }}</p>
  </div>
  <div v-else>
    <slot></slot>
  </div>
</template>
```

---

## 性能优化

### 1. 使用 v-memo

```vue
<template>
  <div v-memo="[count]">
    <!-- 只有 count 变化时才重新渲染 -->
    <p>{{ count }}</p>
    <p>{{ expensiveComputation() }}</p>
  </div>
</template>
```

### 2. 使用 v-once

```vue
<template>
  <div v-once>
    <!-- 只渲染一次，永不更新 -->
    <h1>{{ staticTitle }}</h1>
  </div>
</template>
```

### 3. 异步组件

```typescript
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const HeavyComponent = defineAsyncComponent(() =>
  import('./HeavyComponent.vue')
)
</script>

<template>
  <Suspense>
    <template #default>
      <HeavyComponent />
    </template>
    <template #fallback>
      <div>加载中...</div>
    </template>
  </Suspense>
</template>
```

### 4. 虚拟列表

```typescript
// 对于大量数据，使用虚拟滚动
import { useVirtualList } from '@vueuse/core'

const { list, containerProps, wrapperProps } = useVirtualList(
  allItems,
  { itemHeight: 50 }
)
```

---

## 相关文档

- [核心 Hooks](core-hooks.md)
- [核心组件库](core-components.md)
- [样式开发规范](style-guide.md)
