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
    <link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/element-plus/2.11.4/theme-chalk/index.css" />
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

    <script src="https://cdn.bootcdn.net/ajax/libs/vue/3.5.22/vue.global.prod.min.js"></script>
    <script src="https://cdn.bootcdn.net/ajax/libs/element-plus/2.11.4/index.full.js"></script>
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

    <script src="https://cdn.bootcdn.net/ajax/libs/vue/3.5.22/vue.global.prod.min.js"></script>
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
<script src="https://cdn.bootcdn.net/ajax/libs/vue/3.5.22/vue.global.prod.min.js"></script>

<!-- Element Plus (管理后台) -->
<link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/element-plus/2.11.4/theme-chalk/index.css" />
<script src="https://cdn.bootcdn.net/ajax/libs/element-plus/2.11.4/index.full.js"></script>

<!-- ECharts (图表，可选) -->
<script src="https://cdn.bootcdn.net/ajax/libs/echarts/5.6.0/echarts.min.js"></script>
```
