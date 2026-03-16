# Bug 修复报告 — H5 模式兼容性问题

## 基本信息

| 项目 | 内容 |
|------|------|
| 时间 | 2026-03-12 |
| 环境 | Taro v4.0.9 + Vue3 + Vite, H5 模式 |
| URL | `http://localhost:10086/#/pages/recommend/index/index` |
| 现象 | 页面完全空白，仅底部 TabBar（position: fixed）可见 |

---

## 问题现象

浏览器打开 H5 页面后：
- 主内容区域（Banner、课程分类、商品列表）完全不可见
- 底部自定义 TabBar 正常显示（因使用 `position: fixed` 脱离文档流）
- 背景装饰图片（`::after` 伪元素，`position: fixed`）隐约可见
- JavaScript 无报错，API 请求正常返回数据，组件生命周期正常触发

---

## 根因分析

页面空白由 **两个叠加原因** 共同导致：

### 原因 1：`@tarojs/components/global.css` 导入被注释

**文件**：`src/app.ts` 第 11 行

```typescript
// import "@tarojs/components/global.css" // 被注释掉了
```

**影响**：该文件提供了 Taro H5 运行所需的关键基础样式：

```css
html, body { width: 100%; height: 100%; }
```

缺少这两条样式后，整个高度链断裂：

```
html (height: auto)
  └─ body (height: auto)
       └─ .taro-tabbar__container (height: 100% → 计算为 0)
            └─ .taro-tabbar__panel (flex: 1 → 0)
                 └─ #app.taro_router (height: 100% → 0)
                      └─ .taro_page (height: 100% → 0)  ← 所有内容被裁剪
```

**DOM 结构说明**：Taro Router 在 H5 tabBar 模式下创建的层级为：

```
body
  └─ div.taro-tabbar__container#container   ← 由 handleAppMountWithTabbar() 创建
       ├─ div.taro-tabbar__panel
       │    └─ div#app.taro_router          ← 原始 #app 的克隆
       │         └─ div.taro_page           ← 页面容器
       └─ taro-tabbar                       ← 内置 TabBar（custom:true 时隐藏）
```

各层高度来源：

| 元素 | 样式来源 | 高度值 |
|------|----------|--------|
| `#app` | `@tarojs/components` tabbar 组件 CSS | `height: 100%` |
| `.taro-tabbar__container` | 同上 | `height: 100%; display: flex` |
| `.taro-tabbar__panel` | 同上 | `flex: 1` |
| `.taro_router` | `@tarojs/router` loadRouterStyle() | `height: 100%` |
| `.taro_page` | 同上 | `height: 100%` |

所有 `height: 100%` 都依赖父元素有确定高度，而 `html/body` 没有 `height: 100%` 时，整条链从顶部开始塌陷为 0。

### 原因 2：Taro Router 页面动画 CSS 导致页面不可见

**来源**：`@tarojs/router` 的 `loadAnimateStyle()` 函数动态注入的 `<style>` 标签

```css
/* 阻止 body 滚动 */
body { overflow: hidden; }

/* 页面默认被推到视口右侧 */
.taro_router > .taro_page {
  position: absolute;
  transform: translate(100%, 0);  /* ← 偏移到右侧 100%，不可见 */
  transition: transform 300ms;
}

/* 页面显示时回到原位 */
.taro_router > .taro_page.taro_page_show {
  transform: translate(0, 0);
}
```

**机制**：Taro Router 内部的 `PageHandler.addAnimation()` 方法负责在页面加载时添加 `taro_page_show` 类，使页面从右侧滑入。但在当前环境中，**该类没有被正确添加到 `.taro_page` 元素上**，导致页面始终停留在 `translate(100%, 0)` 的位置。

**`taro_page_show` 未添加的可能原因**：

`PageHandler.load()` → `getPageContainer(page)` 通过 `document.querySelector('.taro_page#${escapedPath}')` 查找页面元素。在 tabBar + custom 模式下，DOM 结构经历了 clone + replaceChild 操作，可能导致元素查找时机不匹配（元素尚未挂载到 DOM，或 ID 转义后的 CSS 选择器无法匹配）。

---

## 修复方案

### 修复 1：恢复 `global.css` 导入

**文件**：`src/app.ts`

```diff
- // import "@tarojs/components/global.css" // DEBUG: 临时注释排查空白页问题
+ import "@tarojs/components/global.css"
```

