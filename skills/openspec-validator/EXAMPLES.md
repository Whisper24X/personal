# OpenSpec Validator 使用示例

## 示例 1：完整的审查流程

### 场景

用户正在开发"商品类型新增定金"功能，需要审查 openspec 规范是否与 PRD 和 design.md 一致。

### 步骤 1：定位文件

```
当前目录:
workspace/.../openspec/changes/add-deposit-good-type/
├── proposal.md
├── design.md
├── specs/
│   ├── good-management/spec.md
│   └── order-management/spec.md
└── tasks.md
```

### 步骤 2：读取基准文档

**PRD（从 spec.md 中的 Requirements 提取）**:

```markdown
### Requirement: 定金商品类型支持

系统 SHALL 支持「定金」商品类型...

#### Scenario: 管理员创建定金商品

- WHEN 管理员在管理后台创建商品
- AND 选择商品类型为「定金」
- THEN 系统自动隐藏预约相关配置项
```

**design.md 关键决策**:

```markdown
### Decision: 商品类型枚举扩展

**What**: 在 GoodType 枚举新增 `deposit`（定金）类型。

### Decision: 订单创建逻辑按商品类型分支处理

**What**: 定金商品跳过预约字段校验。
```

### 步骤 3：审查 good-management/spec.md

#### 发现的问题：

**问题 1：冲突 - 枚举定义不完整**

原内容：

```markdown
## MODIFIED Data Models

### GoodType 枚举

- single: 单日营
- multi: 多日营
```

基准文档（design.md）要求包含 `deposit` 类型。

**修正**：

```markdown
## MODIFIED Data Models

### GoodType 枚举

- single: 单日营
- multi: 多日营
- deposit: 定金 ← 新增
```

**问题 2：缺失 - 创建定金商品的 API 响应定义**

PRD 提到"管理员创建定金商品"，但 API 响应未包含 `goodType` 字段。

**补充**：

```markdown
## MODIFIED APIs

### POST /api/v1/shadow/platformgood/create

#### Response

\`\`\`json
{
"id": "uuid",
"name": "string",
"price": "number",
"goodType": "string" // ← 新增，返回商品类型
}
\`\`\`
```

### 步骤 4：审查 order-management/spec.md

#### 发现的问题：

**问题 3：缺失 - 定金商品订单创建场景**

PRD 包含"Scenario: 用户购买定金商品"，但 spec 中未体现。

**补充**：

```markdown
## ADDED Requirements

### Requirement: 定金商品订单创建

#### Scenario: 用户购买定金商品

- WHEN 用户提交订单
- AND 商品类型为 deposit
- THEN 系统跳过课程、时间、营员等字段校验
- AND 系统创建订单，订单中不包含预约相关信息
- AND 返回订单 ID 和支付信息
```

**问题 4：逻辑错误 - 校验规则前后矛盾**

原内容：

```markdown
### Scenario: 创建订单

- WHEN 用户提交订单
- THEN 系统校验必填字段：courseId, appointmentTime, studentIC
```

这与 PRD "定金商品无需预约"冲突。

**修正**：

```markdown
### Scenario: 创建订单

- WHEN 用户提交订单
- AND 商品类型为 single 或 multi
- THEN 系统校验必填字段：courseId, appointmentTime, studentIC

### Scenario: 创建定金商品订单

- WHEN 用户提交订单
- AND 商品类型为 deposit
- THEN 系统跳过 courseId, appointmentTime, studentIC 的校验
- AND 系统仅校验基本字段：goodId, quantity, contactInfo
```

### 步骤 5：生成审查报告

```markdown
# OpenSpec 审查报告

**变更**: add-deposit-good-type
**审查时间**: 2026-02-05 10:30:00

## 审查结果

### ✅ 已修正的冲突 (1 处)

1. [good-management] 商品类型枚举定义不完整
   - 原：只包含 single/multi
   - 改：添加 deposit 类型

### ✅ 已补充的缺失 (2 处)

1. [good-management] API 响应缺少 goodType 字段
   - 补充：在创建商品响应中添加 goodType
2. [order-management] 缺少定金商品订单创建场景
   - 补充：添加完整的定金商品订单创建场景

### ✅ 已修正的错误 (1 处)

1. [order-management] 订单校验逻辑前后矛盾
   - 原：所有订单都必须校验预约字段
   - 改：按商品类型分支处理，deposit 类型跳过预约字段校验

### 验证清单

- [x] 所有 PRD 需求已覆盖
- [x] 所有 design 决策已反映
- [x] 跨 spec 引用一致
- [x] 数据模型定义完整
- [x] API 定义完整
```

