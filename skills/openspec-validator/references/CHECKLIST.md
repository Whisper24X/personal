# OpenSpec 审查清单

## 审查前准备

### 基准文档收集

- [ ] 已读取 PRD 文档或 spec 中的 Requirements
- [ ] 已读取 design.md（技术设计）
- [ ] 已读取 proposal.md（变更说明）
- [ ] 已列出所有需要审查的 spec 文件

### 理解变更范围

- [ ] 明确变更的业务目标
- [ ] 明确涉及的系统模块
- [ ] 明确受影响的用户角色
- [ ] 明确数据模型变更

---

## 冲突检查清单

### 需求层面冲突

#### 业务规则冲突

- [ ] PRD 中的业务规则是否与 spec 一致？
- [ ] 特殊情况处理是否一致？
- [ ] 前置条件是否一致？
- [ ] 后置条件是否一致？

**示例**：

```markdown
❌ 冲突：
PRD: "定金商品无需预约"
spec: "用户需选择课程和时间"

✅ 修正：
spec: "当商品类型为 deposit 时，跳过课程和时间选择"
```

#### 用户场景冲突

- [ ] 用户操作流程是否一致？
- [ ] UI 展示逻辑是否一致？
- [ ] 交互行为是否一致？

**示例**：

```markdown
❌ 冲突：
PRD: "显示【立即购买】按钮"
spec: "显示【立即预约】按钮"

✅ 修正：
spec: "当商品类型为 deposit 时，显示【立即购买】按钮"
```

### 技术层面冲突

#### 数据模型冲突

- [ ] 字段定义是否与 design.md 一致？
- [ ] 枚举值是否与 design.md 一致？
- [ ] 表关系是否与 design.md 一致？
- [ ] 必填/可选属性是否一致？

**示例**：

```markdown
❌ 冲突：
design.md: "GoodType 枚举包含 single/multi/deposit"
spec: "GoodType 枚举包含 single/multi"

✅ 修正：
spec: "GoodType 枚举值：single（单日营）、multi（多日营）、deposit（定金）"
```

#### 接口定义冲突

- [ ] 请求参数是否与 design.md 一致？
- [ ] 响应字段是否与 design.md 一致？
- [ ] 校验规则是否与 design.md 一致？
- [ ] 错误码是否与 design.md 一致？

#### 业务逻辑冲突

- [ ] 校验逻辑是否与 design.md 决策一致？
- [ ] 处理分支是否与 design.md 决策一致？
- [ ] 特殊情况处理是否一致？

---

## 缺失检查清单

### 需求覆盖缺失

#### PRD 需求覆盖

- [ ] 每个 ADDED Requirement 都有对应的 spec 描述
- [ ] 每个 MODIFIED Requirement 都有对应的 spec 更新
- [ ] 每个 Scenario 都有对应的接口或逻辑描述
- [ ] 每个业务规则都有对应的校验逻辑

**检查方法**：

1. 列出 PRD 中的所有需求 ID
2. 在所有 spec 中搜索对应的需求描述
3. 未找到的需求 = 缺失需求

#### 用户场景覆盖

- [ ] 管理员操作场景完整
- [ ] 普通用户操作场景完整
- [ ] 异常场景覆盖完整
- [ ] 边界情况覆盖完整

**示例缺失**：

```markdown
PRD 中提到：

- Scenario: 用户浏览定金商品详情页
- Scenario: 用户购买定金商品

spec 中只有：

- Scenario: 用户浏览商品详情页（未区分类型）

❌ 缺失：定金商品详情页的特殊展示逻辑

✅ 补充：

### Scenario: 用户浏览定金商品详情页

- WHEN 用户进入商品详情页
- AND 商品类型为 deposit
- THEN 显示【立即购买】按钮
- AND 隐藏预约相关组件
```

### 技术规范缺失

#### 数据模型定义

- [ ] 所有涉及的表都有定义
- [ ] 所有新增字段都有定义
- [ ] 所有修改字段都有说明
- [ ] 字段类型、长度、约束都明确

#### 接口定义

- [ ] 所有涉及的接口都有定义
- [ ] 请求参数完整（路径参数、查询参数、请求体）
- [ ] 响应定义完整（成功响应、错误响应）
- [ ] 权限要求明确
- [ ] 限流要求明确