### 修复 2：覆盖 Taro Router 的动画样式

**文件**：`src/app.less`

```less
// Taro H5: 修复页面动画样式（loadAnimateStyle）导致的渲染问题
// 1. body overflow:hidden 阻止页面滚动
// 2. .taro_page transform/position:absolute 导致页面不可见
body {
  overflow: auto !important;
}

.taro_page {
  transform: none !important;
  position: relative !important;
  height: auto !important;
  min-height: 100%;
}
```

**为什么用 `!important`**：Taro Router 通过 JavaScript 动态注入 `<style>` 标签，这些样式在 CSS 文件加载之后注入，会覆盖静态 CSS。`!important` 确保修复样式优先级最高。

**各属性修复作用**：

| 属性 | 原始值（Router 注入） | 修复值 | 作用 |
|------|----------------------|--------|------|
| `body overflow` | `hidden` | `auto` | 允许页面滚动 |
| `transform` | `translate(100%, 0)` | `none` | 页面回到可视区域 |
| `position` | `absolute` | `relative` | 页面参与正常文档流 |
| `height` | `100%` | `auto` + `min-height: 100%` | 内容超出视口时自动扩展 |

### 修复 3：清除调试代码

**文件**：`src/app.ts`

移除了之前调试时注入的 DOM 诊断代码（`setTimeout` 中检查 `customElements`、`getBoundingClientRect` 等）。

---

## 验证结果

修复后通过浏览器截图验证：

- ✅ Banner 轮播正常显示（"把世界变成孩子的成长课堂"、"以热爱！见未来"）
- ✅ 课程分类区域正常显示
- ✅ 商品列表正常显示（"北京单日营"分类及商品卡片）
- ✅ 底部 TabBar 正常显示（首页、发现、预约、我的）
- ✅ API 数据正常加载
- ✅ 这些修复仅影响 H5 模式（`.taro_page`、`.taro_router` 选择器在小程序端不存在），不影响微信小程序

---

## 修改文件清单

| 文件 | 变更内容 |
|------|----------|
| `src/app.ts` | 恢复 `global.css` 导入；移除调试诊断代码 |
| `src/app.less` | 添加 `body` 和 `.taro_page` 的 H5 渲染修复样式 |

---

---

# Bug 2 — 商品详情页点击报错无法跳转

## 基本信息

| 项目 | 内容 |
|------|------|
| 时间 | 2026-03-12 |
| 环境 | Taro v4.0.9 + Vue3 + Vite, H5 模式 |
| URL | `http://localhost:10086/#/pages/product/detail/index?id=...` |
| 现象 | 首页点击商品卡片后报错，商品详情页无法正常渲染 |

---

## 问题现象

在首页点击商品卡片后：
- URL 成功切换到商品详情页
- 页面停留在 loading 状态，无法完成渲染
- 控制台报错：`Uncaught (in promise) ReferenceError: wx is not defined`

---

## 根因分析

H5 环境下不存在微信小程序的 `wx` 全局对象，但有 3 处代码直接引用了 `wx`，导致模块加载或页面初始化时崩溃。

### 崩溃点 1：`WXML2Canvas/constants.js:13` — 模块顶层立即执行

```javascript
export const {
  platform: SYS_PLATFORM,
  pixelRatio: SYS_DPR,
  windowWidth: SYS_WIDTH
} = wx.getSystemInfoSync()  // ← H5 环境下 wx 不存在，模块加载即崩溃
```

**引用链**：商品详情页 → `ShareSheet.vue` → `PosterGenerator` → `WXML2Canvas` → `constants.js`

**严重性**：**致命** — 模块加载阶段即抛出异常，阻止整个组件树渲染。

### 崩溃点 2：`ShareSheet.vue:176` — useLoad 回调中直接调用

```javascript
useLoad(() => {
  wx.showShareMenu({  // ← H5 环境下 wx 不存在
    withShareTicket: true,
    menus: ["shareAppMessage", "shareTimeline"]
  })
})
```

**严重性**：**致命** — 页面加载时执行，无 try-catch 保护。

### 崩溃点 3：`ShareSheet.vue:120` — 异步函数中调用

```javascript
wx.showShareImageMenu({ path: posterPath, ... })
```

**严重性**：中等 — 在 try-catch 内但仍会产生运行时错误。

---

## 修复方案

### 修复 4：WXML2Canvas 系统信息获取兼容 H5