---

## 示例 2：检查跨 spec 一致性

### 场景

两个 spec 中对同一概念的定义不一致。

### 问题发现

**good-management/spec.md**:

```markdown
### GoodType 枚举

- SINGLE: 单日营
- MULTI: 多日营
- DEPOSIT: 定金
```

**order-management/spec.md**:

```markdown
### 订单商品类型

商品类型包括：single（单日营）、multi（多日营）
```

### 问题分析

1. **命名不一致**：一个用大写（SINGLE），一个用小写（single）
2. **缺失 deposit 类型**：order-management 未包含 deposit 类型
3. **定义位置重复**：两个 spec 都定义了相同的枚举

### 修正方案

**方案 1：统一引用**（推荐）

在 good-management/spec.md 中定义：

```markdown
### GoodType 枚举 {#goodtype-enum}

- single: 单日营
- multi: 多日营
- deposit: 定金
```

在 order-management/spec.md 中引用：

```markdown
### 订单商品类型

参考 [GoodType 枚举](#goodtype-enum)，订单支持所有商品类型。
```

**方案 2：明确主定义**（备选）

如果必须在两处都定义，添加说明：

```markdown
### 订单商品类型

> 注：此枚举定义与 good-management/spec.md 保持一致

商品类型枚举：

- single: 单日营
- multi: 多日营
- deposit: 定金
```

### 修正后验证

运行一致性检查：

```bash
# 搜索所有 spec 中的 goodType 定义
grep -r "GoodType" specs/
grep -r "goodType" specs/
grep -r "single.*multi.*deposit" specs/

# 确保所有定义一致
```

---

## 示例 3：补充缺失的错误处理

### 场景

design.md 提到需要处理"商品类型不合法"的错误，但 spec 中未定义。

### PRD/Design 要求

**design.md**:

```markdown
### Risk: 商品类型不合法

用户可能传入非法的商品类型值，需要返回明确的错误提示。
```

### 当前 spec 状态

**good-management/spec.md**:

```markdown
### POST /api/v1/shadow/platformgood/create

#### Request

\`\`\`json
{
"goodType": "string"
}
\`\`\`

#### Response 200

\`\`\`json
{
"id": "uuid"
}
\`\`\`
```

### 问题识别

缺失：

1. 错误响应定义
2. 错误码定义
3. 错误提示文案

### 补充内容

```markdown
### POST /api/v1/shadow/platformgood/create

#### Request

\`\`\`json
{
"goodType": "string" // 必须为 single/multi/deposit
}
\`\`\`

#### Response 200 - Success

\`\`\`json
{
"id": "uuid",
"goodType": "string"
}
\`\`\`

#### Response 400 - Bad Request

\`\`\`json
{
"code": "INVALID_GOOD_TYPE",
"message": "商品类型不合法，支持的类型：single（单日营）、multi（多日营）、deposit（定金）",
"details": {
"field": "goodType",
"value": "invalid_value",
"allowedValues": ["single", "multi", "deposit"]
}
}
\`\`\`

#### Validation Rules

- goodType 必填
- goodType 必须为以下值之一：single, multi, deposit
- goodType 大小写敏感（必须小写）
```

---

## 示例 4：处理 Open Questions

### 场景

design.md 中有未确定的业务规则。

### design.md Open Questions

```markdown
## Open Questions

- 定金商品是否支持优惠券？是否有使用限制？
- 定金商品退款规则是什么？是否支持退款？
```

### 处理策略

#### 策略 1：标记为待定（推荐）

在相关 spec 中添加注释：

```markdown
### Scenario: 用户使用优惠券购买定金商品

> ⚠️ **待确认**：定金商品是否支持优惠券使用，业务规则待明确。
> 临时方案：允许使用，但优惠券系统可能拒绝（取决于优惠券配置）

- WHEN 用户提交订单
- AND 商品类型为 deposit
- AND 用户选择了优惠券
- THEN 系统尝试应用优惠券
- IF 优惠券系统拒绝，THEN 返回错误提示
```

#### 策略 2：采用保守方案

如果必须现在实现：

