# 常见原型场景快速参考

快速查找和生成常见场景的单文件 HTML 原型。

---

## 场景索引

### 管理后台场景

| 场景            | 复杂度 | 输出文件                               |
| --------------- | ------ | -------------------------------------- |
| 数据列表 + CRUD | ⭐⭐⭐ | `docs/prototype/xxx-list/index.html`   |
| 表单录入        | ⭐⭐   | `docs/prototype/xxx-form/index.html`   |
| 数据仪表盘      | ⭐⭐⭐ | `docs/prototype/dashboard/index.html`  |
| 搜索筛选        | ⭐⭐   | `docs/prototype/xxx-search/index.html` |

### 移动端场景

| 场景                        | 复杂度 | 输出文件                               |
| --------------------------- | ------ | -------------------------------------- |
| 列表页（下拉刷新/上拉加载） | ⭐⭐⭐ | `docs/prototype/xxx-list/index.html`   |
| 表单提交                    | ⭐⭐   | `docs/prototype/xxx-form/index.html`   |
| 详情页                      | ⭐⭐   | `docs/prototype/xxx-detail/index.html` |
| 搜索页                      | ⭐⭐   | `docs/prototype/search/index.html`     |

---

## 管理后台快速模板

### 模板 1: 简单列表

**用途**: 基础数据展示，无需 CRUD

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>原型 - 简单列表</title>
    <link rel="stylesheet" href="https://fp.yangcong345.com/middle/base/element-38098fc849a985d85be870cf856da4a1.css" />
    <style>
      :root {
        --primary-color: #1890ff;
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
        font-size: 14px;
        font-weight: 600;
        z-index: 9999;
      }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="prototype-badge">🚧 原型</div>

      <el-card>
        <template #header><span style="font-weight: 600;">数据列表</span></template>

        <el-table :data="tableData" border>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="value" label="数值" />
        </el-table>
      </el-card>
    </div>

    <script src="https://fp.yangcong345.com/middle/base/vue.global.prod.min-0b54d44c0a1191e01683f5d626686f5e.js"></script>
    <script src="https://fp.yangcong345.com/middle/base/element-f355e990744f69cea3292feaf7b43b40.js"></script>

    <script>
      const { createApp, ref } = Vue;
      createApp({
        setup() {
          const tableData = ref([
            { id: 1, name: '项目A', value: 100 },
            { id: 2, name: '项目B', value: 200 },
            { id: 3, name: '项目C', value: 300 },
          ]);
          return { tableData };
        },
      })
        .use(ElementPlus)
        .mount('#app');
    </script>
  </body>
</html>
```

### 模板 2: 搜索筛选

**用途**: 有搜索和筛选需求的列表

```html
<!-- 在上面模板基础上添加搜索表单 -->
<el-form :inline="true" :model="searchForm" style="margin-bottom: 16px;">
  <el-form-item label="关键词">
    <el-input v-model="searchForm.keyword" placeholder="请输入" clearable />
  </el-form-item>
  <el-form-item label="状态">
    <el-select v-model="searchForm.status" placeholder="请选择" clearable>
      <el-option label="全部" value="" />
      <el-option label="正常" value="active" />
      <el-option label="禁用" value="inactive" />
    </el-select>
  </el-form-item>
  <el-form-item>
    <el-button type="primary" @click="handleSearch">搜索</el-button>
    <el-button @click="handleReset">重置</el-button>
  </el-form-item>
</el-form>

<!-- Script 部分添加 -->
<script>
  const searchForm = reactive({ keyword: '', status: '' });

  const handleSearch = () => {
    // 筛选逻辑
    const filtered = allData.filter((item) => {
      if (searchForm.keyword && !item.name.includes(searchForm.keyword)) return false;
      if (searchForm.status && item.status !== searchForm.status) return false;
      return true;
    });
    tableData.value = filtered;
  };
</script>
```

### 模板 3: 统计卡片

**用途**: 数据概览、仪表盘

```html
<style>
  .stat-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .stat-card {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
  }
  .stat-icon {
    width: 60px;
    height: 60px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin-right: 16px;
  }
  .stat-value {
    font-size: 24px;
    font-weight: 600;
  }
  .stat-label {
    font-size: 14px;
    color: #666;
    margin-top: 4px;
  }
