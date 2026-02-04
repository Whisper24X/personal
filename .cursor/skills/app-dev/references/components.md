# 组件库

ainative-app 内置组件库完整文档。

## 布局组件

### NavBar 导航栏

自定义导航栏，支持沉浸式状态栏适配。

```vue
<template>
  <NavBar
    title="页面标题"
    :show-back="true"
    @back="handleBack"
  />
</template>

<script setup lang="ts">
import NavBar from "@/components/NavBar/index.vue"

const handleBack = () => {
  // 自定义返回逻辑，默认 navigateBack
}
</script>
```

**Props**:
- `title` (string): 标题文字
- `showBack` (boolean): 是否显示返回按钮，默认 `true`

**Events**:
- `back`: 点击返回按钮触发

---

### TabBar 底部导航

自定义 TabBar 组件。

```vue
<template>
  <TabBar :tab-list="tabList" />
</template>

<script setup lang="ts">
import TabBar from "@/components/TabBar/index.vue"

const tabList = [
  {
    key: "home",
    title: "首页",
    icon: "🏠",
    pagePath: "/pages/index/index"
  },
  {
    key: "user",
    title: "我的",
    icon: "👤",
    pagePath: "/pages/user/profile/index"
  }
]
</script>
```

**Props**:
- `tabList` (TabItem[]): TabBar 配置

**TabItem 结构**:
```typescript
interface TabItem {
  key: string          // 唯一标识
  title: string        // 标题
  icon: string         // 图标（emoji 或图片 URL）
  pagePath: string     // 页面路径
}
```

---

### TabBarLayout 布局容器

TabBar 页面的布局容器，自动处理安全区域和 TabBar 高度。

```vue
<template>
  <TabBarLayout tab-key="home" :show-tab-bar="true">
    <view class="page-content">
      <!-- 页面内容 -->
    </view>
  </TabBarLayout>
</template>

<script setup lang="ts">
import TabBarLayout from "@/components/TabBarLayout/index.vue"
</script>
```

**Props**:
- `tabKey` (string): 当前 Tab 的 key，必填
- `showTabBar` (boolean): 是否显示 TabBar，默认 `true`

---

### StatusBar 状态栏

状态栏占位组件，用于适配刘海屏。

```vue
<template>
  <view class="page">
    <StatusBar />
    <view class="custom-navbar">
      <!-- 自定义导航栏内容 -->
    </view>
  </view>
</template>

<script setup lang="ts">
import StatusBar from "@/components/StatusBar.vue"
</script>
```

---

## 反馈组件

### Loading 加载

全屏加载组件。

```vue
<template>
  <view>
    <button @tap="showLoading">显示加载</button>
    <Loading :visible="loading" text="加载中..." />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Loading from "@/components/Loading/index.vue"

const loading = ref(false)

const showLoading = () => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 2000)
}
</script>
```

**Props**:
- `visible` (boolean): 是否显示，必填
- `text` (string): 加载文字，默认 "加载中..."

---

### Modal 模态框

确认/提示模态框。

```vue
<template>
  <view>
    <button @tap="modalVisible = true">打开模态框</button>
    
    <Modal
      :visible="modalVisible"
      title="提示"
      content="确定删除吗？"
      @confirm="handleConfirm"
      @cancel="modalVisible = false"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Modal from "@/components/Modal/index.vue"

const modalVisible = ref(false)

const handleConfirm = () => {
  console.log("确认")
  modalVisible.value = false
}
</script>
```

**Props**:
- `visible` (boolean): 是否显示，必填
- `title` (string): 标题
- `content` (string): 内容
- `confirmText` (string): 确认按钮文字，默认 "确定"
- `cancelText` (string): 取消按钮文字，默认 "取消"

**Events**:
- `confirm`: 点击确认触发
- `cancel`: 点击取消触发

---

### Toast 提示

轻量级提示组件。

```vue
<template>
  <view>
    <button @tap="showToast">显示提示</button>
    <Toast
      :visible="toastVisible"
      message="操作成功"
      type="success"
      @close="toastVisible = false"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Toast from "@/components/Toast/index.vue"

const toastVisible = ref(false)

const showToast = () => {
  toastVisible.value = true
  setTimeout(() => {
    toastVisible.value = false
  }, 2000)
}
</script>
```

