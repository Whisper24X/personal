# 核心组件库

## 概述

项目封装了一系列企业级组件,基于 Element Plus 二次封装,提供更便捷的业务开发体验。

**位置**: `src/components/core/`

---

## 组件分类

### 1. 表格组件

#### art-table

企业级表格组件,支持分页、排序、筛选等功能。

```vue
<template>
  <art-table
    :data="tableData"
    :loading="loading"
    :height="600"
    border
    stripe
  >
    <el-table-column prop="name" label="姓名" />
    <el-table-column prop="age" label="年龄" />
    <el-table-column prop="address" label="地址" />
    <el-table-column label="操作" width="180">
      <template #default="{ row }">
        <el-button link @click="handleEdit(row)">编辑</el-button>
        <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
      </template>
    </el-table-column>
  </art-table>
</template>

<script setup lang="ts">
import { useTable } from '@/hooks/core/useTable'
import { fetchGetUserList } from '@/api/user'

const { data: tableData, loading } = useTable({
  core: { apiFn: fetchGetUserList }
})
</script>
```

**Props:**
- `data`: 表格数据
- `loading`: 加载状态
- `height`: 表格高度
- 继承 Element Plus Table 所有属性

---

### 2. 表单组件

#### art-form

动态表单组件,支持配置式表单生成。

```vue
<template>
  <art-form
    ref="formRef"
    :model="formData"
    :config="formConfig"
    :rules="formRules"
    label-width="120px"
  >
    <template #footer>
      <el-button @click="handleReset">重置</el-button>
      <el-button type="primary" @click="handleSubmit">提交</el-button>
    </template>
  </art-form>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const formRef = ref()

const formData = reactive({
  userName: '',
  email: '',
  phone: '',
  status: '1'
})

const formConfig = [
  {
    type: 'input',
    prop: 'userName',
    label: '用户名',
    placeholder: '请输入用户名'
  },
  {
    type: 'input',
    prop: 'email',
    label: '邮箱',
    placeholder: '请输入邮箱'
  },
  {
    type: 'input',
    prop: 'phone',
    label: '手机号',
    placeholder: '请输入手机号'
  },
  {
    type: 'select',
    prop: 'status',
    label: '状态',
    options: [
      { label: '启用', value: '1' },
      { label: '禁用', value: '2' }
    ]
  }
]

const formRules = {
  userName: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  console.log('提交数据:', formData)
}

const handleReset = () => {
  formRef.value?.resetFields()
}
</script>
```

**表单项类型:**
- `input`: 输入框
- `textarea`: 多行文本
- `select`: 下拉选择
- `radio`: 单选框
- `checkbox`: 多选框
- `date`: 日期选择
- `daterange`: 日期范围
- `time`: 时间选择
- `number`: 数字输入
- `switch`: 开关
- `upload`: 文件上传

#### art-search-bar

搜索栏组件,快速构建搜索表单。

```vue
<template>
  <art-search-bar
    :model="searchParams"
    :config="searchConfig"
    @search="handleSearch"
    @reset="handleReset"
  />
</template>

<script setup lang="ts">
import { reactive } from 'vue'

const searchParams = reactive({
  userName: '',
  status: '',
  dateRange: []
})

const searchConfig = [
  {
    type: 'input',
    prop: 'userName',
    label: '用户名',
    placeholder: '请输入用户名'
  },
  {
    type: 'select',
    prop: 'status',
    label: '状态',
    options: [
      { label: '全部', value: '' },
      { label: '启用', value: '1' },
      { label: '禁用', value: '2' }
    ]
  },
  {
    type: 'daterange',
    prop: 'dateRange',
    label: '创建时间'
  }
]

const handleSearch = () => {
  console.log('搜索参数:', searchParams)
}

const handleReset = () => {
  console.log('重置搜索')
}
</script>
```

---

### 3. 图表组件

#### art-line-chart

折线图组件。

```vue
<template>
  <art-line-chart
    :data="chartData"
    :options="chartOptions"
    height="400px"
  />
</template>

<script setup lang="ts">
const chartData = {
  xAxis: ['一月', '二月', '三月', '四月', '五月'],
  series: [
    {
      name: '销量',
      data: [120, 200, 150, 80, 70]
    }
  ]
}

const chartOptions = {
  title: '月度销量统计',
  smooth: true
}
</script>
```

