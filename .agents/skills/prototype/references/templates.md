# 基础模板与 CDN 资源

管理后台与移动端完整 HTML 模板，以及 CDN 资源列表。

---

## 管理后台模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>原型 - 功能名称</title>
    <link rel="stylesheet" href="https://fp.yangcong345.com/middle/base/element-38098fc849a985d85be870cf856da4a1.css" />
    <style>
      :root {
        --primary-color: #409eff;
        --text-color: #303133;
        --bg-color: #f5f7fa;
        --spacing-lg: 24px;
        --border-radius: 4px;
        --box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
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
        background: #e6a23c;
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

    <script src="https://fp.yangcong345.com/middle/base/vue.global.prod.min-0b54d44c0a1191e01683f5d626686f5e.js"></script>
    <script src="https://fp.yangcong345.com/middle/base/element-f355e990744f69cea3292feaf7b43b40.js"></script>
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

---

## 移动端模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>原型 - 功能名称</title>
    <style>
      :root {
        --primary-color: #409eff;
        --text-color: #303133;
        --bg-color: #f5f7fa;
        --spacing-md: 12px;
        --border-radius: 4px;
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
        background: #e6a23c;
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

    <script src="https://fp.yangcong345.com/middle/base/vue.global.prod.min-0b54d44c0a1191e01683f5d626686f5e.js"></script>
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

## CDN 资源

```html
<!-- Vue 3 -->
<script src="https://fp.yangcong345.com/middle/base/vue.global.prod.min-0b54d44c0a1191e01683f5d626686f5e.js"></script>

<!-- Element Plus (管理后台) -->
<link rel="stylesheet" href="https://fp.yangcong345.com/middle/base/element-38098fc849a985d85be870cf856da4a1.css" />
<script src="https://fp.yangcong345.com/middle/base/element-f355e990744f69cea3292feaf7b43b40.js"></script>

<!-- ECharts (图表，可选) -->
<script src="https://fp.yangcong345.com/middle/base/echarts.min-b91b9de4da1677c82825c679112da8b2.js"></script>
```

### 禁止使用的 CDN（切勿使用）

以下域名**禁止**出现在原型 HTML 中：

- unpkg.com
- cdn.jsdelivr.net
- cdnjs.cloudflare.com
- element-plus.org
- 任何非 fp.yangcong345.com 的域名

---

## 默认 Design Tokens

若无法从项目提取设计 token，使用以下默认值（Element Plus 风格）：

```css
:root {
  --primary-color: #409eff;
  --success-color: #67c23a;
  --warning-color: #e6a23c;
  --error-color: #f56c6c;
  --text-color: #303133;
  --text-secondary: #909399;
  --bg-color: #f5f7fa;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --border-radius: 4px;
  --box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}
```
