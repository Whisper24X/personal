# 原型预览问题排查指南

快速定位和解决原型预览错误的完整指南。

---

## 快速诊断工具

在原型 HTML 的 `<head>` 末尾添加以下诊断代码:

```html
<script>
  // 资源加载诊断
  window.addEventListener('load', function() {
    const errors = [];
    
    if (typeof Vue === 'undefined') {
      errors.push('❌ Vue 未加载');
    } else {
      console.log('✅ Vue 版本:', Vue.version);
    }
    
    if (typeof ElementPlus === 'undefined') {
      errors.push('❌ Element Plus 未加载');
    } else {
      console.log('✅ Element Plus 已加载');
    }
    
    if (typeof echarts !== 'undefined') {
      console.log('✅ ECharts 版本:', echarts.version);
    }
    
    if (errors.length > 0) {
      alert('资源加载失败:\n' + errors.join('\n') + '\n\n请检查网络连接或更换 CDN');
    } else {
      console.log('🎉 所有资源加载成功!');
    }
  });
  
  // Vue 错误捕获
  window.addEventListener('error', function(e) {
    console.error('全局错误:', e.message, e.filename, e.lineno);
  });
</script>
```

---

## 常见错误速查表

| 症状 | 可能原因 | 快速解决 |
|-----|---------|---------|
| 页面完全空白 | Vue 未加载 | 检查 CDN,查看网络面板 |
| `Uncaught ReferenceError: Vue is not defined` | script 标签顺序错误 | Vue 必须在业务代码之前加载 |
| `Cannot read property 'mount' of undefined` | createApp 返回值未保存 | `const app = createApp({...})` |
| Element Plus 显示英文 | 缺少中文配置 | 添加 `locale: ElementPlus.lang.zhCn` |
| 图表不显示 | 容器高度为 0 | CSS 设置明确高度 `height: 400px` |
| 输入框无法输入 | ref/reactive 使用错误 | 避免解构 reactive 对象 |
| `__dirname is not defined` | 使用了 Node.js API | 删除 Node.js 专用代码 |
| 移动端布局错乱 | 缺少 viewport | 添加完整 viewport meta |
| 数据刷新后丢失 | localStorage 不可用 | 添加 try-catch 错误处理 |
| CORS 错误 | 直接打开 file:// | 使用本地服务器 |

---

## 问题分类详解

### 1. CDN 加载问题

**症状**: 页面空白,控制台显示 404 或超时

**排查步骤**:

1. 打开浏览器开发者工具 (F12) → Network 标签
2. 刷新页面,查看红色请求
3. 检查失败的资源 URL

**解决方案**:

```html
<!-- 方案 1: 更换 CDN -->
<!-- 从 unpkg 换到 jsdelivr -->
<script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js"></script>

<!-- 方案 2: 添加备用 CDN -->
<script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js"></script>
<script>
  if (typeof Vue === 'undefined') {
    document.write('<script src="https://unpkg.com/vue@3.4.21/dist/vue.global.prod.js"><\/script>');
  }
</script>

<!-- 方案 3: 离线使用 - 下载到本地 -->
<!-- 下载 vue.global.prod.js 放在同目录 -->
<script src="./vue.global.prod.js"></script>
```

### 2. Vue 应用挂载失败

**症状**: 控制台报错 `Failed to mount app`

**常见原因**:

```javascript
// ❌ 错误 1: 重复挂载
createApp({...}).mount('#app');
createApp({...}).mount('#app');  // 第二次会失败

// ❌ 错误 2: DOM 未准备好
<script>
  createApp({...}).mount('#app');  // #app 还不存在
</script>
<div id="app"></div>  // 在 script 之后

// ✅ 正确: script 放在 body 末尾
<body>
  <div id="app"></div>
  <script>
    createApp({...}).mount('#app');
  </script>
</body>
```

### 3. Element Plus 中文问题

**症状**: 分页显示 "items/page",日期选择器显示英文

