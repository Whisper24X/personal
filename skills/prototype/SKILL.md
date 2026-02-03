---
name: prototype
description: Creates single-file HTML prototypes in /docs/prototype/. Uses Vue3 + Element Plus via CDN, applies project design tokens (colors, spacing from ainative-shadow/app). Outputs standalone index.html with no build needed. Use when user says "prototype", "demo", "mockup", "quick validation", "visualize idea", or needs UI preview.
---

# 单文件原型生成器

生成独立的 HTML 原型文件，双击即可演示，样式参考项目设计系统。

## 核心特性

- **单文件输出**: `docs/prototype/{feature}/index.html`
- **零依赖**: CDN 引入 Vue3/Element Plus，无需 npm install
- **样式一致**: 自动应用项目设计标准（颜色/字体/间距）
- **立即可用**: 双击打开或本地服务器预览

---

## 快速生成流程

### 1. 确定原型类型

**管理后台** (ainative-shadow 风格):

- 数据列表、表单、仪表盘、统计卡片
- 使用 Element Plus 组件
- PC 端布局（最大宽度 1200px）

**移动端** (ainative-app 风格):

- 商品列表、表单、详情页、搜索
- 原生 HTML + Vue3
- 移动端优化（最大宽度 750px）

### 2. 应用设计标准

自动应用项目 Design Tokens：

```css
:root {
  --primary-color: #1890ff;
  --success-color: #52c41a;
  --warning-color: #faad14;
  --error-color: #ff4d4f;
  --text-color: #333333;
  --text-secondary: #666666;
  --bg-color: #f5f5f5;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --border-radius: 8px;
  --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
```

### 3. 生成原型文件

**输出位置**: `docs/prototype/{feature-name}/index.html`

**文件结构**:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <!-- CDN 依赖 -->
    <!-- 设计标准 CSS -->
  </head>
  <body>
    <!--
    原型说明注释：
    - 功能描述
    - 使用方法
    - 原型限制
    - 下一步计划
  -->

    <div id="app">
      <!-- 原型标记 -->
      <div class="prototype-badge">🚧 原型</div>

      <!-- 页面内容 -->
    </div>

    <!-- Vue3 + 业务逻辑 -->
  </body>
</html>
```

---

## 基础模板

### 管理后台模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>原型 - 功能名称</title>
    <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css" />
    <style>
      :root {
        --primary-color: #1890ff;
        --text-color: #333333;
        --bg-color: #f5f5f5;
        --spacing-lg: 24px;
        --border-radius: 8px;
        --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, sans-serif;
        background: var(--bg-color);
      }
      #app {
        padding: var(--spacing-lg);
        max-width: 1200px;
        margin: 0 auto;
      }
      .prototype-badge {
        position: fixed;
        top: 10px;
        right: 10px;
        background: #faad14;
        color: white;
        padding: 8px 16px;
        border-radius: var(--border-radius);
        font-weight: 600;
        z-index: 9999;
      }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="prototype-badge">🚧 原型</div>
      <el-card>
        <template #header><span>{{ title }}</span></template>
        <!-- 内容 -->
      </el-card>
    </div>

    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <script src="https://unpkg.com/element-plus"></script>
    <script>
      const { createApp, ref } = Vue;
      createApp({
        setup() {
          const title = ref('原型标题');
          return { title };
        },
      })
        .use(ElementPlus)
        .mount('#app');
    </script>
  </body>
</html>
```

### 移动端模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>原型 - 功能名称</title>
    <style>
      :root {
        --primary-color: #1890ff;
        --text-color: #333333;
        --bg-color: #f5f5f5;
        --spacing-md: 12px;
        --border-radius: 8px;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        -webkit-tap-highlight-color: transparent;
      }
      body {
        font-family: -apple-system, sans-serif;
        background: var(--bg-color);
        max-width: 750px;
        margin: 0 auto;
      }
      .navbar {
        position: sticky;
        top: 0;
        background: white;
        padding: var(--spacing-md);
        display: flex;
        align-items: center;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      }
      .navbar-title {
        flex: 1;
        font-size: 16px;
        font-weight: 600;
        text-align: center;
      }
      .prototype-badge {
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: #faad14;
        color: white;
        padding: 6px 12px;
        border-radius: var(--border-radius);
        font-size: 12px;
        font-weight: 600;
        z-index: 9999;
      }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="prototype-badge">🚧 原型</div>
      <div class="navbar">
        <span>←</span>
        <div class="navbar-title">{{ title }}</div>
        <div style="width: 20px;"></div>
      </div>
      <!-- 内容 -->
    </div>

    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <script>
      const { createApp, ref } = Vue;
      createApp({
        setup() {
          const title = ref('页面标题');
          return { title };
        },
      }).mount('#app');
    </script>
  </body>