**文件**：`src/components/WXML2Canvas/constants.js`

```diff
- export const {
-   platform: SYS_PLATFORM,
-   pixelRatio: SYS_DPR,
-   windowWidth: SYS_WIDTH
- } = wx.getSystemInfoSync()
+ const _sysInfo =
+   typeof wx !== "undefined" && wx.getSystemInfoSync
+     ? wx.getSystemInfoSync()
+     : {
+         platform: "h5",
+         pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2,
+         windowWidth: typeof window !== "undefined" ? window.innerWidth : 375
+       }
+ export const SYS_PLATFORM = _sysInfo.platform
+ export const SYS_DPR = _sysInfo.pixelRatio
+ export const SYS_WIDTH = _sysInfo.windowWidth
```

H5 环境下使用 `window.devicePixelRatio` 和 `window.innerWidth` 作为降级值。

### 修复 5：ShareSheet 微信 API 调用守卫

**文件**：`src/pages/product/detail/components/ShareSheet.vue`

两处 `wx` 直接调用均添加 `typeof wx !== "undefined"` 守卫：

```diff
  useLoad(() => {
-   wx.showShareMenu({ ... })
+   if (typeof wx !== "undefined" && wx.showShareMenu) {
+     wx.showShareMenu({ ... })
+   }
  })
```

```diff
-   wx.showShareImageMenu({ path: posterPath, ... })
+   if (typeof wx !== "undefined" && wx.showShareImageMenu) {
+     wx.showShareImageMenu({ path: posterPath, ... })
+   } else {
+     Taro.showToast({ title: "H5 暂不支持此分享方式", icon: "none" })
+   }
```

---

## 验证结果

修复后通过浏览器截图验证：

- ✅ 点击商品卡片成功导航到商品详情页
- ✅ 商品图片轮播正常显示
- ✅ 价格信息正常：券后价 ¥0，优惠前 ¥10
- ✅ 优惠券标签正常：满2减30、无门槛减2
- ✅ 底部操作栏正常：分享、客服、立即预订按钮
- ✅ 返回按钮正常
- ✅ 控制台无 `wx is not defined` 报错

---

# Bug 3 — 发现页 VLOG 点击弹出遮罩但视频无法播放

## 基本信息

| 项目 | 内容 |
|------|------|
| 时间 | 2026-03-12 |
| 环境 | Taro v4.0.9 + Vue3 + Vite, H5 模式 |
| URL | `http://localhost:10086/#/pages/discover/index/index` |
| 现象 | 点击精彩 VLOG / 精彩瞬间卡片后，弹出全屏黑色遮罩层但视频不播放，用户被困在空遮罩中 |

---

## 问题现象

在发现页点击 VLOG 视频卡片后：
- 弹出全屏黑色遮罩层（`VideoPlayerModal`）
- 遮罩层内无视频内容，完全空白
- 控制台报错：`[Vue warn]: Failed to resolve component: channel-video`
- 点击遮罩外部可关闭，但用户体验差（无任何提示说明视频不可用）

---

## 根因分析

`<channel-video>` 是**微信小程序视频号专属组件**，用于嵌入微信视频号内容。该组件仅在微信小程序运行时中可用，H5 环境完全不支持。

**组件调用链**：

```
HorizontalList.vue (handleItemClick)
  └─ showVideoModal = true
       └─ VideoPlayerModal.vue
            └─ <channel-video :feed-id="..." :finder-user-name="..." />  ← H5 不存在
```

**数据格式**：VLOG 项目的 URL 格式为 `feedId=xxx&finderUserName=xxx`，这些是微信视频号标识符，不是标准视频 URL，无法用 HTML5 `<video>` 播放。

**附加问题**：即使 `<video-player-modal>` 的 `show` 为 `false`，Vue 仍会在模板编译阶段尝试解析 `channel-video` 组件名，产生大量 Vue 警告。

---

## 修复方案

### 修复 6：H5 模式下 VLOG 点击拦截

**文件**：`src/pages/discover/components/HorizontalList.vue`

H5 模式下，点击视频卡片不再弹出视频模态框，改为 Toast 提示：