</style>

<div class="stat-cards">
  <div class="stat-card">
    <div class="stat-icon" style="background: rgba(24, 144, 255, 0.1); color: #1890ff;">📊</div>
    <div>
      <div class="stat-value">12,345</div>
      <div class="stat-label">总数据</div>
    </div>
  </div>
</div>
```

---

## 移动端快速模板

### 模板 1: 基础页面

**用途**: 简单的移动端页面

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>原型 - 移动端页面</title>
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

      .content {
        padding: var(--spacing-md);
      }

      .card {
        background: white;
        padding: var(--spacing-md);
        border-radius: var(--border-radius);
        margin-bottom: var(--spacing-md);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
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
        <div class="navbar-title">页面标题</div>
        <div style="width: 20px;"></div>
      </div>

      <div class="content">
        <div class="card" v-for="item in list" :key="item.id">
          <div>{{ item.title }}</div>
        </div>
      </div>
    </div>

    <script src="https://fp.yangcong345.com/middle/base/vue.global.prod.min-0b54d44c0a1191e01683f5d626686f5e.js"></script>
    <script>
      const { createApp, ref } = Vue;
      createApp({
        setup() {
          const list = ref([
            { id: 1, title: '项目1' },
            { id: 2, title: '项目2' },
          ]);
          return { list };
        },
      }).mount('#app');
    </script>
  </body>
</html>
```

### 模板 2: 带底部按钮

**用途**: 需要底部操作按钮的页面

```html
<style>
  .footer-actions {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-width: 750px;
    margin: 0 auto;
    background: white;
    padding: 16px;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
  }
  .btn {
    width: 100%;
    padding: 12px 0;
    background: #1890ff;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }
</style>

<div id="app">
  <!-- 页面内容 -->
  <div style="padding-bottom: 80px;">
    <!-- 内容区 -->
  </div>

  <!-- 底部按钮 -->
  <div class="footer-actions">
    <button class="btn" @click="handleSubmit">确定</button>
  </div>
</div>
```

### 模板 3: 搜索页面

**用途**: 带搜索功能的页面

```html
<style>
  .search-bar {
    background: white;
    padding: 12px;
    display: flex;
    gap: 8px;
  }
  .search-input {
    flex: 1;
    padding: 8px 12px;
    background: #f5f5f5;
    border: 1px solid #eeeeee;
    border-radius: 8px;
    font-size: 14px;
  }
</style>

<div class="search-bar">
  <input v-model="keyword" placeholder="搜索关键词" class="search-input" @keyup.enter="handleSearch" />
  <button @click="handleSearch" style="padding: 8px 16px; background: #1890ff; color: white; border: none; border-radius: 8px;">搜索</button>
</div>
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

### 表单验证（基础）

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

## 通用代码片段

### 延迟函数

```javascript
const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

// 使用
const fetchData = async () => {
  loading.value = true;
  await delay(800);
  // 处理数据
  loading.value = false;
};
```

### LocalStorage 持久化

```javascript
// 保存
const saveData = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// 读取
const loadData = (key, defaultValue = []) => {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : defaultValue;
};

