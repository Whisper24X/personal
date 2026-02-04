# Prototype Skill - 单文件原型生成技能

## 概述

为 AINative Workspace 项目定制的单文件 HTML 原型生成技能。快速创建可视化原型，无需构建，双击即可演示。

## 核心特性

### ✅ 单文件输出
- **位置**: `/docs/prototype/{feature-name}/index.html`
- **格式**: 独立的 HTML 文件
- **依赖**: 通过 CDN 引入（Vue3、Element Plus）
- **运行**: 双击打开或本地服务器

### ✅ 样式一致
- 使用项目设计标准（颜色、字体、间距）
- 参考 ainative-shadow 和 ainative-app 的设计系统
- 自动应用设计 tokens

### ✅ 立即可用
- 无需 npm install
- 无需构建过程
- 打开即可演示

## 文件结构

```
prototype/
├── SKILL.md                        # 主技能文件（核心指令）
├── README.md                       # 本文档
└── references/                     # 详细示例
    ├── shadow-examples.md          # 管理后台完整示例
    ├── app-examples.md             # 移动端完整示例
    └── common-prototypes.md        # 快速参考和代码片段
```

## 使用方式

### 触发场景

AI Agent 在以下情况自动使用：
- 用户说"创建原型"、"prototype"、"demo"
- 需要快速验证 UI 交互
- 向客户展示想法
- 团队讨论界面设计

### 输出示例

**管理后台原型**:
```
docs/prototype/user-list/
└── index.html              # 用户列表管理原型
```

**移动端原型**:
```
docs/prototype/product-list/
└── index.html              # 商品列表原型（移动端）
```

### 打开方式

1. **直接打开**: 双击 `index.html` 文件
2. **本地服务器**（推荐，避免跨域）:
   ```bash
   # Python
   cd docs/prototype
   python -m http.server 8000
   
   # Node.js
   npx serve .
   
   # PHP
   php -S localhost:8000
   ```
   访问: http://localhost:8000/user-list/

## 原型类型

### 管理后台风格（ainative-shadow）

基于 Vue3 + Element Plus，适用于：
- ✅ 数据列表 + CRUD
- ✅ 搜索筛选表单
- ✅ 数据仪表盘
- ✅ 配置表单
- ✅ 统计卡片

**特点**:
- 使用 Element Plus 组件
- PC 端布局（最大宽度 1400px）
- 表格、表单、对话框等

### 移动端风格（ainative-app）

基于 Vue3，适用于：
- ✅ 商品列表（下拉刷新/上拉加载）
- ✅ 表单提交
- ✅ 详情页面
- ✅ 搜索功能
- ✅ 地址选择

**特点**:
- 移动端优化（最大宽度 750px）
- 触摸交互
- 底部操作栏
- 导航栏

## 设计标准

### 项目 Design Tokens

原型自动应用项目的设计标准：

```css
/* 颜色系统 */
--primary-color: #1890ff;
--success-color: #52c41a;
--warning-color: #faad14;
--error-color: #ff4d4f;

/* 文字颜色 */
--text-color: #333333;
--text-secondary: #666666;
--text-tertiary: #999999;

/* 背景颜色 */
--bg-color: #f5f5f5;
--border-color: #eeeeee;

/* 间距系统 */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 24px;

/* 圆角和阴影 */
--border-radius: 8px;
--box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
```

### CDN 依赖

```html
<!-- Vue 3 -->
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>

<!-- Element Plus（管理后台） -->
<link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css">
<script src="https://unpkg.com/element-plus"></script>

<!-- ECharts（图表，可选） -->
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
```

## 示例覆盖

### 管理后台示例

完整示例见 [shadow-examples.md](references/shadow-examples.md)

| 示例 | 说明 | 行数 |
|------|------|------|
| 用户列表 | 完整的 CRUD、搜索、分页 | ~400 行 |
| 数据仪表盘 | 统计卡片 + ECharts 图表 | ~250 行 |
| 表单提交 | 表单验证、文件上传 | ~200 行 |

### 移动端示例

完整示例见 [app-examples.md](references/app-examples.md)