```diff
+ const isH5 = process.env.TARO_ENV === "h5"

  const handleItemClick = (item: ListItem) => {
    if (!props.showPlayButton) {
      showVideoModal.value = false
      emit("itemClick", item)
    } else {
+     if (isH5) {
+       Taro.showToast({
+         title: "视频号内容请在微信小程序中查看",
+         icon: "none",
+         duration: 2000
+       })
+       return
+     }
      showVideoModal.value = true
      // ...
    }
  }
```

同时在模板中，H5 下不渲染 `VideoPlayerModal`，彻底消除 `channel-video` 的 Vue 警告：

```diff
  <video-player-modal
-   :show="showVideoModal"
+   v-if="!isH5"
+   :show="showVideoModal"
    ...
  />
```

### 修复 7：VideoPlayerModal H5 降级显示

**文件**：`src/pages/discover/components/VideoPlayerModal.vue`

作为防御性修复，即使模态框在 H5 下被渲染，也不会尝试加载 `<channel-video>`，而是显示友好提示：

```diff
+ const isH5 = process.env.TARO_ENV === "h5"

  <template v-if="isH5">
    <view class="video-h5-hint">
      <text class="hint-text">视频号内容暂不支持在浏览器中播放</text>
      <text class="hint-sub">请在微信小程序中查看</text>
      <view class="hint-close" @tap="handleClose">
        <text class="hint-close-text">关闭</text>
      </view>
    </view>
  </template>
  <template v-else>
    <!-- 原有 channel-video 逻辑 -->
  </template>
```

---

## 验证结果

修复后全页刷新验证：

- ✅ 发现页正常加载，Banner / 精选攻略 / 精彩 VLOG / 精彩瞬间各区块正常
- ✅ 控制台无 `Failed to resolve component: channel-video` 警告
- ✅ H5 模式下点击 VLOG 卡片显示 Toast 提示"视频号内容请在微信小程序中查看"
- ✅ 不再弹出空白遮罩层
- ✅ 修复仅影响 H5 模式（`process.env.TARO_ENV` 编译时求值），小程序端 `channel-video` 正常工作

---

# Bug 4 — 发现页精选攻略点击后 webview 空白

## 基本信息

| 项目 | 内容 |
|------|------|
| 时间 | 2026-03-12 |
| 环境 | Taro v4.0.9 + Vue3 + Vite, H5 模式 |
| URL | `http://localhost:10086/#/pages/webview/index?url=...` |
| 现象 | 点击精选攻略列表项后跳转到 webview 页面，页面完全空白 |

---

## 根因分析

Taro 在 H5 模式下将 `<web-view>` 渲染为 `<iframe>`。但目标 URL（如 `mp.weixin.qq.com`）设置了严格的 CSP（Content Security Policy）`frame-ancestors` 指令，禁止被非白名单域名嵌入。

```
Framing 'https://mp.weixin.qq.com/' violates the following Content Security Policy
directive: "frame-ancestors 'self' http://wx.qq.com ..."
```

`localhost:10086` 不在白名单中，iframe 被阻止加载。

---

## 修复方案

### 修复 8：webview 页面 H5 降级为新窗口打开

**文件**：`src/pages/webview/index.vue`

H5 模式下不使用 `<web-view>`（iframe），改为 `window.open()` 新窗口打开外部链接，然后自动返回上一页：

```diff
+ const isH5 = process.env.TARO_ENV === "h5"

  <template>
-   <web-view :src="url"></web-view>
+   <web-view v-if="!isH5" :src="url"></web-view>
+   <view v-else class="h5-fallback">
+     <text>正在打开外部链接…</text>
+   </view>
  </template>

  onMounted(() => {
    // ...
+   if (isH5 && typeof window !== "undefined") {
+     window.open(decodedUrl, "_blank")
+     Taro.navigateBack()
+   }
  })
```

---

## 修改文件清单（完整）

