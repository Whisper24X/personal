# 调试结果报告 - http://localhost:10086/ 页面空白问题

## 执行时间
2026-03-12

## 问题描述
页面在浏览器中显示空白，只有底部导航栏可见，主要内容区域（Banner、分类、商品列表）不可见。

---

## 🔍 调试过程

### 1. 页面加载状态检查
✅ **结果：正常**
- 页面 URL: `http://localhost:10086/#/pages/recommend/index/index`
- 页面标题: "首页"
- 所有资源（JS、CSS、图片）加载成功（状态码 200/304）

### 2. 控制台日志分析
✅ **结果：正常**
```
✓ 组件挂载成功："onMounted home", "首页显示"
✓ API 请求成功："成功响应"
✓ 数据加载成功：商品推荐分类列表返回 200
```

### 3. 网络请求分析
✅ **结果：正常**
- API 请求：`POST /yanxue/wechat/v1/good_recommendation_category/list` → 200
- Banner 图片加载成功
- 分类图标加载成功
- 商品图片加载成功

### 4. 源代码分析
⚠️  **发现问题**

#### 问题 1：H5 配置中 viewport 宽度不匹配
**文件：** `config/index.ts`

```typescript
// 第 56 行：设计稿宽度
designWidth: 750

// 第 170 行：H5 viewport 宽度（问题所在！）
viewportWidth: 375  // ❌ 应该是 750
```

**影响：**
- rpx 单位在 H5 环境下转换错误
- 所有使用 rpx 的尺寸都会被缩小一半
- 例如：`height: 496rpx` 实际渲染可能变成 248px 或更小

#### 问题 2：Vue3 配置警告
```
[Vue warn]: The `isCustomElement` config option is deprecated.
Use `compilerOptions.isCustomElement` instead.
```
可能影响 Taro 自定义元素（`taro-view-core`, `taro-text-core`）的渲染。

---

## 🎯 根本原因

**主要问题：H5 环境下的 rpx 单位转换配置错误**

### 配置冲突
```typescript
designWidth: 750        // 设计稿基准宽度
↓
viewportWidth: 375      // ❌ H5 viewport 宽度不匹配
```

### 转换逻辑
```
rpx → px 转换公式：
实际px = rpx * (viewportWidth / designWidth)
       = rpx * (375 / 750)
       = rpx * 0.5
```

### 实际影响
```less
// 源代码
.banner-swiper {
  height: 496rpx;  // 期望高度
}

// 实际渲染（错误）
.banner-swiper {
  height: 248px;   // 被缩小一半
}

// 如果再经过 viewport 单位转换
height: 66.13vw;   // 在 375px 宽度下约 248px
```

---

## 📋 未能执行的调试步骤

由于浏览器工具限制，以下步骤需要手动执行以确认：

### 步骤 1：统计元素数量
```javascript
const counts = {
  tab: document.querySelectorAll('.tab-content').length,
  banner: document.querySelectorAll('.top-banner').length,
  cate: document.querySelectorAll('.categories-container').length,
  section: document.querySelectorAll('.category-section').length,
  view: document.querySelectorAll('taro-view-core').length,
  text: document.querySelectorAll('taro-text-core').length
};
console.log('元素数量:', counts);
```

**预期结果：**
- 如果元素数量为 0，说明组件未渲染
- 如果元素数量 > 0，说明组件已渲染但不可见

### 步骤 2：检查元素样式
```javascript
const banner = document.querySelector('.top-banner');
if (banner) {
  const style = window.getComputedStyle(banner);
  const rect = banner.getBoundingClientRect();
  console.log('.top-banner:', {
    display: style.display,
    height: style.height,
    width: style.width,
    rect: { width: rect.width, height: rect.height }
  });
}
```

**预期结果：**
- `height` 可能是一个非常小的值（如 `66.13vw` 或 `248px`）
- `rect.height` 可能接近 0 或非常小