// 删除
const removeData = (key) => {
  localStorage.removeItem(key);
};
```

### 分页逻辑

```javascript
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const fetchData = () => {
  // 筛选数据
  const filtered = allData.filter(/* 筛选条件 */);

  // 分页
  pagination.total = filtered.length;
  const start = (pagination.page - 1) * pagination.pageSize;
  const end = start + pagination.pageSize;
  tableData.value = filtered.slice(start, end);
};
```

### 表单验证

```javascript
const validateForm = () => {
  if (!formData.name.trim()) {
    alert('请输入名称');
    return false;
  }

  if (!/^1\d{10}$/.test(formData.phone)) {
    alert('请输入正确的手机号');
    return false;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    alert('请输入正确的邮箱');
    return false;
  }

  return true;
};
```

### 列表筛选

```javascript
const filterData = () => {
  return allData.filter((item) => {
    // 关键词搜索
    if (searchForm.keyword && !item.name.includes(searchForm.keyword)) {
      return false;
    }

    // 状态筛选
    if (searchForm.status && item.status !== searchForm.status) {
      return false;
    }

    // 日期范围
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      const itemDate = new Date(item.createdAt);
      if (itemDate < searchForm.dateRange[0] || itemDate > searchForm.dateRange[1]) {
        return false;
      }
    }

    return true;
  });
};
```

---

## 原型开发检查清单

### 开始前

- [ ] 确定原型类型（管理后台/移动端）
- [ ] 明确核心功能
- [ ] 选择合适的基础模板

### 开发中

- [ ] 使用项目设计 tokens（颜色、字体、间距）
- [ ] 添加原型标记徽章
- [ ] 使用模拟数据
- [ ] 添加必要的加载状态

### 完成后

- [ ] 顶部添加详细注释（功能说明、使用方法、限制、下一步）
- [ ] 核心功能可正常演示
- [ ] 在目标设备/分辨率下测试
- [ ] 保存到 `docs/prototype/{feature}/index.html`

---

## 快速参考

### 文件位置

```
docs/prototype/
├── user-list/
│   └── index.html           # 用户列表
├── dashboard/
│   └── index.html           # 数据仪表盘
├── product-list/
│   └── index.html           # 商品列表（移动端）
└── profile-edit/
    └── index.html           # 编辑资料（移动端）
```

### CDN 资源

```html
<!-- Vue 3 -->
<script src="https://fp.yangcong345.com/middle/base/vue.global.prod.min-0b54d44c0a1191e01683f5d626686f5e.js"></script>

<!-- Element Plus（管理后台） -->
<link rel="stylesheet" href="https://fp.yangcong345.com/middle/base/element-38098fc849a985d85be870cf856da4a1.css" />
<script src="https://fp.yangcong345.com/middle/base/element-f355e990744f69cea3292feaf7b43b40.js"></script>

<!-- ECharts（图表） -->
<script src="https://fp.yangcong345.com/middle/base/echarts.min-b91b9de4da1677c82825c679112da8b2.js"></script>
```

### 项目颜色（Element Plus 风格）

```
主色: #409EFF   成功: #67c23a
警告: #e6a23c   错误: #f56c6c
```

> 注：token 以项目实际为准，可从 `{root}/src/style.css`、`{root}/src/App.vue` 提取。

### 项目设计 Tokens

```css
:root {
  /* 颜色 */
  --primary-color: #409eff;
  --success-color: #67c23a;
  --warning-color: #e6a23c;
  --error-color: #f56c6c;

  /* 文字 */
  --text-color: #333333;
  --text-secondary: #666666;

  /* 背景 */
  --bg-color: #f5f5f5;

  /* 间距 */
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;

  /* 其他 */
  --border-radius: 8px;
  --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
```

### 占位图服务

```javascript
// 通用占位图
const placeholder = (width, height, text = 'Image') => `https://via.placeholder.com/${width}x${height}/409EFF/FFFFFF?text=${text}`;

// 示例
avatar: placeholder(150, 150, 'Avatar');
banner: placeholder(750, 300, 'Banner');
product: placeholder(300, 300, 'Product');
```

### 打开方式

```bash
# 方式 1: 直接双击 index.html

# 方式 2: 本地服务器（推荐）
python -m http.server 8000
# 或
npx serve .
# 或
php -S localhost:8000

# 访问: http://localhost:8000/docs/prototype/xxx/index.html
```

---

## 常见问题

### Q: 为什么不能使用相对路径引入资源？

A: 单文件原型使用 CDN，确保任何地方都能打开。

### Q: 如何预览移动端原型？

A: 使用浏览器开发者工具的移动设备模式，或在真机上打开。

### Q: 数据刷新后会丢失吗？

A: 使用 LocalStorage 可以持久化数据。

### Q: 可以添加更多依赖吗？

A: 可以，但尽量保持轻量。优先使用 CDN。

### Q: 原型可以部署吗？

A: 可以，直接部署到静态服务器或 GitHub Pages。