| 文件 | 变更内容 | 关联 Bug |
|------|----------|----------|
| `src/app.ts` | 恢复 `global.css` 导入；移除调试诊断代码 | Bug 1 |
| `src/app.less` | 添加 `body` 和 `.taro_page` 的 H5 渲染修复样式 | Bug 1 |
| `src/components/WXML2Canvas/constants.js` | `wx.getSystemInfoSync()` 添加 H5 降级 | Bug 2 |
| `src/pages/product/detail/components/ShareSheet.vue` | `wx.showShareMenu` / `wx.showShareImageMenu` 添加环境守卫 | Bug 2 |
| `src/pages/discover/components/HorizontalList.vue` | H5 下 VLOG 点击拦截 + 不渲染 VideoPlayerModal | Bug 3 |
| `src/pages/discover/components/VideoPlayerModal.vue` | H5 下显示友好提示替代 `channel-video` | Bug 3 |
| `src/pages/webview/index.vue` | H5 下 `window.open()` 替代 iframe 嵌入 | Bug 4 |
| `sandbox/nginx.conf` | 根路径兜底代理到 Vite；`/api/*.ts` 等源文件分流 | Bug 5 |
| `ainative-backend/configs/local.yaml` | 新建，`env: local` 沙箱配置 | Bug 6 |
| `ainative-backend/cmd/yanxue/main.go` | `GO_ENV_local` 时跳过 Nacos Registrar | Bug 6 |
| `sandbox/supervisord.conf` | Backend 添加 `GO_ENV=local` | Bug 6 |
| `ainative-backend/internal/biz/wechat_v1_user_authchecktoken.go` | local 环境 dev token 放行 | Bug 7 |
| `ainative-app/src/app.ts` | H5+local 启动时注入 dev token | Bug 7 |

---

## 经验总结

1. **`@tarojs/components/global.css` 是 Taro H5 模式的必要依赖**，提供 `html/body { height: 100% }` 等基础样式，不可省略
2. **Taro Router 的页面切换动画** (`loadAnimateStyle`) 在 custom tabBar + H5 模式下可能出现 `taro_page_show` 类不被添加的问题，需要 CSS 覆盖来确保页面可见
3. **`height: 100%` 的级联依赖**：百分比高度需要从 `html` 到目标元素的每一层都有明确高度定义，任何一层断裂都会导致子元素高度塌陷为 0
4. **调试 H5 空白页**的排查路径：先检查高度链（height chain），再检查 transform/position/overflow 等可能隐藏内容的属性
5. **H5 模式下严禁直接使用 `wx` 全局对象**：所有微信小程序专属 API 必须用 `typeof wx !== "undefined"` 守卫，或使用 Taro 封装的跨平台 API。特别注意模块顶层的立即执行代码（如解构赋值），会在 import 阶段即崩溃，阻塞整个组件树
6. **微信小程序专属组件（如 `channel-video`、`web-view`）在 H5 下不可用**：需要用 `process.env.TARO_ENV === "h5"` 编译时常量做条件渲染，避免在 H5 模板中引入这些组件，否则 Vue 会产生 `Failed to resolve component` 警告
7. **`<web-view>` 在 H5 下渲染为 iframe**，受目标站点 CSP `frame-ancestors` 策略限制。需改用 `window.open()` 新窗口打开
8. **检查 `wx` 引用的排查命令**：`grep -rn '\bwx\.' src/ --include='*.vue' --include='*.ts' --include='*.js'` 可快速定位所有潜在的 H5 不兼容点

---

# Bug 5 — H5 沙箱部署空白页（Nginx 代理配置问题）

## 基本信息

| 项目 | 内容 |
|------|------|
| 时间 | 2026-03-12 |
| 环境 | 沙箱 Docker 容器，Nginx :8080 统一入口，Taro H5 app :8200 |
| URL | `http://localhost:8080/app/` |
| 现象 | 访问沙箱 H5 页面完全空白，控制台报 MIME 类型错误、502 错误 |

---

## 问题现象

通过 `make sandbox` 启动沙箱后，访问 `http://localhost:8080/app/`：
- 页面完全空白
- 控制台报错：
  - `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"`
  - `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/css"`
  - `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "video/mp2t"`
- 网络请求中 `/api/tripConfig.ts` 返回 502

---

## 根因分析

### 原因 1：Vite 根路径资源被错误路由

Taro/Vite dev 模式下，HTML 中的 `<script>` 使用**根路径**，而非 `publicPath` 前缀：

```html
<script type="module" src="/@vite/client"></script>
<script type="module" src="/app.config.ts"></script>
```

这些请求（`/@vite/client`、`/app.config.ts`、`/src/...`、`/node_modules/...`）命中了 Nginx 的默认 `location /`，当时返回的是内联 HTML 导航页，导致：
- 期望 JS，实际返回 `text/html`
- `.ts` 文件被 Nginx 默认 MIME 映射为 `video/mp2t`

### 原因 2：`/api/` 路径命名空间冲突