#### art-bar-chart

柱状图组件。

```vue
<template>
  <art-bar-chart
    :data="chartData"
    :options="chartOptions"
    height="400px"
  />
</template>

<script setup lang="ts">
const chartData = {
  xAxis: ['产品A', '产品B', '产品C', '产品D'],
  series: [
    {
      name: '销量',
      data: [320, 302, 301, 334]
    }
  ]
}
</script>
```

#### art-ring-chart

环形图组件。

```vue
<template>
  <art-ring-chart
    :data="chartData"
    :options="chartOptions"
    height="400px"
  />
</template>

<script setup lang="ts">
const chartData = [
  { name: '直接访问', value: 335 },
  { name: '邮件营销', value: 310 },
  { name: '联盟广告', value: 234 },
  { name: '视频广告', value: 135 }
]
</script>
```

---

### 4. 卡片组件

#### art-stats-card

统计卡片组件。

```vue
<template>
  <art-stats-card
    title="总用户数"
    value="8,846"
    icon="user"
    color="#409eff"
    :trend="{ value: 12.5, isUp: true }"
  />
</template>
```

**Props:**
- `title`: 标题
- `value`: 数值
- `icon`: 图标
- `color`: 颜色
- `trend`: 趋势 `{ value: number, isUp: boolean }`

#### art-data-list-card

数据列表卡片。

```vue
<template>
  <art-data-list-card
    title="最新订单"
    :data="orderList"
    :columns="columns"
  />
</template>

<script setup lang="ts">
const orderList = [
  { id: '1', user: '张三', amount: 199 },
  { id: '2', user: '李四', amount: 299 }
]

const columns = [
  { label: '订单号', prop: 'id' },
  { label: '用户', prop: 'user' },
  { label: '金额', prop: 'amount' }
]
</script>
```

---

### 5. 布局组件

#### art-header-bar

页面头部组件。

```vue
<template>
  <art-header-bar
    title="用户管理"
    :breadcrumbs="breadcrumbs"
  >
    <template #extra>
      <el-button type="primary" @click="handleAdd">新增用户</el-button>
    </template>
  </art-header-bar>
</template>

<script setup lang="ts">
const breadcrumbs = [
  { title: '首页', path: '/' },
  { title: '系统管理', path: '/system' },
  { title: '用户管理' }
]
</script>
```

#### art-page-content

页面内容容器。

```vue
<template>
  <art-page-content>
    <art-search-bar />
    <art-table />
  </art-page-content>
</template>
```

---

### 6. 功能组件

#### art-excel-export

Excel 导出组件。

```vue
<template>
  <art-excel-export
    :data="tableData"
    :columns="exportColumns"
    filename="用户列表"
  >
    <el-button>导出 Excel</el-button>
  </art-excel-export>
</template>

<script setup lang="ts">
const exportColumns = [
  { label: '用户名', prop: 'userName' },
  { label: '邮箱', prop: 'email' },
  { label: '手机号', prop: 'phone' }
]
</script>
```

#### art-excel-import

Excel 导入组件。

```vue
<template>
  <art-excel-import
    :columns="importColumns"
    @success="handleImportSuccess"
  >
    <el-button>导入 Excel</el-button>
  </art-excel-import>
</template>

<script setup lang="ts">
const importColumns = [
  { label: '用户名', prop: 'userName' },
  { label: '邮箱', prop: 'email' },
  { label: '手机号', prop: 'phone' }
]

const handleImportSuccess = (data: any[]) => {
  console.log('导入数据:', data)
}
</script>
```

#### art-drag-verify

拖动验证组件。

```vue
<template>
  <art-drag-verify
    text="请按住滑块，拖动到最右边"
    @success="handleVerifySuccess"
  />
</template>

<script setup lang="ts">
const handleVerifySuccess = () => {
  console.log('验证成功')
}
</script>
```

---

### 7. 媒体组件

#### art-video-player

视频播放器组件。

```vue
<template>
  <art-video-player
    :url="videoUrl"
    :poster="posterUrl"
    autoplay
  />
</template>

<script setup lang="ts">
const videoUrl = 'https://example.com/video.mp4'
const posterUrl = 'https://example.com/poster.jpg'
</script>
```

#### art-cutter-img

图片裁剪组件。