**示例缺失**：

```markdown
design.md 提到：
"商品信息查询接口需返回商品类型字段"

spec 中接口响应定义：
\`\`\`json
{
"id": "uuid",
"name": "string",
"price": "number"
}
\`\`\`

❌ 缺失：goodType 字段定义

✅ 补充：
\`\`\`json
{
"id": "uuid",
"name": "string",
"price": "number",
"goodType": "string" // 商品类型：single/multi/deposit
}
\`\`\`
```

#### 校验规则

- [ ] 所有必填字段的校验规则
- [ ] 所有格式校验规则
- [ ] 所有业务校验规则
- [ ] 所有权限校验规则

#### 错误处理

- [ ] 所有可能的错误场景都有定义
- [ ] 所有错误码都有定义
- [ ] 所有错误提示都有定义
- [ ] 错误恢复机制都有说明

### 跨模块影响

#### 依赖模块影响

- [ ] 对优惠券系统的影响
- [ ] 对库存系统的影响
- [ ] 对通知系统的影响
- [ ] 对统计系统的影响

**检查方法**：
参考 proposal.md 中的 "Affected specs" 和 design.md 中的 "Risks"

---

## 错误检查清单

### 内部逻辑错误

#### 前后矛盾

- [ ] 同一 spec 内的描述是否一致
- [ ] WHEN/THEN 逻辑是否合理
- [ ] 前置条件与操作是否匹配

**示例**：

```markdown
❌ 错误：
Scenario 1: "定金商品不需要选择课程"
Scenario 2: "用户提交订单时必须选择课程"

✅ 修正：
Scenario 2: "当商品类型为 single/multi 时，用户提交订单必须选择课程；当商品类型为 deposit 时，跳过课程选择"
```

#### 条件覆盖不完整

- [ ] if-else 分支是否完整
- [ ] 枚举所有可能值是否都有处理逻辑
- [ ] 边界条件是否考虑

### 跨 spec 一致性错误

#### 概念定义不一致

- [ ] 同一概念在不同 spec 中的名称一致
- [ ] 同一概念在不同 spec 中的定义一致
- [ ] 同一概念在不同 spec 中的枚举值一致

**示例**：

```markdown
❌ 不一致：
good-management/spec.md: "商品类型：单日营/多日营/定金"
order-management/spec.md: "商品类型：营地活动/其他"

✅ 修正：统一使用 single/multi/deposit
```

#### 数据类型不一致

- [ ] 同一字段在不同 spec 中的类型一致
- [ ] 同一字段在不同 spec 中的格式一致
- [ ] 同一字段在不同 spec 中的约束一致

#### 引用关系错误

- [ ] 外键引用的表存在
- [ ] 引用的字段存在
- [ ] 引用的枚举值存在
- [ ] 引用的接口存在

---

## 完整性验证清单

### 需求追溯性

#### PRD → Spec 追溯

```markdown
对 PRD 中的每个需求：

- [ ] 需求 1: {需求描述}
  - 覆盖 spec: {spec-name}
  - 覆盖场景: {scenario-name}
- [ ] 需求 2: {需求描述}
  - 覆盖 spec: {spec-name}
  - 覆盖场景: {scenario-name}
```

#### Design → Spec 追溯

```markdown
对 design.md 中的每个决策：

- [ ] Decision: {决策名称}
  - 体现在 spec: {spec-name}
  - 体现在字段: {field-name} 或 接口: {api-name}
```

### 端到端场景验证

#### 用户旅程完整性

- [ ] 用户从进入到完成整个流程的所有步骤都有规范
- [ ] 每个步骤涉及的接口都有定义
- [ ] 每个步骤的数据流转都清晰

**示例**：

```markdown
用户购买定金商品的完整旅程：

1. 浏览商品列表 → spec: good-management, API: GET /api/goods
2. 查看商品详情 → spec: good-management, API: GET /api/goods/:id
3. 点击立即购买 → spec: order-management, UI 逻辑
4. 提交订单 → spec: order-management, API: POST /api/orders
5. 支付订单 → spec: payment（如有）, API: POST /api/payments
6. 查看订单结果 → spec: order-management, API: GET /api/orders/:id
```

### 数据一致性验证

#### 数据生命周期