Vite 源文件 `src/api/tripConfig.ts` 被解析为 `/api/tripConfig.ts`。该路径匹配 Nginx 的 `location /api/` 规则，被错误代理到后端 Go 服务器（:8000），后端无此路由，返回 502。

---

## 修复方案

### 修复 9：Nginx 默认 location 兜底到 Vite

**文件**：`sandbox/nginx.conf`

- 将服务导航页改为 `location = /`（精确匹配，仅根路径）
- 新增 `location /`（前缀匹配）作为兜底，代理到 app Vite 服务器 :8200

这样 `/@vite/client`、`/app.config.ts`、`/src/`、`/node_modules/` 等根路径请求都会正确代理到 Vite，返回正确的 MIME 类型。

### 修复 10：`/api/` 下源文件分流到 Vite

**文件**：`sandbox/nginx.conf`

在 `location /api/` 之前添加正则 location，将 `/api/*.ts`、`*.js`、`*.vue` 等 Vite 源文件请求代理到 Vite，而非后端：

```nginx
# Vite 源文件 — /api/ 下的 .ts/.js/.vue 等是 Vite 模块，不是后端 API 请求
location ~ ^/api/.*\.(ts|js|mjs|vue|less|css|scss|map)$ {
    proxy_pass http://127.0.0.1:8200;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

正则 location 优先级高于普通前缀 location，确保源文件不被代理到后端。

---

## 验证结果

修复后验证：

- ✅ `http://localhost:8080/` 显示服务导航页
- ✅ `http://localhost:8080/app/` 正常加载 H5 应用
- ✅ `/@vite/client` 返回 `application/javascript`
- ✅ `/app.config.ts` 返回 `application/javascript`
- ✅ `/api/tripConfig.ts` 返回 200 + `application/javascript`（不再 502）
- ✅ 首页 Banner、分类、商品列表、TabBar 正常渲染

---

## 修改文件清单（Bug 5）

| 文件 | 变更内容 |
|------|----------|
| `sandbox/nginx.conf` | 1) `location = /` 精确匹配导航页；2) `location /` 兜底代理到 app:8200；3) 新增正则 `location ~ ^/api/.*\.(ts|js|...)$` 将 Vite 源文件代理到 app |

---

## 经验总结（Bug 5）

1. **Taro/Vite dev 模式下 `publicPath` 不会映射到 Vite 的 `base`**，HTML 中 script 始终使用根路径，Nginx 必须将根路径请求代理到 Vite 服务器
2. **`/api/` 路径冲突**：Vite 源文件 `src/api/*.ts` 解析为 `/api/*.ts`，与后端 API 前缀冲突，需用正则 location 按文件扩展名分流
3. **Nginx location 优先级**：`location = /` 精确匹配 > 正则 `location ~` > 普通前缀 `location /`

---

# Bug 6 — 沙箱 H5 首页接口 502（Backend Nacos 注册失败）

## 基本信息

| 项目 | 内容 |
|------|------|
| 时间 | 2026-03-13 |
| 环境 | 沙箱 Docker 容器，Backend Go/Kratos :8000 |
| URL | `http://localhost:8080/app/` 首页 |
| 现象 | 首页商品推荐分类接口 `/api/yanxue/wechat/v1/good_recommendation_category/list` 返回 502，获取数据失败 |

---

## 问题现象

沙箱 H5 首页加载后：
- 控制台报错：`Failed to load resource: the server responded with a status of 502 (Bad Gateway)`
- `HTTP错误响应: null`、`获取商品推荐分类失败: null`
- 首页商品分类区域无数据

---

## 根因分析

### 原因 1：Backend 启动时 Nacos 注册失败导致 panic

Backend 默认加载 `development.yaml` 等配置，启动时会向 Nacos 注册中心（`nacos.ops.svc.cluster.local:8848`）注册。该地址为 Kubernetes 集群内服务发现地址，在沙箱 Docker 环境中不可达，导致连接失败并 panic，Backend 进程退出。

### 原因 2：Backend 未就绪时 Nginx 代理返回 502

Backend 进程因 Nacos panic 无法常驻，Nginx 将 `/api/` 请求代理到 :8000 时，上游无响应，返回 502 Bad Gateway。

---

## 修复方案

### 修复 11：Backend 沙箱环境使用 local 配置跳过 Nacos

**文件**：`ainative-backend/configs/local.yaml`（新建）

基于 `development.yaml` 创建 `local.yaml`，设置 `env: local`，供沙箱环境使用。