```markdown
### Scenario: 定金商品暂不支持优惠券

- WHEN 用户提交订单
- AND 商品类型为 deposit
- AND 用户选择了优惠券
- THEN 系统返回错误：「定金商品暂不支持优惠券」

> 📝 **实现说明**：此为临时方案，后续根据业务规则调整
```

#### 策略 3：记录在待办中

在 tasks.md 中添加：

```markdown
## Pending Decisions

- [ ] 确认定金商品是否支持优惠券
  - 影响：order-management/spec.md 订单创建逻辑
  - 优先级：P1
  - 依赖：业务方确认
```

---

## 示例 5：数据流完整性验证

### 场景

验证用户购买定金商品的端到端流程。

### 完整数据流

```markdown
## 端到端验证：用户购买定金商品

### Step 1: 浏览商品列表

- **API**: GET /api/v1/shadow/platformgood/list
- **Spec**: good-management/spec.md
- **数据流**:
  - 输入：分页参数
  - 输出：商品列表（包含 goodType）

### Step 2: 查看商品详情

- **API**: GET /api/v1/shadow/platformgood/detail/:id
- **Spec**: good-management/spec.md
- **数据流**:
  - 输入：商品 ID
  - 输出：商品详细信息（包含 goodType）
- **UI 逻辑**:
  - 根据 goodType=deposit，显示「立即购买」按钮
  - 隐藏预约相关组件

### Step 3: 创建订单

- **API**: POST /api/v1/app/order/create
- **Spec**: order-management/spec.md
- **数据流**:
  - 输入：{ goodId, quantity, contactInfo }
  - 后端查询：根据 goodId 查询商品信息（获取 goodType）
  - 校验逻辑：if goodType=deposit, 跳过预约字段校验
  - 输出：{ orderId, paymentInfo }

### Step 4: 支付订单

- **API**: POST /api/v1/payment/pay
- **Spec**: payment/spec.md (如存在)
- **数据流**:
  - 输入：{ orderId, paymentMethod }
  - 输出：{ paymentStatus, paymentUrl }

### Step 5: 查看订单详情

- **API**: GET /api/v1/app/order/detail/:id
- **Spec**: order-management/spec.md
- **数据流**:
  - 输入：订单 ID
  - 输出：订单详情（不包含预约信息）
```

### 验证检查点

```markdown
- [x] Step 1 → Step 2：商品列表的 goodType 字段在详情页正确使用
- [x] Step 2 → Step 3：详情页的 goodType 传递到订单创建逻辑
- [x] Step 3 内部：订单创建时正确查询商品 goodType 并应用校验规则
- [x] Step 3 → Step 4：订单 ID 正确传递到支付流程
- [x] Step 4 → Step 5：支付完成后订单状态正确更新
```

### 发现的问题

```markdown
❌ 问题：Step 3 中，订单创建 API 的请求体只包含 goodId，
后端需要查询商品表获取 goodType，但 spec 中未说明此查询逻辑。

✅ 补充：
\`\`\`markdown

### POST /api/v1/app/order/create

#### 实现逻辑

1. 根据请求中的 goodId 查询商品信息
2. 获取商品的 goodType 字段
3. 根据 goodType 决定校验规则：
   - 如果 goodType = deposit，跳过 courseId、appointmentTime、studentIC 校验
   - 如果 goodType = single 或 multi，校验上述字段
4. 创建订单记录
5. 返回订单 ID
   \`\`\`
```

---

## 最佳实践总结

### 1. 系统性检查

- ✅ 从 PRD 出发，逐条检查需求覆盖
- ✅ 从 design.md 出发，逐个检查技术决策体现
- ✅ 交叉验证不同 spec 之间的一致性

### 2. 优先级管理

1. **P0 - 冲突**：立即修正，直接影响正确性
2. **P1 - 缺失（关键）**：必须补充，否则规范不完整
3. **P2 - 缺失（次要）**：可以后续补充
4. **P3 - 优化建议**：可选改进

### 3. 修正原则

- **保守修改**：只修改明确冲突的部分
- **明确标注**：对于不确定的内容，添加"待确认"标记
- **保持结构**：遵循现有的 spec 格式和风格
- **完整记录**：所有修改都记录在审查报告中

### 4. 验证闭环

```
审查 → 修正 → 二次验证 → 生成报告 → 人工确认
```

每次修改后重新运行完整性验证，确保修改没有引入新问题。
