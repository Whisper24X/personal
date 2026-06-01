# 组件使用文档

本文档介绍 ainative-app 内置的通用组件库。

## 布局组件

### NavBar 导航栏

自定义导航栏组件，支持沉浸式状态栏适配。

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
  // 自定义返回逻辑
}
</script>
```

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | "" | 标题文字 |
| showBack | boolean | true | 是否显示返回按钮 |

#### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| back | - | 点击返回按钮触发 |

---

### TabBar 底部导航

自定义 TabBar 组件，支持自定义图标和选中状态。

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

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| tabList | TabItem[] | 默认首页和我的 | TabBar 配置 |

#### TabItem 结构

```typescript
interface TabItem {
  key: string          // 唯一标识
  title: string        // 标题
  icon: string         // 图标（支持 emoji 或图片 URL）
  pagePath: string     // 页面路径
}
```

---

### TabBarLayout 布局容器

TabBar 页面的布局容器，自动处理安全区域。

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

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| tabKey | string | "" | 当前 Tab 的 key |
| showTabBar | boolean | true | 是否显示 TabBar |
| navBarConfig | object | {} | NavBar 配置 |

---

### StatusBar 状态栏

状态栏占位组件，用于适配不同设备。

```vue
<template>
  <StatusBar />
  <view class="content">
    <!-- 页面内容 -->
  </view>
</template>

<script setup lang="ts">
import StatusBar from "@/components/StatusBar.vue"
</script>
```

---

## 反馈组件

### Loading 加载组件

显示加载状态。

```vue
<template>
  <Loading v-if="loading" text="加载中..." />
</template>

<script setup lang="ts">
import Loading from "@/components/Loading/index.vue"
import { ref } from "vue"

const loading = ref(true)
</script>
```

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| text | string | "加载中..." | 提示文字 |

---

### EmptyState 空状态

显示空数据状态。

```vue
<template>
  <EmptyState
    v-if="!list.length"
    text="暂无数据"
    :show-action="true"
    action-text="去添加"
    @action="handleAdd"
  />
</template>

<script setup lang="ts">
import EmptyState from "@/components/EmptyState/index.vue"
</script>
```

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| text | string | "暂无数据" | 提示文字 |
| icon | string | "" | 自定义图标 URL |
| showAction | boolean | false | 是否显示操作按钮 |
| actionText | string | "重新加载" | 按钮文字 |

#### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| action | - | 点击操作按钮触发 |

---

### Modal 模态框

弹窗确认组件。

```vue
<template>
  <Modal
    v-model:visible="showModal"
    title="提示"
    content="确定要删除吗？"
    :show-cancel="true"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

<script setup lang="ts">
import Modal from "@/components/Modal/index.vue"
import { ref } from "vue"

const showModal = ref(false)

const handleConfirm = () => {
  console.log("确认")
}

const handleCancel = () => {
  console.log("取消")
}
</script>
```

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| visible | boolean | false | 是否显示 |
| title | string | "" | 标题 |
| content | string | "" | 内容 |
| showCancel | boolean | true | 是否显示取消按钮 |
| confirmText | string | "确定" | 确认按钮文字 |
| cancelText | string | "取消" | 取消按钮文字 |

#### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| confirm | - | 点击确认触发 |
| cancel | - | 点击取消触发 |
| update:visible | boolean | 更新显示状态 |

---

### Toast 提示组件

轻量级消息提示。

```vue
<template>
  <Toast ref="toastRef" />
</template>

<script setup lang="ts">
import Toast from "@/components/Toast/index.vue"
import { ref } from "vue"

const toastRef = ref()

// 显示提示
const showToast = () => {
  toastRef.value?.show({
    message: "操作成功",
    type: "success"
  })
}
</script>
```

---

## UI 基础组件

### UiButton 按钮

通用按钮组件。

```vue
<template>
  <UiButton type="primary" block @click="handleClick">
    主要按钮
  </UiButton>
  
  <UiButton type="default" :loading="loading">
    默认按钮
  </UiButton>
  
  <UiButton type="primary" size="small" round>
    小圆角按钮
  </UiButton>
</template>

<script setup lang="ts">
import UiButton from "@/components/Ui/button/index.vue"
</script>
```

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | "primary" \| "default" | "default" | 按钮类型 |
| size | "large" \| "medium" \| "small" | "medium" | 按钮尺寸 |
| block | boolean | false | 是否块级按钮 |
| round | boolean | false | 是否圆角按钮 |
| disabled | boolean | false | 是否禁用 |
| loading | boolean | false | 是否加载中 |

---

## 使用建议

1. **按需引入**：只引入需要的组件
2. **统一风格**：使用组件库保持 UI 一致性
3. **类型安全**：使用 TypeScript 获得类型提示
4. **样式定制**：通过 CSS 变量自定义主题
5. **样式隔离**：组件样式已移除 `scoped` 属性，建议使用 BEM 命名规范或模块化 class 避免冲突

## 样式定制

组件使用 `@/styles/variables.less` 中的设计变量，可通过修改变量实现主题定制：

```less
// 自定义主题色
@primary-color: #your-color;
```

**注意事项**：
- 所有组件样式均为全局样式（无 `scoped`）
- 建议使用统一的命名前缀避免样式冲突
- 可通过 Less 变量统一管理主题样式