**完整解决方案**:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/element-plus@2.5.6/dist/index.css">
</head>
<body>
  <div id="app">
    <el-date-picker v-model="date" />
  </div>

  <script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/element-plus@2.5.6/dist/index.full.min.js"></script>
  
  <script>
    const { createApp, ref } = Vue;
    
    const app = createApp({
      setup() {
        const date = ref('');
        return { date };
      }
    });
    
    // 方法 1: 使用内置语言包 (推荐)
    if (ElementPlus.lang && ElementPlus.lang.zhCn) {
      app.use(ElementPlus, {
        locale: ElementPlus.lang.zhCn,
      });
    } else {
      app.use(ElementPlus);
      console.warn('中文语言包不可用,使用默认语言');
    }
    
    app.mount('#app');
  </script>
</body>
</html>
```

**如果方法 1 不生效,使用方法 2**:

```html
<!-- 单独引入中文语言包 -->
<script src="https://cdn.jsdelivr.net/npm/element-plus@2.5.6/dist/locale/zh-cn.min.js"></script>

<script>
  app.use(ElementPlus, {
    locale: ElementPlusLocaleZhCn,  // 使用独立语言包
  });
</script>
```

### 4. ECharts 图表问题

**问题 A: 图表不显示**

```javascript
// ❌ 错误: 容器没有高度
<div ref="chartRef"></div>  // 高度为 0

// ✅ 正确: 设置明确高度
<div ref="chartRef" style="height: 400px;"></div>

// ❌ 错误: DOM 未准备好
onMounted(() => {
  const chart = echarts.init(chartRef.value);  // chartRef.value 可能是 null
  chart.setOption({...});
});

// ✅ 正确: 添加检查和延迟
onMounted(() => {
  nextTick(() => {
    if (!chartRef.value) {
      console.error('图表容器未找到');
      return;
    }
    
    if (chartRef.value.offsetWidth === 0) {
      console.error('图表容器宽度为 0');
      return;
    }
    
    const chart = echarts.init(chartRef.value);
    chart.setOption({...});
  });
});
```

**问题 B: 图表不响应窗口大小**

```javascript
onMounted(() => {
  const chart = echarts.init(chartRef.value);
  chart.setOption({...});
  
  // 添加窗口 resize 监听
  const handleResize = () => chart.resize();
  window.addEventListener('resize', handleResize);
  
  // 组件卸载时清理
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    chart.dispose();
  });
});
```

### 5. 响应式数据问题

**问题: v-model 不工作**

```javascript
// ❌ 错误: 解构 reactive 对象
const { name, email } = reactive({ name: '', email: '' });
// 模板: <input v-model="name" />  不会更新

// ✅ 正确: 不解构
const formData = reactive({ name: '', email: '' });
// 模板: <input v-model="formData.name" />

// ✅ 或者使用 ref
const name = ref('');
const email = ref('');
// 模板: <input v-model="name" />
```

**问题: 数组/对象更新不响应**

```javascript
// ❌ 错误: 直接修改数组索引
list.value[0] = newItem;

// ✅ 正确: 使用数组方法
list.value.splice(0, 1, newItem);
// 或
list.value = [...list.value.slice(0, 0), newItem, ...list.value.slice(1)];

// ❌ 错误: 添加新属性
obj.newProp = 'value';

// ✅ 正确: 使用扩展运算符
obj = { ...obj, newProp: 'value' };
```

### 6. 移动端预览问题

**问题: 页面缩放异常**

```html
<!-- ❌ 错误: 缺少 viewport -->
<head>
  <meta charset="UTF-8">
</head>

<!-- ✅ 正确: 完整 viewport 配置 -->
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
</head>
```

**问题: 点击延迟 300ms**

```css
/* 添加到全局样式 */
* {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;  /* 禁用双击缩放 */
}

button, a, [role="button"] {
  cursor: pointer;
  user-select: none;
}
```

### 7. LocalStorage 问题

**问题: 隐私模式或跨域导致 LocalStorage 不可用**

```javascript
// 健壮的 LocalStorage 封装
const storage = {
  _memory: {},  // 内存备份
  
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('LocalStorage 不可用,使用内存存储', e);
      this._memory[key] = value;
    }
  },
  
  getItem(key) {
    try {
      return localStorage.getItem(key) || this._memory[key] || null;
    } catch (e) {
      return this._memory[key] || null;
    }
  },
  
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
    delete this._memory[key];
  }
};

