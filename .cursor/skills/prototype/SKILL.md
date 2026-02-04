---
name: prototype
description: Creates single-file HTML prototypes in /docs/prototype/. Uses Vue3 + Element Plus via CDN with fixed versions for stability, applies project design tokens. Outputs standalone index.html with built-in error handling and diagnostics. Use when user says "prototype", "demo", "mockup", or needs UI preview. Optimized to prevent common preview errors (CDN loading, i18n, responsive issues).
---

# 单文件原型生成器

生成独立的 HTML 原型文件,双击即可演示,样式参考项目设计系统。

## ⚠️ 强制要求 (生成原型时必须遵守)

1. **使用固定版本 CDN** - 必须使用以下指定版本,不得使用 `@latest` 或 `@3`:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js"></script>
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/element-plus@2.5.6/dist/index.css">
   <script src="https://cdn.jsdelivr.net/npm/element-plus@2.5.6/dist/index.full.min.js"></script>
   ```

2. **Element Plus 中文配置** - 管理后台原型必须配置中文语言包:
   ```javascript
   const app = createApp({...});
   app.use(ElementPlus, {
     locale: ElementPlus.lang?.zhCn || {},
   });
   app.mount('#app');
   ```

3. **必需的 Meta 标签** - 移动端原型必须包含完整 viewport:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
   ```

4. **图表容器尺寸** - 使用 ECharts 时容器必须有明确高度:
   ```css
   .chart-container { height: 400px; }
   ```

5. **响应式数据** - 使用 `ref()` 或 `reactive()`,避免解构:
   ```javascript
   // ✅ 正确
   const data = ref([]);
   const formData = reactive({ name: '' });
   
   // ❌ 错误
   const { name } = reactive({ name: '' });
   ```