- [ ] 数据创建时的所有字段都有定义
- [ ] 数据更新时的所有字段都有定义
- [ ] 数据删除时的处理逻辑都有定义
- [ ] 数据关联关系都有定义

#### 状态机完整性

- [ ] 所有状态都有定义
- [ ] 所有状态转换都有定义
- [ ] 状态转换的触发条件都有定义
- [ ] 状态转换的权限都有定义

---

## 审查报告模板

```markdown
# OpenSpec 审查报告

**变更名称**: {change-name}  
**审查时间**: {timestamp}  
**审查范围**: {列出所有审查的文件}

---

## 1. 冲突修正 ({count} 处)

### 1.1 需求层面冲突

#### [good-management/spec.md] 商品类型定义不完整

**问题**: 缺少 deposit 类型  
**基准**: design.md 第 28 行  
**修正**: 已添加 deposit 类型到枚举定义  
**影响**: 无破坏性变更

---

## 2. 缺失补充 ({count} 处)

### 2.1 需求覆盖缺失

#### [order-management/spec.md] 缺少定金商品订单创建场景

**问题**: PRD 中的 "Scenario: 用户购买定金商品" 未在 spec 中体现  
**基准**: PRD Scenario line 24-32  
**补充**: 已添加完整的定金商品订单创建场景，包括字段校验逻辑  
**影响**: 补充关键业务场景

### 2.2 技术规范缺失

#### [good-management/spec.md] 缺少商品类型字段返回定义

**问题**: 接口响应未包含 goodType 字段  
**基准**: design.md Decision "商品信息查询接口调整"  
**补充**: 已在 API 响应定义中添加 goodType 字段  
**影响**: API 契约补充

---

## 3. 错误修正 ({count} 处)

### 3.1 逻辑错误

#### [order-management/spec.md] 订单校验逻辑前后矛盾

**问题**: 同时声明"定金商品无需预约"和"订单必须包含 courseId"  
**修正**: 已添加条件判断，deposit 类型跳过 courseId 校验  
**影响**: 修正业务逻辑

### 3.2 跨 spec 不一致

#### [good-management vs order-management] 商品类型枚举不一致

**问题**: good-management 包含 deposit，order-management 不包含  
**修正**: 已统一为 single/multi/deposit  
**影响**: 保持数据一致性

---

## 4. 待人工确认 ({count} 项)

### 4.1 业务规则待定

#### 定金商品是否支持优惠券？

**上下文**: design.md Open Questions 提及  
**当前处理**: spec 中未限制，但建议明确规则  
**建议**: 与业务方确认后补充到 spec

---

## 5. 完整性验证

### 5.1 需求覆盖验证

- [x] PRD Requirement 1: 定金商品类型支持 → 已覆盖
- [x] PRD Requirement 2: 商品类型枚举扩展 → 已覆盖
- [x] PRD Requirement 3: 订单创建逻辑调整 → 已覆盖

### 5.2 技术决策验证

- [x] Decision 1: 商品类型枚举扩展 → 已体现
- [x] Decision 2: 订单创建逻辑分支处理 → 已体现
- [x] Decision 3: 前端根据类型动态调整 UI → 已体现

### 5.3 端到端验证

- [x] 用户购买定金商品完整流程已覆盖
- [x] 管理员创建定金商品完整流程已覆盖

---

## 6. 总结

### 审查统计

- 修正冲突: {count} 处
- 补充缺失: {count} 处
- 修正错误: {count} 处
- 待人工确认: {count} 项

### 风险评估

- **高风险**: 0 项
- **中风险**: {count} 项（需人工确认）
- **低风险**: {count} 项（已修正）

### 下一步行动

1. [ ] 审查所有修改内容
2. [ ] 确认 {count} 项待定问题
3. [ ] 更新 tasks.md（如需要）
4. [ ] 提交变更

---

## 附录：修改文件列表

- [x] specs/good-management/spec.md
- [x] specs/order-management/spec.md
- [ ] specs/payment/spec.md (无需修改)
```

---

## 使用建议

1. **第一次审查**：按清单逐项检查，标记所有问题
2. **批量修正**：优先处理冲突，再补充缺失，最后修正错误
3. **二次验证**：修正后重新运行完整性验证清单
4. **持续改进**：根据实际情况补充清单项