| 示例 | 说明 | 行数 |
|------|------|------|
| 商品列表 | 搜索、筛选、加载更多 | ~450 行 |
| 表单编辑 | 头像上传、单选、文本域 | ~350 行 |
| 商品详情 | 轮播、规格选择、底部按钮 | ~400 行 |

## 原型特性

### 数据模拟

```javascript
// 静态数据
const mockData = [
  { id: 1, name: '用户1', status: 'active' },
  { id: 2, name: '用户2', status: 'inactive' }
];

// 延迟模拟（模拟网络请求）
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

// LocalStorage 持久化
localStorage.setItem('prototype-data', JSON.stringify(mockData));
const saved = JSON.parse(localStorage.getItem('prototype-data') || '[]');
```

### 原型标记

每个原型包含明显的标记：

```html
<!-- 顶部注释 -->
<!--
  原型名称: 用户列表
  功能说明: 用户列表展示、搜索筛选、CRUD 操作
  如何使用: 双击打开或使用本地服务器
  原型限制: 使用模拟数据，未实现真实 API
  下一步: 对接后端 API，完善验证和错误处理
-->

<!-- 视觉标记 -->
<div class="prototype-badge">🚧 原型演示</div>
```

## 开发流程

### 1. 确定原型类型
- 管理后台风格（数据管理、仪表盘）
- 移动端风格（列表、表单、详情）

### 2. 选择基础模板
- 从 SKILL.md 复制对应模板
- 或参考 references 中的完整示例

### 3. 添加业务逻辑
- 在 `setup()` 中添加 reactive 数据
- 实现事件处理方法
- 使用模拟数据

### 4. 应用项目样式
- 使用设计 tokens（CSS 变量）
- 保持与项目风格一致

### 5. 测试和完善
- 在目标设备/浏览器测试
- 添加必要的注释说明
- 保存到 docs/prototype 目录

## 与原始版本的对比

| 方面 | 原始版本 | 新版本 |
|------|----------|--------|
| 输出格式 | 多文件项目 | 单个 HTML 文件 |
| 输出位置 | 项目 src 目录 | docs/prototype 目录 |
| 依赖管理 | npm install | CDN 引入 |
| 运行方式 | npm dev | 双击打开 |
| 构建需求 | 需要构建 | 无需构建 |
| 技术栈 | 需匹配项目 | 通用（Vue3） |
| 样式集成 | 使用项目组件 | CSS 变量模拟 |

## 最佳实践

### DO ✅

- ✅ 使用项目设计 tokens（颜色、字体、间距）
- ✅ 添加清晰的原型标记
- ✅ 在顶部注释说明功能和限制
- ✅ 使用 LocalStorage 模拟数据持久化
- ✅ 添加延迟模拟网络请求
- ✅ 核心功能可正常演示

### DON'T ❌

- ❌ 引入真实后端 API
- ❌ 实现完整的错误处理
- ❌ 追求样式像素级完美
- ❌ 处理所有边界情况
- ❌ 创建复杂的文件结构

## 快速参考

### 占位图服务

```javascript
const placeholder = (width, height, text) => 
  `https://via.placeholder.com/${width}x${height}/409EFF/FFFFFF?text=${text}`;

// 使用
avatar: placeholder(150, 150, 'Avatar')
banner: placeholder(750, 300, 'Banner')
```

### 常用代码片段

详见 [common-prototypes.md](references/common-prototypes.md):
- 延迟函数
- LocalStorage 持久化
- 分页逻辑
- 表单验证
- 列表筛选

## 检查清单

开发原型时确认：

- [ ] 单个 HTML 文件
- [ ] 使用 CDN 依赖
- [ ] 应用项目设计 tokens
- [ ] 包含原型标记徽章
- [ ] 顶部有功能说明注释
- [ ] 核心功能可演示
- [ ] 保存到 docs/prototype 目录

## 相关链接

- [SKILL.md](SKILL.md) - 核心技能文件
- [管理后台示例](references/shadow-examples.md) - 完整的管理后台原型
- [移动端示例](references/app-examples.md) - 完整的移动端原型
- [快速参考](references/common-prototypes.md) - 代码片段和模板
- [项目文档](../../docs/dev-spec/readme.md) - 开发规范

---

**最后更新**: 2026-02-03  
**版本**: 2.0.0（单文件 HTML 版本）