---

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
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>原型 - 功能名称</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/element-plus@2.5.6/dist/index.css">
  <style>
    :root {
      --primary-color: #1890ff;
      --text-color: #333333;
      --bg-color: #f5f5f5;
      --spacing-lg: 24px;
      --border-radius: 8px;
      --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: var(--bg-color); }
    #app { padding: var(--spacing-lg); max-width: 1200px; margin: 0 auto; }
    .prototype-badge {
      position: fixed; top: 10px; right: 10px;
      background: #faad14; color: white; padding: 8px 16px;
      border-radius: var(--border-radius); font-weight: 600; z-index: 9999;
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

  <script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/element-plus@2.5.6/dist/index.full.min.js"></script>
  <script>
    const { createApp, ref } = Vue;
    createApp({
      setup() {
        const title = ref('原型标题');
        return { title };
      }
    }).use(ElementPlus).mount('#app');
  </script>
</body>
</html>
```

### 移动端模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>原型 - 功能名称</title>
  <style>
    :root {
      --primary-color: #1890ff;
      --text-color: #333333;
      --bg-color: #f5f5f5;
      --spacing-md: 12px;
      --border-radius: 8px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { font-family: -apple-system, sans-serif; background: var(--bg-color); max-width: 750px; margin: 0 auto; }
    .navbar {
      position: sticky; top: 0; background: white; padding: var(--spacing-md);
      display: flex; align-items: center; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    }
    .navbar-title { flex: 1; font-size: 16px; font-weight: 600; text-align: center; }
    .prototype-badge {
      position: fixed; bottom: 10px; right: 10px;
      background: #faad14; color: white; padding: 6px 12px;
      border-radius: var(--border-radius); font-size: 12px; font-weight: 600; z-index: 9999;
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

  <script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js"></script>
  <script>
    const { createApp, ref } = Vue;
    createApp({
      setup() {
        const title = ref('页面标题');
        return { title };
      }
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
  await new Promise(resolve => setTimeout(resolve, 500)); // 模拟延迟
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
<script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js"></script>

<!-- Element Plus (管理后台) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/element-plus@2.5.6/dist/index.css">
<script src="https://cdn.jsdelivr.net/npm/element-plus@2.5.6/dist/index.full.min.js"></script>

<!-- ECharts (图表，可选) -->
<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
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
.card-list { padding: 12px; }
.card-item {
  background: white; padding: 12px; margin-bottom: 12px;
  border-radius: 8px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
</style>
```

---

## 常见预览错误和解决方案

### 1. 页面空白或 Vue 未加载

**症状**: 页面一片空白,控制台报错 `Vue is not defined`

**原因**: CDN 资源加载失败或被网络拦截

**解决方案**:

```html
<!-- 添加错误检测和降级方案 -->
<script>
  // 检测 Vue 是否加载成功
  window.addEventListener('load', function() {
    if (typeof Vue === 'undefined') {
      document.body.innerHTML = `
        <div style="padding: 40px; text-align: center; font-family: sans-serif;">
          <h2 style="color: #ff4d4f;">❌ 资源加载失败</h2>
          <p>Vue 框架加载失败,请检查网络连接或更换 CDN</p>
          <button onclick="location.reload()" style="padding: 10px 20px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            重新加载
          </button>
        </div>
      `;
    }
  });
</script>
```

### 2. Element Plus 组件显示英文

**症状**: 日期选择器、分页等组件显示英文文本

**原因**: 未配置中文语言包

**解决方案**:

```html
<!-- 方案 1: 使用内置语言包 (推荐) -->
<script>
  const app = createApp({...});
  app.use(ElementPlus, {
    locale: ElementPlus.lang.zhCn,  // 配置中文
  });
  app.mount('#app');
</script>

<!-- 方案 2: 如果方案 1 不生效,引入独立语言包 -->
<script src="https://cdn.jsdelivr.net/npm/element-plus@2.5.6/dist/locale/zh-cn.min.js"></script>
```

### 3. 图表不显示或报错

**症状**: ECharts 图表区域空白

**原因**: DOM 元素未准备好或尺寸为 0

**解决方案**:

```javascript
onMounted(() => {
  // 使用 nextTick 确保 DOM 已渲染
  nextTick(() => {
    const chartDom = chartRef.value;
    if (!chartDom) return;
    
    // 确保容器有明确的宽高
    if (chartDom.offsetWidth === 0) {
      console.error('图表容器宽度为 0,请检查 CSS');
      return;
    }
    
    const chart = echarts.init(chartDom);
    chart.setOption({...});
    
    // 响应式调整
    window.addEventListener('resize', () => chart.resize());
  });
});
```

```css
/* 确保图表容器有明确高度 */
.chart-container {
  height: 400px;  /* 必须设置具体高度 */
  width: 100%;
}
```

### 4. v-model 不工作

**症状**: 输入框无法输入或数据不更新

**原因**: 使用了 `reactive()` 但解构了属性

**错误示例**:

```javascript
const { name, email } = reactive({ name: '', email: '' });  // ❌ 失去响应性
```

**正确示例**:

```javascript
// 方案 1: 使用 ref
const name = ref('');
const email = ref('');

// 方案 2: 使用 reactive 但不解构
const formData = reactive({ name: '', email: '' });
// 模板中: v-model="formData.name"
```

### 5. 移动端样式错乱

**症状**: 移动端页面布局异常,字体过小

**原因**: 缺少 viewport meta 标签或配置错误

**解决方案**:

```html
<head>
  <!-- 必须添加完整的 viewport 配置 -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  
  <style>
    /* 为移动端添加最大宽度限制 */
    body {
      max-width: 750px;
      margin: 0 auto;
    }
    
    /* 禁用 iOS 点击高亮 */
    * {
      -webkit-tap-highlight-color: transparent;
    }
  </style>
</head>
```

### 6. LocalStorage 数据丢失

**症状**: 刷新后数据消失

**原因**: 跨域限制或浏览器隐私模式

**解决方案**:

```javascript
// 添加错误处理
const saveData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage 不可用,可能处于隐私模式');
    // 降级到内存存储
    window._memoryStorage = window._memoryStorage || {};
    window._memoryStorage[key] = data;
  }
};

const loadData = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    // 从内存存储读取
    return window._memoryStorage?.[key] || defaultValue;
  }
};
```

### 7. 控制台警告: "Extraneous non-props attributes"

**症状**: 功能正常但控制台有警告

**原因**: 向组件传递了未声明的 props

**解决方案**:

```html
<!-- 使用 v-bind="$attrs" 继承属性 -->
<el-button v-bind="$attrs">按钮</el-button>

<!-- 或在 setup 中显式声明 props -->
<script>
defineProps({
  type: String,
  size: String
});
</script>
```

---

## 最佳实践

### 1. 使用固定版本号

**❌ 不推荐**:
```html
<script src="https://unpkg.com/vue@3"></script>  <!-- 可能加载不兼容版本 -->
```

**✅ 推荐**:
```html
<script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js"></script>
```

### 2. 添加加载状态

```html
<style>
  /* 页面加载时显示 */
  .app-loading {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    font-size: 18px;
    color: #666;
  }
</style>

<div id="app">
  <div class="app-loading">⏳ 加载中...</div>
</div>

<script>
  createApp({...}).mount('#app');  // 挂载后自动替换加载提示
</script>
```

### 3. 使用本地服务器预览

直接双击 HTML 文件可能遇到跨域问题,建议使用本地服务器:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .

# VS Code: 安装 Live Server 插件,右键 -> Open with Live Server
```

### 4. 生产环境使用压缩版本

```html
<!-- 开发环境: 完整版(有警告信息) -->
<script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.js"></script>

<!-- 生产环境: 压缩版(体积小,性能好) -->
<script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js"></script>
```

### 5. 合理使用 CSS 变量

```css
:root {
  /* 项目标准颜色 */
  --primary-color: #1890ff;
  --success-color: #52c41a;
  --warning-color: #faad14;
  --error-color: #ff4d4f;
  
  /* 文本颜色 */
  --text-primary: #333333;
  --text-secondary: #666666;
  --text-disabled: #999999;
  
  /* 间距标准 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  
  /* 圆角和阴影 */
  --border-radius: 8px;
  --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 使用变量 */
.button {
  background: var(--primary-color);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--border-radius);
}
```

### 6. 错误边界处理

```javascript
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue 错误:', err, info);
  alert('发生错误,请刷新页面重试');
};
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