**文件**：`ainative-backend/cmd/yanxue/main.go`

当 `c.GetEnv() == conf.GO_ENV_local` 时不添加 Registrar，跳过 Nacos 注册：

```go
if c.GetEnv() != conf.GO_ENV_local {
    // 添加 Nacos 服务发现...
}
```

### 修复 12：Supervisord 中 Backend 设置 GO_ENV=local

**文件**：`sandbox/supervisord.conf`

在 `[program:backend]` 中设置环境变量，使 Backend 加载 `local.yaml`：

```ini
[program:backend]
command=air -c .air.toml
directory=/workspace/ainative-backend
environment=GO_ENV="local"
autostart=true
...
```

---

## 验证结果

修复后验证：

- ✅ Backend 正常启动，日志显示 `config loaded: local.yaml`
- ✅ 无 Nacos 连接失败或 panic
- ✅ `POST /api/yanxue/wechat/v1/good_recommendation_category/list` 返回 200，数据正常
- ✅ 沙箱 H5 首页商品推荐分类正常加载

---

## 修改文件清单（Bug 6）

| 文件 | 变更内容 |
|------|----------|
| `ainative-backend/configs/local.yaml` | 新建，`env: local` 配置 |
| `ainative-backend/cmd/yanxue/main.go` | `GO_ENV_local` 时跳过 Nacos Registrar |
| `sandbox/supervisord.conf` | `[program:backend]` 添加 `environment=GO_ENV="local"` |

---

## 经验总结（Bug 6）

1. **沙箱环境与 K8s 环境隔离**：Nacos、服务发现等 K8s 内网地址在沙箱中不可用，需通过 `GO_ENV=local` 等环境变量切换配置，跳过服务注册
2. **接口方法**：`good_recommendation_category/list` 为 **POST** 接口，GET 请求会返回 404

---

# Bug 7 — H5 沙箱无法登录，需固定 dev token 放行

## 基本信息

| 项目 | 内容 |
|------|------|
| 时间 | 2026-03-13 |
| 环境 | 沙箱 H5 模式，`http://localhost:8080/app/` |
| 现象 | H5 无法使用微信登录（无 wx.login），需登录才能访问的页面被拦截 |

---

## 问题现象

H5 模式下：
- 登录依赖 `Taro.login()` 获取微信 code，H5 环境无微信运行时，无法完成登录
- 路由守卫和请求拦截器会拦截未登录用户访问需登录页面（如个人中心、订单、预约等）
- 用户无法完整浏览所有页面进行联调

---

## 修复方案

### 修复 13：Backend local 环境 dev token 放行

**文件**：`ainative-backend/internal/biz/wechat_v1_user_authchecktoken.go`

当 `GO_ENV=local` 且 token 为 `h5-dev-local-token` 时，直接放行并返回固定 dev 用户 ID，跳过 JWT 校验：

```go
const (
	DevTokenLocal = "h5-dev-local-token"
	DevUserID     = "00000000-0000-0000-0000-000000000001"
)

// local 环境：dev token 直接放行
if w.cfg.GetEnv() == conf.GO_ENV_local && req.Token == DevTokenLocal {
	resp.UserId = DevUserID
	return resp, nil
}
```

### 修复 14：Frontend H5+local 启动时注入 dev token

**文件**：`ainative-app/src/app.ts`

当 `IS_LOCAL` 且 `TARO_ENV === "h5"` 且当前无 token 时，自动注入 dev token：

```typescript
if (IS_LOCAL && process.env.TARO_ENV === "h5" && !userStore.token) {
  userStore.setToken("h5-dev-local-token")
  console.log("[H5 本地联调] 已注入 dev token，可访问需登录页面")
}
```

---

## 验证结果

- ✅ 沙箱 H5 启动后自动注入 dev token
- ✅ 可访问个人中心、订单、预约等需登录页面
- ✅ 仅 local 环境生效，test/stage/production 不受影响
- ⚠️ 个人中心等依赖真实用户数据的接口可能返回空（dev 用户 ID 在 DB 中可能不存在）

---

## 修改文件清单（Bug 7）

| 文件 | 变更内容 |
|------|----------|
| `ainative-backend/internal/biz/wechat_v1_user_authchecktoken.go` | local 环境 dev token 放行 |
| `ainative-app/src/app.ts` | H5+local 启动时注入 dev token |