```vue
<template>
  <art-cutter-img
    :aspect-ratio="1"
    @crop-success="handleCropSuccess"
  >
    <el-button>选择图片</el-button>
  </art-cutter-img>
</template>

<script setup lang="ts">
const handleCropSuccess = (blob: Blob) => {
  console.log('裁剪后的图片:', blob)
}
</script>
```

---

### 8. 文本组件

#### art-count-to

数字滚动组件。

```vue
<template>
  <art-count-to
    :start="0"
    :end="8846"
    :duration="2000"
  />
</template>
```

#### art-text-scroll

文本滚动组件。

```vue
<template>
  <art-text-scroll
    :list="noticeList"
    :speed="50"
  />
</template>

<script setup lang="ts">
const noticeList = [
  '系统将于今晚 22:00 进行维护',
  '新功能上线，欢迎体验',
  '请及时修改初始密码'
]
</script>
```

---

### 9. 其他组件

#### art-logo

Logo 组件。

```vue
<template>
  <art-logo
    :collapsed="isCollapse"
    @click="handleLogoClick"
  />
</template>
```

#### art-svg-icon

SVG 图标组件。

```vue
<template>
  <art-svg-icon
    name="user"
    :size="24"
    color="#409eff"
  />
</template>
```

#### art-watermark

水印组件。

```vue
<template>
  <art-watermark
    content="内部资料"
    :font-size="16"
    :opacity="0.15"
  >
    <div>需要添加水印的内容</div>
  </art-watermark>
</template>
```

---

## 组件使用规范

### 1. 全局注册

在 `main.ts` 中全局注册：

```typescript
import { createApp } from 'vue'
import App from './App.vue'
import ArtTable from '@/components/core/tables/art-table/index.vue'

const app = createApp(App)

app.component('ArtTable', ArtTable)

app.mount('#app')
```

### 2. 局部注册

在组件中按需引入：

```vue
<script setup lang="ts">
import ArtTable from '@/components/core/tables/art-table/index.vue'
import ArtForm from '@/components/core/forms/art-form/index.vue'
</script>

<template>
  <art-table />
  <art-form />
</template>
```

### 3. 自动注册

使用 `unplugin-vue-components` 自动注册：

```typescript
// vite.config.ts
import Components from 'unplugin-vue-components/vite'

export default defineConfig({
  plugins: [
    Components({
      dts: 'src/types/import/components.d.ts',
      dirs: ['src/components/core'],
      deep: true
    })
  ]
})
```

---

## 自定义组件开发

### 1. 组件目录结构

```
components/
└── business/
    └── user-selector/
        ├── index.vue          # 组件主文件
        ├── types.ts           # 类型定义
        └── README.md          # 组件文档
```

### 2. 组件模板

```vue
<!-- index.vue -->
<script setup lang="ts">
/**
 * 用户选择器组件
 * 
 * @description 提供用户选择功能
 * @author Your Name
 * @example
 * ```vue
 * <UserSelector v-model="selectedUser" />
 * ```
 */

import type { UserItem } from './types'

interface Props {
  /** 已选用户ID */
  modelValue?: string
  /** 是否多选 */
  multiple?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false
})

const emit = defineEmits<Emits>()

// 组件逻辑...
</script>

<template>
  <div class="user-selector">
    <!-- 组件模板 -->
  </div>
</template>

<style scoped lang="scss">
.user-selector {
  // 样式...
}
</style>
```

---

## 常见问题

### Q1: 如何扩展核心组件?

**A**: 通过插槽或继承方式扩展

```vue
<!-- 使用插槽扩展 -->
<template>
  <art-table :data="data">
    <template #header>
      <div>自定义表头</div>
    </template>
  </art-table>
</template>

<!-- 继承扩展 -->
<script setup lang="ts">
import ArtTable from '@/components/core/tables/art-table/index.vue'

// 在 ArtTable 基础上增加功能
</script>
```

### Q2: 组件样式如何自定义?

**A**: 使用 CSS 变量或深度选择器

```vue
<style>
/* 使用 CSS 变量 */
.art-table {
  --table-border-color: #dcdfe6;
  --table-header-bg: #f5f7fa;
}

/* 使用深度选择器 */
:deep(.el-table__header) {
  background-color: #f5f7fa;
}
</style>
```

---

## 相关文档

- [组件开发规范](component-development.md)
- [样式开发规范](style-guide.md)
- [核心 Hooks](core-hooks.md)