</html>
```

---

## 常用功能片段

### 数据加载

```javascript
const loading = ref(false);
const data = ref([]);

const fetchData = async () => {
  loading.value = true;
  await new Promise((resolve) => setTimeout(resolve, 500)); // 模拟延迟
  data.value = mockData;
  loading.value = false;
};
```

### 表单验证

```javascript
const validateForm = () => {
  if (!formData.name.trim()) {
    alert('请输入名称');
    return false;
  }
  return true;
};
```

### 数据持久化

```javascript
// 保存
localStorage.setItem('key', JSON.stringify(data.value));

// 读取
const saved = localStorage.getItem('key');
if (saved) data.value = JSON.parse(saved);
```

### 分页逻辑

```javascript
const pagination = reactive({ page: 1, pageSize: 10, total: 0 });

const getPageData = () => {
  const start = (pagination.page - 1) * pagination.pageSize;
  const end = start + pagination.pageSize;
  return allData.slice(start, end);
};
```

---

## 原型标记规范

### 顶部注释

```html
<!--
  原型名称: 用户列表
  创建时间: 2026-02-03
  
  功能说明:
  - 用户列表展示
  - 搜索筛选
  - CRUD 操作
  
  如何使用:
  1. 双击打开或使用本地服务器
  2. 测试核心功能
  
  原型限制:
  - 使用模拟数据
  - 未实现真实 API
  - 简化的错误处理
  
  下一步:
  1. 在项目中创建正式组件
  2. 对接后端 API
  3. 完善验证和错误处理
-->
```

### 视觉徽章

```html
<div class="prototype-badge">🚧 原型演示</div>
```

---

## CDN 资源

```html
<!-- Vue 3 -->
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>

<!-- Element Plus (管理后台) -->
<link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css" />
<script src="https://unpkg.com/element-plus"></script>

<!-- ECharts (图表，可选) -->
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
```

---

## 常见组件

### Element Plus 表格

```html
<el-table :data="tableData" border>
  <el-table-column prop="id" label="ID" width="80" />
  <el-table-column prop="name" label="名称" />
  <el-table-column label="操作" width="150">
    <template #default="{ row }">
      <el-button link type="primary" size="small">编辑</el-button>
    </template>
  </el-table-column>
</el-table>
```

### Element Plus 表单

```html
<el-form :model="formData" label-width="80px">
  <el-form-item label="名称">
    <el-input v-model="formData.name" />
  </el-form-item>
  <el-form-item>
    <el-button type="primary" @click="handleSubmit">提交</el-button>
  </el-form-item>
</el-form>
```

### 移动端列表

```html
<div class="card-list">
  <div class="card-item" v-for="item in list" :key="item.id">
    <div class="card-title">{{ item.title }}</div>
    <div class="card-desc">{{ item.desc }}</div>
  </div>
</div>

<style>
  .card-list {
    padding: 12px;
  }
  .card-item {
    background: white;
    padding: 12px;
    margin-bottom: 12px;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }
</style>
```

---

## 打开方式

**直接打开**: 双击 `index.html` 文件

**本地服务器** (推荐):

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .

# 访问: http://localhost:8000/docs/prototype/xxx/
```

---

## 开发检查清单

生成原型前确认：

- [ ] 确定类型（管理后台/移动端）
- [ ] 选择合适的基础模板
- [ ] 应用项目设计标准

生成原型后确认：

- [ ] 单个 HTML 文件
- [ ] 包含顶部功能说明注释
- [ ] 包含原型标记徽章
- [ ] 核心功能可演示
- [ ] 保存到 `docs/prototype/{feature}/index.html`

---

## 完整示例

详细示例请查看：

- **管理后台**: [shadow-examples.md](references/shadow-examples.md)
  - 用户列表（搜索、CRUD、分页）
  - 数据仪表盘（统计卡片、图表）
- **移动端**: [app-examples.md](references/app-examples.md)
  - 商品列表（搜索、筛选、加载更多）
  - 表单提交（头像上传、验证）
- **快速参考**: [common-prototypes.md](references/common-prototypes.md)
  - 快速模板
  - 代码片段
  - 常见问题

---

## 快速参考

### 占位图

```javascript
const placeholder = (w, h, text) => `https://via.placeholder.com/${w}x${h}/409EFF/FFFFFF?text=${text}`;
```

### 模拟延迟

```javascript
const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));
```

### 项目颜色

```
主色: #1890ff   成功: #52c41a
警告: #faad14   错误: #ff4d4f
```
