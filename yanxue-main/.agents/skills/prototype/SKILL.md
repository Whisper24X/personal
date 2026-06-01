---
name: prototype
description: Creates single-file HTML prototypes in docs/prototype/ using Vue3 + Element Plus via specified CDN. New features use project design tokens; iterations reference ainative-shadow/ainative-app/frontend code. Use when user says prototype, demo, mockup, quick validation, visualize idea, UI preview, 原型, 演示, or needs visual mockup. Also use when given a version-review summary (版本评审) to visualize proposed UI changes.
---

# 单文件原型生成器

生成独立的 HTML 原型文件，双击即可演示，样式参考项目设计系统。

## CDN 强制约束（生成前必读）

> ⚠️ 违反此约束会导致 CDN 加载失败，验证不通过。

- **唯一允许域名**：`https://fp.yangcong345.com/middle/base/`
- **禁止**：unpkg.com、cdn.jsdelivr.net、cdnjs.cloudflare.com、element-plus.org 及其他任何域名
- **操作方式**：从 [templates.md](references/templates.md) 第 168–178 行**直接复制** CDN 标签，不得自行编写或改写 URL

---

## 决策流程

```
用户请求 → [1] 判断输入来源 → [2] 判断原型类型 → [3] 判断端类型 → [4] 生成
```

### [1] 判断输入来源

| 输入类型         | 说明                                           | 处理方式                                                                                       |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **自由描述**     | 用户直接描述需求                               | 进入 [2]                                                                                       |
| **版本评审文档** | 含「版本想法」「行动项」「评审结论」的 md 文件 | 从文档提取变更字段与页面，进入迭代流程，见 [iteration-guide.md](references/iteration-guide.md) |

### [2] 判断原型类型

| 类型     | 判断依据                                   | 处理方式                           |
| -------- | ------------------------------------------ | ---------------------------------- |
| **新增** | 项目中无对应 views/pages                   | 直接生成，应用设计规范             |
| **迭代** | 描述为对已有页面的改进，或来自版本评审文档 | 先读取相关前端代码，再生成一致原型 |

### [3] 判断端类型

| 端类型       | 适用场景                            | 布局约束                           |
| ------------ | ----------------------------------- | ---------------------------------- |
| **管理后台** | 数据列表、表单、仪表盘（PC 端）     | Element Plus，max-width: 1200px    |
| **移动端**   | 商品列表、表单、详情页（小程序/H5） | 原生 HTML + Vue3，max-width: 750px |

---

## 生成步骤

### Step 1：确认根目录结构

检查根目录下存在哪些子目录，确定参考代码路径 `{root}`：

| 存在目录           | `{root}`          |
| ------------------ | ----------------- |
| `ainative-shadow/` | `ainative-shadow` |
| `ainative-app/`    | `ainative-app`    |
| `frontend/`        | `frontend`        |

### Step 2：提取设计 Token

- **管理后台**：读 `{root}/src/style.css`、`{root}/src/App.vue` style 块
- **移动端**：读 `{root}/src/` 下对应样式文件
- **回退**：无法读取时，使用 [templates.md](references/templates.md) 中默认 Design Tokens

### Step 3（仅迭代）：读取相关前端代码

详见 [iteration-guide.md](references/iteration-guide.md)。必读路径：

```
{root}/src/views/{domain}/*.vue      # 或 src/pages/{domain}/*.vue
{root}/src/views/{domain}/components/*.vue
{root}/src/components/common/*.vue
{root}/src/style.css
```

### Step 4：生成原型文件

**输出路径**：`docs/prototype/{feature-name}/index.html`

从 [templates.md](references/templates.md) 复制对应模板（管理后台 / 移动端），填充业务内容。结构要求：

- `<head>`：CDN link + 设计 CSS
- `<body>`：`#app` 内含 `prototype-badge` + 页面内容
- 末尾：Vue3 挂载脚本（管理后台需 `.use(ElementPlus)`）
- 文件顶部：功能说明注释块（见下方规范）

### Step 5：运行验证（强制，不得跳过）

```bash
node skills/prototype/scripts/verify.js docs/prototype/{feature}/index.html
```

- **有错误**：按 [verification-guide.md](references/verification-guide.md) 修复后重新运行
- **通过条件**：输出 `✅ 原型验证通过`

---

## 原型标记规范

### 顶部注释

```html
<!--
  原型名称: 课程预约管理（实收金额迭代）
  创建时间: 2026-03-15
  迭代来源: mm_lq1 版本评审（或「新增」）

  变更说明:
  - 删除「商家实收」字段
  - 新增「实收金额」字段（来源：父订单下最新子订单，按创建时间倒序）
  - 无子订单或金额为空时显示「—」

  原型限制:
  - 使用模拟数据
  - 未实现真实 API

  下一步:
  - 对接后端 API
  - 完善导出功能
-->
```

### 视觉徽章

```html
<div class="prototype-badge">🚧 原型</div>
```

---

## 编码规范（减少验证错误）

- `ref` 用空值初始化：`ref('')` / `ref([])` / `ref({})`
- 访问嵌套属性用可选链：`row.user?.name`
- **禁止 `v-else`**：改用 `v-if="!condition"`（Vue3 in-DOM 模板限制）
- **禁止 `v-else-if`**：改用独立 `v-if="condition2"`

---

## 附加资源

| 资源                                                      | 说明                                                  |
| --------------------------------------------------------- | ----------------------------------------------------- |
| [templates.md](references/templates.md)                   | 管理后台/移动端完整模板、CDN 资源、默认 Design Tokens |
| [iteration-guide.md](references/iteration-guide.md)       | 迭代场景指南：版本评审 → 原型、功能域推断             |
| [verification-guide.md](references/verification-guide.md) | 运行时验证与错误驱动修复                              |
| [common-prototypes.md](references/common-prototypes.md)   | 常用功能片段、常见组件、快速参考                      |
| [shadow-examples.md](references/shadow-examples.md)       | 管理后台完整示例（用户列表、数据仪表盘）              |
| [app-examples.md](references/app-examples.md)             | 移动端完整示例（商品列表、表单提交）                  |