// 使用
storage.setItem('key', JSON.stringify(data));
const data = JSON.parse(storage.getItem('key') || '[]');
```

---

## 浏览器兼容性问题

### Chrome/Edge (推荐)

✅ 完全支持,无已知问题

### Safari

⚠️ 注意事项:

```css
/* Safari 需要前缀 */
.scroll-container {
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
}

/* 日期输入框样式 */
input[type="date"] {
  -webkit-appearance: none;
  appearance: none;
}
```

### Firefox

⚠️ 注意事项:

```javascript
// Firefox 不支持 scrollIntoViewIfNeeded
// 使用标准方法
element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
```

### 低版本浏览器 (IE11)

❌ 不支持,Vue 3 需要现代浏览器

最低要求:
- Chrome 64+
- Edge 79+
- Firefox 67+
- Safari 12+

---

## 性能优化建议

### 1. 使用生产版本

```html
<!-- 开发版 (大,有警告) -->
<script src=".../vue.global.js"></script>

<!-- 生产版 (小,优化过) ✅ -->
<script src=".../vue.global.prod.js"></script>
```

### 2. 懒加载图表

```javascript
// 仅在需要时初始化图表
const chartVisible = ref(false);

const showChart = () => {
  chartVisible.value = true;
  nextTick(() => {
    initChart();  // 此时才初始化
  });
};
```

### 3. 防抖搜索

```javascript
let searchTimer = null;

const handleSearch = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    fetchData();
  }, 300);  // 300ms 防抖
};
```

---

## 调试技巧

### 1. 启用 Vue Devtools

```javascript
app.config.devtools = true;  // 开发环境启用
```

### 2. 全局错误处理

```javascript
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue 错误:', err);
  console.error('组件:', instance);
  console.error('错误信息:', info);
  
  // 友好提示
  alert(`发生错误: ${err.message}\n请查看控制台了解详情`);
};
```

### 3. 网络请求监控

```javascript
// 包装 fetch 添加日志
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  console.log('📤 请求:', args[0]);
  try {
    const response = await originalFetch(...args);
    console.log('📥 响应:', response.status, args[0]);
    return response;
  } catch (err) {
    console.error('❌ 请求失败:', args[0], err);
    throw err;
  }
};
```

### 4. 使用浏览器断点

```javascript
// 在代码中插入断点
debugger;

// 或使用 console.trace 查看调用栈
console.trace('执行到这里');
```

---

## 应急预案

### 完全无法加载时的降级方案

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>原型 - 降级版本</title>
  <style>
    body { font-family: sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    .card { background: white; padding: 20px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>原型预览 (降级版本)</h1>
  <p style="color: #666;">由于 CDN 加载失败,这是纯 HTML 降级版本</p>
  
  <div class="card">
    <h3>功能列表</h3>
    <ul id="list"></ul>
  </div>
  
  <script>
    // 纯 JS 实现,不依赖任何框架
    const data = [
      { id: 1, name: '功能 1' },
      { id: 2, name: '功能 2' },
    ];
    
    const list = document.getElementById('list');
    data.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item.name;
      list.appendChild(li);
    });
  </script>
</body>
</html>
```

---

## 获取帮助

1. **检查控制台**: F12 → Console 标签,查看红色错误
2. **检查网络**: F12 → Network 标签,查看失败请求
3. **使用诊断工具**: 复制本文档开头的诊断代码
4. **查看示例**: 对比 `references/shadow-examples.md` 和 `references/app-examples.md`
5. **简化问题**: 从最小可运行示例开始,逐步添加功能

---

## 检查清单

原型无法预览时,依次检查:

- [ ] 网络连接正常
- [ ] 浏览器支持 ES6+
- [ ] 使用本地服务器预览 (非 file://)
- [ ] CDN 资源全部加载成功 (Network 面板无红色)
- [ ] Vue 版本号固定 (非 @latest)
- [ ] script 标签顺序正确 (Vue → Element Plus → 业务代码)
- [ ] `#app` 元素在 mount 之前已存在
- [ ] Element Plus 配置了中文语言包
- [ ] 图表容器有明确高度
- [ ] 使用 ref/reactive 正确
- [ ] 移动端有 viewport meta 标签
- [ ] 控制台无严重错误 (红色)