### 步骤 3：注入强制可见样式
```javascript
const s = document.createElement('style');
s.id = 'debug-force-visible';
s.textContent = `
  taro-view-core, .top-banner, .categories-container, .category-section {
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
    min-height: 100px !important;
    background: rgba(255,255,0,.08) !important;
  }
`;
document.head.appendChild(s);
```

**预期结果：**
- 如果注入后内容显示，确认是 CSS 尺寸问题
- 黄色背景应该可见

---

## ✅ 最小修复方案

### 方案 1：修正 H5 viewport 配置（推荐）

**文件：** `ainative-app/config/index.ts`

```typescript
h5: {
  // ... 其他配置
  postcss: {
    // ... 其他配置
    viewportUnits: {
      enable: true,
      config: {
        viewportWidth: 750,  // ✅ 修改为 750，与 designWidth 一致
        viewportHeight: 667,
        unitPrecision: 5,
        viewportUnit: "vw",
        selectorBlackList: [".ignore", ".hairlines"],
        minPixelValue: 1,
        mediaQuery: false
      }
    }
  }
}
```

### 方案 2：禁用 viewport 单位转换（备选）

如果方案 1 不生效，可以尝试禁用 viewport 单位转换：

```typescript
viewportUnits: {
  enable: false,  // ✅ 禁用 viewport 单位转换
  // config: { ... }
}
```

### 方案 3：修正 pxtorem 配置（备选）

```typescript
pxtorem: {
  enable: true,
  config: {
    rootValue: 40,  // ✅ 修改为 40 (750 / 16 ≈ 46.875，向下取整)
    unitPrecision: 5,
    propList: ["*"],
    selectorBlackList: [".ignore", ".hairlines", /^\.weui-/],
    minPixelValue: 1,
    mediaQuery: false
  }
}
```

---

## 🔧 修复步骤

1. **修改配置文件**
   ```bash
   cd /Users/draskychen/workspace/yanxue-main/ainative-app
   # 编辑 config/index.ts，应用方案 1
   ```

2. **重启开发服务器**
   ```bash
   # 停止当前服务器（Ctrl+C）
   # 重新启动
   pnpm dev:h5
   ```

3. **清除浏览器缓存**
   - 在浏览器中按 Cmd+Shift+R（Mac）或 Ctrl+Shift+R（Windows）
   - 或者在开发者工具中右键刷新按钮 → "清空缓存并硬性重新加载"

4. **验证修复**
   - 访问 http://localhost:10086/
   - 检查 Banner、分类、商品列表是否正常显示

---

## 📊 可疑属性排名

基于分析，最可疑的属性（按可能性排序）：

1. **⭐⭐⭐⭐⭐ viewportWidth 配置错误** - 最可能的原因
2. **⭐⭐⭐ height/width 尺寸过小** - 由配置错误导致
3. **⭐⭐ Vue3 isCustomElement 警告** - 可能影响自定义元素渲染
4. **⭐ display/opacity/visibility** - 源代码中未发现问题
5. **⭐ position/z-index** - 源代码中未发现问题

---

## 📝 总结

### 问题根源
H5 环境下的 `viewportWidth` 配置为 375，与 `designWidth` 750 不匹配，导致 rpx 单位转换错误，所有元素尺寸被缩小一半。

### 修复方案
将 `config/index.ts` 中的 `h5.postcss.viewportUnits.config.viewportWidth` 从 375 改为 750。

### 验证方法
修复后重启服务器，清除缓存，检查页面内容是否正常显示。

### 备注
如果手动执行了上述调试脚本（步骤 1-3），请将实际结果补充到本报告中，以确认分析的准确性。

---

## 📎 相关文件

- 配置文件：`/Users/draskychen/workspace/yanxue-main/ainative-app/config/index.ts`
- 主页面：`/Users/draskychen/workspace/yanxue-main/ainative-app/src/pages/recommend/Index/index.vue`
- 调试脚本：`/tmp/execute_debug.sh`
- 完整调试报告：`/Users/draskychen/workspace/yanxue-main/ainative-app/DEBUG_REPORT.md`