**Props**:
- `visible` (boolean): 是否显示，必填
- `message` (string): 提示信息
- `type` ('success' | 'error' | 'info'): 类型，默认 'info'
- `duration` (number): 显示时长（毫秒），默认 2000

**Events**:
- `close`: 关闭时触发

**推荐使用 Taro.showToast**：
```typescript
Taro.showToast({
  title: "操作成功",
  icon: "success",
  duration: 2000
})
```

---

### EmptyState 空状态

无数据展示组件。

```vue
<template>
  <view>
    <view v-if="list.length > 0">
      <!-- 列表内容 -->
    </view>
    <EmptyState v-else message="暂无数据" />
  </view>
</template>

<script setup lang="ts">
import EmptyState from "@/components/EmptyState/index.vue"
</script>
```

**Props**:
- `message` (string): 提示信息，默认 "暂无数据"
- `image` (string): 自定义图片

---

## UI 基础组件

### UiButton 按钮

增强的按钮组件。

```vue
<template>
  <UiButton
    type="primary"
    size="large"
    :loading="loading"
    @tap="handleClick"
  >
    按钮文字
  </UiButton>
</template>

<script setup lang="ts">
import { ref } from "vue"
import UiButton from "@/components/Ui/button/index.vue"

const loading = ref(false)

const handleClick = () => {
  loading.value = true
  // 异步操作
}
</script>
```

**Props**:
- `type` ('primary' | 'default' | 'success' | 'warning' | 'danger'): 类型
- `size` ('small' | 'medium' | 'large'): 尺寸
- `loading` (boolean): 加载状态
- `disabled` (boolean): 禁用状态

**Events**:
- `tap`: 点击触发

---

## 组件使用最佳实践

### ✅ 推荐

```vue
<!-- 1. 导入组件 -->
<script setup lang="ts">
import NavBar from "@/components/NavBar/index.vue"
import Loading from "@/components/Loading/index.vue"
</script>

<!-- 2. 使用 v-if 控制显示 -->
<template>
  <EmptyState v-if="!loading && list.length === 0" />
</template>

<!-- 3. 完整的事件处理 -->
<template>
  <Modal
    :visible="modalVisible"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>
```

### ❌ 避免

```vue
<!-- 1. 避免不必要的组件嵌套 -->
<view>  <!-- ❌ 多余的包裹 -->
  <NavBar title="标题" />
</view>

<!-- 2. 避免不完整的事件处理 -->
<Modal
  :visible="modalVisible"
  @confirm="modalVisible = false"  <!-- ❌ 没有业务逻辑 -->
/>
```

## 自定义组件

### 基础模板

```vue
<template>
  <view class="my-component">
    <text>{{ title }}</text>
  </view>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from "vue"

defineOptions({ name: "MyComponent" })

interface Props {
  title: string
  count?: number
}

interface Emits {
  (e: "change", value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
})

const emit = defineEmits<Emits>()

const handleClick = () => {
  emit("change", props.count + 1)
}
</script>

<style lang="less">
@import "@/styles/variables.less";

.my-component {
  padding: @spacing-md;
  background: #fff;
}
</style>
```

## 组件通信

### Props 传递

```vue
<!-- 父组件 -->
<template>
  <ChildComponent :user="userInfo" />
</template>

<!-- 子组件 -->
<script setup lang="ts">
interface Props {
  user: UserInfo
}

const props = defineProps<Props>()
</script>
```

### Events 触发

```vue
<!-- 子组件 -->
<script setup lang="ts">
interface Emits {
  (e: "update", value: string): void
}

const emit = defineEmits<Emits>()
emit("update", "new value")
</script>

<!-- 父组件 -->
<template>
  <ChildComponent @update="handleUpdate" />
</template>
```

### Provide/Inject

```vue
<!-- 父组件 -->
<script setup lang="ts">
import { provide } from "vue"

provide("theme", "dark")
</script>

<!-- 子组件 -->
<script setup lang="ts">
import { inject } from "vue"

const theme = inject<string>("theme")
</script>
```
