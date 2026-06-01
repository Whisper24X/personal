# 迭代场景详细指南

当原型类型为**迭代**时，必须先读取前端代码，再生成与现有实现风格一致的原型。
迭代输入可以是：用户的口头描述、或一份**版本评审文档**（含「版本想法」「行动项」「评审结论」）。

---

## 路径基准

`{root}` 根据端类型选择（需先检查目录是否存在）：

| 端类型       | `{root}` 候选                   |
| ------------ | ------------------------------- |
| 管理后台     | `ainative-shadow` 或 `frontend` |
| 移动端小程序 | `ainative-app`                  |

---

## 版本评审文档 → 原型（新增流程）

当输入为版本评审 md 文件时，按以下步骤提取信息再生成原型：

### 第一步：提取变更信息

从文档中提取：

| 字段     | 来源位置                 | 提取内容                             |
| -------- | ------------------------ | ------------------------------------ |
| 涉及页面 | 「版本想法」/ 「行动项」 | 哪个页面（如「课程预约管理」）       |
| 字段变更 | 「行动项」               | 删除/新增哪些字段                    |
| 数据规则 | 「评审结论 → 建议」      | 字段取值逻辑（如排序规则、关联方式） |
| 降级展示 | 「评审结论 → 建议」      | 异常时如何展示（如显示「—」）        |
| 帮助文案 | 「评审结论 → 建议」      | 是否需要注释说明文案                 |

### 第二步：推断功能域

根据页面名称推断 `{domain}` 路径：

| 页面描述                 | 推断 domain                          | 建议读取路径               |
| ------------------------ | ------------------------------------ | -------------------------- |
| 课程预约管理             | courseReservation / classReservation | `views/courseReservation/` |
| 子订单管理               | subOrder / orderSub                  | `views/subOrder/`          |
| 优化 Dashboard 统计卡片  | dashboard                            | `views/dashboard/`         |
| 改进 PlatformList 的筛选 | platform                             | `views/platform/`          |
| 配置页面的表单布局       | config                               | `views/config/`            |
| 业务线列表样式           | businessLine                         | `views/businessLine/`      |

**若无法精确推断**：在 `{root}/src/views/` 或 `{root}/src/pages/` 中搜索包含关键词的目录名。

### 第三步：读取相关前端代码

| 类型     | 路径                                                                   |
| -------- | ---------------------------------------------------------------------- |
| 页面级   | `{root}/src/views/{domain}/*.vue` 或 `{root}/src/pages/{domain}/*.vue` |
| 通用组件 | `{root}/src/components/common/*.vue`                                   |
| 领域组件 | `{root}/src/views/{domain}/components/*.vue`                           |
| 样式     | `{root}/src/style.css`、`{root}/src/App.vue` style 块                  |

**注意**：项目可能使用 `views` 或 `pages` 目录，需先检查哪个存在。

### 第四步：生成原型

基于读取到的代码，生成与现有页面**视觉风格一致**的原型，并体现版本评审中的所有字段变更。

---

## 字段变更类迭代示例

以版本评审「删除商家实收、新增实收金额」为例：

```html
<!-- 表格列变更前 -->
<el-table-column prop="merchantReceived" label="商家实收" width="120" />

<!-- 表格列变更后（迭代原型） -->
<el-table-column prop="actualAmount" label="实收金额" width="120">
  <template #default="{ row }">
    <span>{{ row.actualAmount !== null ? '¥' + row.actualAmount : '—' }}</span>
    <!-- 帮助文案 tooltip -->
    <el-tooltip content="实收金额来源于该父订单下最新一条子订单，可能与子订单管理逐条展示存在差异" placement="top">
      <span style="color: #909399; cursor: help; margin-left: 4px;">?</span>
    </el-tooltip>
  </template>
</el-table-column>
```

对应模拟数据：

```javascript
// 迭代后的模拟数据（体现降级展示：null → '—'）
const mockData = [
  { id: 1, orderId: 'ORD001', ..., actualAmount: 299.00 },
  { id: 2, orderId: 'ORD002', ..., actualAmount: null },   // 无子订单，显示「—」
  { id: 3, orderId: 'ORD003', ..., actualAmount: 150.00 },
];
```

---

## 参考要点（读取代码后关注）

1. **布局结构**：el-row/el-col、el-card 使用方式，页面标题组件
2. **表格配置**：现有列顺序、宽度、fixed 配置
3. **颜色、间距、圆角、阴影**：从 style.css、App.vue 提取
4. **数据流**：ref/reactive、props、emit 写法习惯
5. **图标使用**：@element-plus/icons-vue 还是 emoji 还是自定义
6. **操作列布局**：编辑/删除按钮的放置方式

---

## 帮助文案区块模板

当评审结论中要求展示帮助文案时，在原型中添加：

```html
<!-- 方式一：列内 tooltip -->
<el-tooltip :content="helpText" placement="top">
  <el-icon style="color: #909399; cursor: help;"><QuestionFilled /></el-icon>
</el-tooltip>

<!-- 方式二：列头 tooltip -->
<el-table-column label="实收金额" width="140">
  <template #header>
    <span>实收金额</span>
    <el-tooltip content="来源于该父订单下最新一条子订单" placement="top">
      <span style="color: #909399; margin-left: 4px; cursor: help;">?</span>
    </el-tooltip>
  </template>
</el-table-column>

<!-- 方式三：页面顶部提示条 -->
<el-alert
  title="实收金额来源于该父订单下最新一条子订单，可能与子订单管理逐条展示存在差异"
  type="info"
  :closable="false"
  show-icon
  style="margin-bottom: 16px;"
/>
```