生成原型前确认:
- [ ] 确定类型(管理后台/移动端)
- [ ] 选择合适的基础模板
- [ ] 应用项目设计标准
- [ ] 使用固定版本号的 CDN

生成原型后确认:
- [ ] 单个 HTML 文件
- [ ] 包含顶部功能说明注释
- [ ] 包含原型标记徽章
- [ ] 核心功能可演示
- [ ] 保存到 `docs/prototype/{feature}/index.html`

预览验证清单:
- [ ] 页面正常加载,无空白
- [ ] 控制台无严重错误
- [ ] Vue 和 Element Plus 正常工作
- [ ] 中文显示正确(非英文)
- [ ] 响应式布局正常
- [ ] 交互功能可用(点击、输入等)
- [ ] 移动端/PC 端显示正常
- [ ] 浏览器兼容性良好(Chrome/Safari/Firefox)

---

## 完整示例

详细示例请查看:

- **管理后台**: [shadow-examples.md](references/shadow-examples.md)
  - 用户列表(搜索、CRUD、分页)
  - 数据仪表盘(统计卡片、图表)
  
- **移动端**: [app-examples.md](references/app-examples.md)
  - 商品列表(搜索、筛选、加载更多)
  - 表单提交(头像上传、验证)
  
- **故障排查**: [troubleshooting.md](references/troubleshooting.md) ⭐
  - 常见预览错误速查表
  - 详细问题诊断步骤
  - CDN/Vue/Element Plus/ECharts 问题解决
  - 移动端/性能/兼容性优化
  - 调试技巧和应急预案
  
- **快速参考**: [common-prototypes.md](references/common-prototypes.md)
  - 快速模板
  - 代码片段
  - 常见问题

---

## 快速参考

### 占位图

```javascript
const placeholder = (w, h, text) => 
  `https://via.placeholder.com/${w}x${h}/409EFF/FFFFFF?text=${text}`;
```

### 模拟延迟

```javascript
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));
```

### 项目颜色

```
主色: #1890ff   成功: #52c41a
警告: #faad14   错误: #ff4d4f
```
