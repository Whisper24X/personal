# 测试文档（飞书智能硬件批量）

---

## 第二部分：测试用例（飞书智能硬件批量）

### 用例编写规范

#### 优先级定义

| 优先级 | 定义     | 说明                       |
| ------ | -------- | -------------------------- |
| P0     | 核心功能 | 主流程、核心业务，必须通过 |
| P1     | 重要功能 | 重要分支、常用功能         |
| P2     | 一般功能 | 边界条件、异常处理         |
| P3     | 低优先级 | 极端场景、优化建议         |

#### 用例格式说明

- 采用 **Given-When-Then** 格式（BDD风格）
- **Given**：前置条件和测试数据准备
- **When**：执行的操作步骤（含具体导航路径，可直接映射为 Playwright action）
- **Then**：预期结果验证（仅页面可观测结果，可直接映射为 Playwright assertion）


---

#### TC-HW-0003：[研学后台]旧订单后台操作退款逻辑回归验证验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0003 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631314639 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、选择旧订单、并且是多日营商品、3选2 操作退款
- 2、后台输入退款金额

**Then**：

- 能正常退款，并且能收到退款金额 并且订单状态为：已退款

---

#### TC-HW-0004：[研学后台]旧订单后台操作退款逻辑回归验证验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0004 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631314639 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、选择旧订单、并且是单日营商品、3选2 操作退款
- 2、后台输入退款金额

**Then**：

- 能正常退款，并且能收到退款金额 并且订单状态为：已退款

---

#### TC-HW-0005：[研学后台]导入订单，子订单拆分逻辑验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0005 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631043204 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、购买多选商品 或 造一笔 抖音/微店 订单（3选2）
- 2、预约其中一个

**Then**：

- 查看后台拆单逻辑： 查看对应的子订单状态为：已预约 父订单状态为：待预约

---

#### TC-HW-0006：[研学后台]导入订单，子订单拆分逻辑验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0006 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631043204 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、购买多选商品3选2 或 造一笔 抖音/微店 订单（3选2）
- 2、预约其中一个之后，取消预约

**Then**：

- 查看后台拆单逻辑： 查看对应的子订单状态为：已预约 -> 待预约 父订单状态为：待预约

---

#### TC-HW-0007：[研学后台]导入订单，子订单拆分逻辑验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0007 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631043204 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、购买单选商品3选1 或 造一笔 抖音/微店 订单（3选1）
- 2、预约成功了一个

**Then**：

- 查看后台拆单逻辑： 父订单为：已预约 子订单为：已预约

---

#### TC-HW-0008：[研学后台]导入订单，子订单拆分逻辑验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0008 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631043204 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、购买单选商品 或 造一笔 抖音/微店 订单（3选1）
- 2、操作预约成功、取消预约、已出行

**Then**：

- 预约成功后： 父订单为：已预约，子订单为：已预约 取消预约后： 父：待预约，子：待预约 已出行： 父：已出行，子：已出行

---

#### TC-HW-0009：[研学后台]导入订单，子订单拆分逻辑验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0009 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631043204 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、购买多选商品 或 造一笔 抖音/微店 订单（3选2）
- 2、部分子订单已出行

**Then**：

- 父订单为：待预约 子订单为：已出行

---

#### TC-HW-0010：[研学后台]导入订单，子订单拆分逻辑验证 - 场景6

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0010 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631043204 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、购买多选商品 或 造一笔 抖音/微店 订单（3选2 ）
- 2、全部子订单已出行

**Then**：

- 父订单为：已出行 子订单为：已出行

---

#### TC-HW-0011：[研学后台]导入订单，子订单拆分逻辑验证 - 场景7

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0011 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631043204 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、购买多选商品 或 造一笔 抖音/微店 订单（3选2）
- 2、全部子订单已预约

**Then**：

- 父订单为：已预约 子订单为：已预约

---

#### TC-HW-0012：[研学后台]导入订单，子订单拆分逻辑验证 - 场景8

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0012 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631043204 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、购买多选商品 或 造一笔 抖音/微店 订单（3选2）
- 2、预约了2次，
- 2、并且取消预约其中一个订单

**Then**：

- 父订单为：已预约->待预约 被取消预约的子订单为：已预约->待预约 未被取消预约的订单：已预约

---

#### TC-HW-0013：[研学后台]抖音、微店的CSV映射配置新增字段功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0013 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631094690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、进入渠道订单管理
- 2、点击CSV映射配置

**Then**：

- 新增系统字段 商品类型、平台手续费、达人佣金、达人uid 新增订单状态映射字段：待付款、支付成功、交易关闭、已退款、退款中、退款失败 新增服务状态映射字段：待预约、已预约、已出行

---

#### TC-HW-0014：[研学后台]抖音、微店的CSV映射配置新增字段功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0014 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631094690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、配置系统字段为A
- 2、配置CSV文件字段为B
- 3、导入 抖音/微店 订单

**Then**：

- 导入的数据按照：B=A来显示

---

#### TC-HW-0015：[研学后台]抖音、微店的CSV映射配置新增字段功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0015 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631094690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1. 点击[添加字段映射]
- 2. 选择一个系统字段（如“商品类型”）
- 3. 输入对应的CSV文件字段名
- 4. 点击保存

**Then**：

- 1、列表中新增一行映射

---

#### TC-HW-0016：[研学后台]抖音、微店的CSV映射配置新增字段功能验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0016 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631094690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1. 在“订单状态值映射”区域点击[添加状态映射]
- 2. 在“系统状态值”列选择“待付款”
- 3. 在“CSV文件状态值”输入框输入“待支付”
- 4. 点击保存

**Then**：

- 列表中新增一行状态映射，显示“待付款 -> 待支付”

---

#### TC-HW-0017：[研学后台]抖音、微店的CSV映射配置新增字段功能验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0017 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631094690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1. 在“订单状态值映射”区域点击[添加状态映射]
- 2. 在“系统状态值”列选择“待预约”
- 3. 在“CSV文件状态值”输入框输入“未预约”
- 4. 点击保存

**Then**：

- 列表中新增一行状态映射，显示“待预约 -> 未预约”

---

#### TC-HW-0018：[研学后台]抖音、微店的CSV映射配置新增字段功能验证 - 场景6

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0018 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631094690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、让业务在测试网配置最新的csv映射
- 2、验证

**Then**：

- 验证是否符合预期

---

#### TC-HW-0019：[研学后台]抖音、微店的CSV映射配置新增字段功能验证 - 场景7

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0019 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631094690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1. 在[导入渠道订单]页面选择文件
- 2. 点击导入

**Then**：

- 1. 导入成功 2. 数据根据映射规则正确解析并存入系统 3. 订单状态和服务状态根据映射正确转换

---

#### TC-HW-0020：[研学后台]抖音、微店的CSV映射配置新增字段功能验证 - 场景8

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0020 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631094690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、进入订单管理页
- 2、点击新增一个配置
- 3、点击删除

**Then**：

- 支持删除

---

#### TC-HW-0021：[研学后台]抖音、微店的CSV映射配置新增字段功能验证 - 场景9

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0021 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631094690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、进入订单管理页，已添加了配置映射关系
- 2、再次点击配置映射关系按钮
- 3、进入到配置映射关系页

**Then**：

- 信息回显 系统字段和csv文件状态值未填，不支持保存

---

#### TC-HW-0022：[研学后台]抖音、微店的CSV映射配置新增字段功能验证 - 场景10

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0022 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631094690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1. 为“必填”列勾选复选框
- 2. 尝试不填写对应的CSV文件字段

**Then**：

- 无法进行保存

---

#### TC-HW-0023：[研学后台]渠道订单管理新增筛选字段验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0023 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6630968690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、进入渠道订单管理
- 2、检测新增筛选字段

**Then**：

- [商品类型][退款时间][服务状态][订单状态]

---

#### TC-HW-0024：[研学后台]渠道订单管理新增筛选字段验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0024 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6630968690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、支持通过商品类型查询
- 2、选择 单日营、多日营

**Then**：

- 查询对应的商品

---

#### TC-HW-0025：[研学后台]渠道订单管理新增筛选字段验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0025 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6630968690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、设置退款时间

**Then**：

- 查看对应时间下的退款订单

---

#### TC-HW-0026：[研学后台]渠道订单管理新增筛选字段验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0026 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6630968690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、支持选择服务状态查询
- 2、选择 待预约、已预约、已出行

**Then**：

- 查询对应的服务状态的订单

---

#### TC-HW-0027：[研学后台]渠道订单管理新增筛选字段验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0027 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6630968690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- 1、支持选择订单状态查询
- 2、选择 待付款、支付成功、交易关闭、已退款、退款中、退款失败

**Then**：

- 查询对应的订单状态的订单

---

#### TC-HW-0028：研学后台-订单操作日志详情功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0028 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6449233128 |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon

**When**：

- 1、选择微店或抖音订单
- 2、操作订单修改订单状态后

**Then**：

- 操作日志新增一条日志 显示： 操作者、执行操作、操作时间、操作原因（显示无）

---

#### TC-HW-0029：研学后台-订单操作日志详情功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0029 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6449233128 |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon

**When**：

- 1、选择任意订单
- 2、操作退款，订单退款后

**Then**：

- 操作日志新增一条日志 显示： 操作者、执行操作、操作时间、操作原因（显示退款原因）

---

#### TC-HW-0030：研学后台-订单操作日志详情功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0030 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6449233128 |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon

**When**：

- 1、选择任意订单
- 2、操作修改手机号，修改成功后

**Then**：

- 操作日志新增一条日志 显示： 操作者、执行操作、操作时间、操作原因（显示无）

---

#### TC-HW-0031：研学后台-订单操作日志详情功能验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0031 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6449233128 |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon

**When**：

- 1、修改数据库，把A订单变为退款失败（找开发）
- 2、该订单操作按钮变为：转为已退款
- 3、操作“转为已退款”，修改成功后

**Then**：

- 操作日志新增一条日志 显示： 操作者、执行操作、操作时间、操作原因（显示退款原因）

---

#### TC-HW-0032：研学后台-同一类别中商品多次选择验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0032 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6442981884 |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon

**When**：

- 1、点击新增预约
- 2、输入课程预约信息
- 3、选择课程分类为：7选2的课程

**Then**：

- 每次只选一个课程，但最多只能选择2门课程，超过2门时，无法再继续约课 完成预约的课程，进入小程序预约记录/后台课程预约管理新增一条预约，筛选可查看到

---

#### TC-HW-0033：研学后台-同一类别中商品多次选择验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0033 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6442981884 |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon

**When**：

- 1、点击新增预约
- 2、输入课程预约信息
- 3、选择课程分类为：7选2的课程
- 4、已选择“A课程”
- 5、再次进入该课程分类

**Then**：

- 依然可以继续选择A课程
- 并支持预约成功

---

#### TC-HW-0034：研学后台-同一类别中商品多次选择验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0034 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6442981884 |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon

**When**：

- 1、7选2订单已预约2次
- 2、选择其中一次，取消预约了
- 3、再次进入到7选2课程预约页

**Then**：

- 可再次预约

---

#### TC-HW-0044：渠道订单管理-退款功能测试 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0044 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429841700 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 点击"操作退款"按钮
- 2. 检查弹窗内容

**Then**：

- 显示退款弹窗，包含订单编号、商品名称等字段

---

#### TC-HW-0045：渠道订单管理-退款功能测试 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0045 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429841700 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 在退款原因文本框输入
- 2. 测试输入限制

**Then**：

- 支持输入文本、数字、字母，限制200字符

---

#### TC-HW-0046：渠道订单管理-退款功能测试 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0046 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429841700 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 输入小于等于实付金额的退款金额
- 2. 点击确认退款

**Then**：

- 微信商户正常退款，操作成功

---

#### TC-HW-0047：渠道订单管理-退款功能测试 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0047 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429841700 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 输入大于实付金额的退款金额
- 2. 尝试确认退款

**Then**：

- 提示"退款金额不得大于实付金额"，阻止操作

---

#### TC-HW-0048：渠道订单管理-退款功能测试 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0048 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429841700 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 输入等于实付金额的退款金额
- 2. 点击确认退款

**Then**：

- 微信商户正常退款，操作成功

---

#### TC-HW-0049：渠道订单管理-退款功能测试 - 场景6

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0049 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429841700 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 输入0作为退款金额
- 2. 尝试确认退款

**Then**：

- 提示"退款金额必须大于0"

---

#### TC-HW-0050：渠道订单管理-退款功能测试 - 场景7

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0050 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429841700 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 点击已退款订单的"退款原因"按钮
- 2. 查看弹窗内容

**Then**：

- 显示退款原因详情、退款金额，可点击X关闭

---

#### TC-HW-0051：渠道订单管理-退款功能测试 - 场景8

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0051 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429841700 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 完成退款操作后
- 2. 检查订单状态

**Then**：

- 订单状态同步更新为已退款

---

#### TC-HW-0052：渠道订单管理-操作按钮权限和显示测试 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0052 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429973572 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 查看微店或抖音渠道的订单
- 2. 检查操作列

**Then**：

- 显示原有操作按钮（不变）

---

#### TC-HW-0053：渠道订单管理-操作按钮权限和显示测试 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0053 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429973572 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 查看小程序渠道的订单
- 2. 检查操作列

**Then**：

- 显示「修改手机号」「操作退款」「核销进度」

---

#### TC-HW-0054：渠道订单管理-操作按钮权限和显示测试 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0054 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429973572 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 使用无权限账号登录
- 2. 查看小程序订单

**Then**：

- 不显示"操作退款"按钮

---

#### TC-HW-0055：渠道订单管理-操作按钮权限和显示测试 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0055 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429973572 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 使用有权限账号登录
- 2. 查看小程序订单

**Then**：

- 显示"操作退款"按钮

---

#### TC-HW-0056：渠道订单管理-操作按钮权限和显示测试 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0056 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429973572 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 查看已退款的订单
- 2. 检查操作列

**Then**：

- "操作退款"按钮消失，显示"退款原因"按钮

---

#### TC-HW-0057：课程预约管理-预约合同推送入口操作 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0057 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429408856 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 查看推送合同状态为"需要"的课程预约页
- 2. 检查合同推送入口

**Then**：

- 页面显示合同推送入口

---

#### TC-HW-0058：课程预约管理-预约合同推送入口操作 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0058 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429408856 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 查看推送合同状态为"不需要"的课程预约页
- 2. 检查合同推送入口

**Then**：

- 页面不显示合同推送入口

---

#### TC-HW-0059：课程预约管理-预约合同推送入口操作 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0059 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429408856 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 修改课程的推送合同选项
- 2. 立即刷新预约页面
- 3. 检查合同推送入口

**Then**：

- 入口显示状态实时更新

---

#### TC-HW-0060：课程信息管理-新增功能操作-选择推送合同 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0060 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429630757 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 点击新增按钮
- 2. 在弹窗中选择"需要推送合同"
- 3. 填写其他必填信息后保存

**Then**：

- 课程创建成功，推送合同状态为"需要"

---

#### TC-HW-0061：课程信息管理-新增功能操作-选择推送合同 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0061 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429630757 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 点击新增按钮
- 2. 在弹窗中选择"不需要推送合同"
- 3. 填写其他必填信息后保存

**Then**：

- 课程创建成功，推送合同状态为"不需要"

---

#### TC-HW-0062：课程信息管理-新增功能操作-选择推送合同 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0062 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429630757 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- 1. 点击新增按钮
- 2. 不选择推送合同选项
- 3. 尝试保存

**Then**：

- 提示"请选择是否需要推送合同"，无法保存

---

#### TC-HW-0095：研学后台-课程管理-课程库存管理新建库存功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0095 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408724992 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 点击"新增选项"按钮
- 2. 查看弹窗内容

**Then**：

- 弹窗显示课程选择列表，包含单日和多日课程选项

---

#### TC-HW-0096：研学后台-课程管理-课程库存管理新建库存功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0096 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408724992 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 选择单日类型课程
- 2. 查看弹窗内容

**Then**：

- 显示单日课程特有的表单内容，包含红字提醒

---

#### TC-HW-0097：研学后台-课程管理-课程库存管理新建库存功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0097 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408724992 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 选择多日类型课程
- 2. 查看弹窗内容

**Then**：

- 显示多日课程特有的表单内容，包含日期范围和库存数量，包含红字提醒

---

#### TC-HW-0098：研学后台-课程管理-修改课程功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0098 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408803476 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 点击编辑课程
- 2. 修改课程名称、时间等信息
- 3. 保存更改

**Then**：

- 课程信息更新成功

---

#### TC-HW-0099：研学后台-课程管理-修改课程功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0099 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408803476 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 编辑现有课程
- 2. 尝试修改课程类型字段

**Then**：

- 课程类型字段为只读状态，无法修改

---

#### TC-HW-0100：研学后台-课程管理-修改课程功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0100 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408803476 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 编辑单日类型课程
- 2. 修改其他信息并保存

**Then**：

- 课程类型保持为"单日"，不会改变

---

#### TC-HW-0101：研学后台-课程管理-修改课程功能验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0101 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408803476 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 编辑多日类型课程
- 2. 修改其他信息并保存

**Then**：

- 课程类型保持为"多日"，不会改变

---

#### TC-HW-0102：研学后台-课程管理-课程信息管理新增功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0102 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408595057 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 点击"新增课程"按钮
- 2. 查看弹窗内容

**Then**：

- 弹窗包含课程类型选项，选项包括：单日、多日

---

#### TC-HW-0103：研学后台-课程管理-课程信息管理新增功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0103 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408595057 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- . 不选择课程类型
- 2. 尝试提交表单

**Then**：

- 提示"请选择课程类型"，阻止提交

---

#### TC-HW-0104：研学后台-课程管理-课程信息管理新增功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0104 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408595057 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 选择"多日"类型
- 2. 填写其他必填信息
- 3. 提交表单

**Then**：

- 课程创建成功，课程类型显示为"多日"

---

#### TC-HW-0105：研学后台-课程管理-课程信息管理新增功能验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0105 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408595057 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 选择"单日"类型
- 2. 填写其他必填信息
- 3. 提交表单

**Then**：

- 课程创建成功，课程类型显示为"单日"

---

#### TC-HW-0106：研学后台-商品管理-平台商品管理-编辑商品功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0106 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408582540 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 商品包含多个课程
- 2. 是否推送预约信息-预约选项选择"是"
- 3. 点击确定

**Then**：

- 提示"是否推送预约信息选项选择有误"，无法提交

---

#### TC-HW-0107：研学后台-商品管理-平台商品管理-编辑商品功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0107 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408582540 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 商品包含多个课程
- 2. 是否推送预约信息-预约选项选择"否"
- 3. 点击确定

**Then**：

- 进入小程序查看该订单，预定该订单 校验通过，进入支付页面

---

#### TC-HW-0108：研学后台-商品管理-平台商品管理-编辑商品功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0108 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408582540 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 商品仅包含一个多日营课程
- 2. 是否推送预约信息-预约选项选择"否"
- 3. 点击确定

**Then**：

- 提示"是否推送预约信息选项选择有误"，无法提交

---

#### TC-HW-0109：研学后台-商品管理-平台商品管理-编辑商品功能验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0109 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408582540 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 商品仅包含一个多日营课程
- 2. 是否推送预约信息-预约选项选择"是"
- 3. 点击确定

**Then**：

- 进入小程序查看该订单，预定该订单 校验通过，进入支付页面

---

#### TC-HW-0110：研学后台-商品管理-平台商品管理-编辑商品功能验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0110 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408582540 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1、在单日营类型商品，添加渠道商品
- 2、添加商品类型
- 3、添加课程

**Then**：

- 只支持添加单日营课程

---

#### TC-HW-0111：研学后台-商品管理-平台商品管理-编辑商品功能验证 - 场景6

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0111 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408582540 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1、在多日营类型商品，添加渠道商品
- 2、添加商品类型
- 3、添加课程

**Then**：

- 只支持添加多日营课程

---

#### TC-HW-0112：研学后台-商品管理-平台商品管理新增商品功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0112 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408489115 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 点击"新增商品"按钮
- 2. 查看弹窗内容

**Then**：

- 弹窗包含商品类别选项，选项包括：单日类型商品、多日类型商品

---

#### TC-HW-0113：研学后台-商品管理-平台商品管理新增商品功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0113 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408489115 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 不选择商品类别
- 2. 尝试提交表单

**Then**：

- 提示"请选择商品类别"，阻止提交

---

#### TC-HW-0114：研学后台-商品管理-平台商品管理新增商品功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0114 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408489115 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1. 选择"单日类型商品"
- 2. 填写其他必填信息
- 3. 提交表单

**Then**：

- 商品创建成功，商品类别显示为"单日类型商品"

---

#### TC-HW-0115：首页推荐位管理，数据一致性验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0115 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6345300581 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 配置商品后查看小程序页面

**Then**：

- 首页显示的商品与后台配置一致

---

#### TC-HW-0116：首页推荐位管理，数据一致性验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0116 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6345300581 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 后台调整商品顺序
- 2. 查看小程序首页

**Then**：

- 小程序推荐位实时更新

---

#### TC-HW-0117：首页推荐位管理，数据一致性验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0117 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6345300581 |

**Given**：

- 进入研学管理后台：

**When**：

- 1、已配置推荐商品
- 2、再次点击配置商品

**Then**：

- 显示已配置过的商品，并支持编辑
- 编辑保存后，小程序实时更新

---

#### TC-HW-0118：首页推荐位管理，已配置商品管理验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0118 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6345306591 |

**Given**：

- 进入研学管理后台：

**When**：

- 1、进入平台商品管理，新建一个小程序的商品管理
- 2、点击新建A商品，选择渠道为“小程序”的渠道商品，填写其他信息后
- 3、确认，点击A商品上架后
- 4、进入到首页商品推荐管理，选择任意分类推荐，点击配置商品
- 5、搜索A商品

**Then**：

- 可查看到A商品存在于可选商品列表中

---

#### TC-HW-0119：首页推荐位管理，已配置商品管理验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0119 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6345306591 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 添加3个商品到分类

**Then**：

- 已配置商品显示(3)

---

#### TC-HW-0120：首页推荐位管理，已配置商品管理验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0120 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6345306591 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 点击已配置商品的"删除"号

**Then**：

- 商品从已配置列表移除 商品计数减少1

---

#### TC-HW-0121：首页推荐位管理，已配置商品管理验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0121 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6345306591 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 移除所有已配置商品

**Then**：

- 显示"暂无配置商品"

---

#### TC-HW-0122：首页推荐位管理，已配置商品管理验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0122 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6345306591 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 配置多个商品
- 2. 调整已配置的商品顺序

**Then**：

- 商品按调整后的顺序排列（查看小程序该推荐位下的商品）

---

#### TC-HW-0123：首页推荐位管理，已配置商品管理验证 - 场景6

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0123 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6345306591 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 配置3个以上商品
- 2. 查看小程序首页（刷新）

**Then**：

- 前2个商品显示在首页推荐位

---

#### TC-HW-0124：首页推荐位管理，已配置商品管理验证 - 场景7

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0124 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6345306591 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 调整顺序后，点保存
- 2、刷新页面

**Then**：

- 商品顺序保持调整后的状态

---

#### TC-HW-0125：首页推荐位管理，已配置商品管理验证 - 场景8

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0125 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6345306591 |

**Given**：

- 进入研学管理后台：

**When**：

- 1、配置多个商品，取消按钮

**Then**：

- 放弃本次商品配置，数据不改变

---

#### TC-HW-0126：首页推荐位管理，配置商品功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0126 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6342862593 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 点击商品卡片"+"号，可选商品消失
- 2. 查看已配置区域

**Then**：

- 1. 商品添加到已配置列表 2. 计数从0变为1

---

#### TC-HW-0127：首页推荐位管理，配置商品功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0127 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6342862593 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 已有2个配置商品
- 2. 新增第3个商品

**Then**：

- 新增商品排在第三位 （商品数大于等于2位，所有新增商品都排第三位）

---

#### TC-HW-0128：首页推荐位管理，配置商品功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0128 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6342862593 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 已有1个配置商品
- 2. 新增第2个商品

**Then**：

- 新增商品排在第二位

---

#### TC-HW-0129：首页推荐位管理，上下架功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0129 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6342620763 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 新建分类后
- 2. 点击"上架"操作

**Then**：

- 1. 状态变为"上架" 2. 小程序页面显示该分类

---

#### TC-HW-0130：首页推荐位管理，上下架功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0130 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6342620763 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 对已上架分类点击"下架"
- 2. 查看小程序页面（刷新）

**Then**：

- 1. 状态变为"下架" 2. 小程序页面不再显示

---

#### TC-HW-0131：首页推荐位管理，点击新建分类功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0131 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6342291364 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 点击"新建分类"按钮
- 2. 输入分类名称"北京本地单日营"
- 3. 上传icon图标
- 4. 设置排序值1
- 5. 点击"确定"

**Then**：

- 1. 新建成功 2. 分类默认下架状态 3. 关联商品数量显示0 4. 列表显示新分类 5、更新时间、修改人显示正常

---

#### TC-HW-0132：首页推荐位管理，点击新建分类功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0132 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6342291364 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 新建两个分类：A(排序1)、B(排序2)
- 2. 查看分类列表

**Then**：

- A排在B前面 小程序显示A排在B前面

---

#### TC-HW-0133：首页推荐位管理，点击新建分类功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0133 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学管理后台： |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6342291364 |

**Given**：

- 进入研学管理后台：

**When**：

- 1. 不填分类名称直接保存
- 2. 不选择icon直接保存

**Then**：

- 分类名称、icon、排序都必填，才可保存

---

#### TC-HW-0134：课程预约管理-推送合同功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0134 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6169046396 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入课程预约管理页，已预约状态的课程预约记录

**Then**：

- 操作栏新增 推送合同 功能

---

#### TC-HW-0135：课程预约管理-推送合同功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0135 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6169046396 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入课程预约管理页，并且预约了多个课程
- 2、选择一条“已预约”状态的课程预约信息后
- 3、点击推送合同

**Then**：

- 弹出二次确认弹窗： 请确认合同信息！ 家长姓名 家长手机号 孩子姓名 身份证号 营期活动时间 参营费用 大写人民币 付款时间 费用 点击确定，在合同列表新增该数据，并自动给对应家长手机号发 合同文件短信 点击取消，隐藏弹窗 以上的信息对应“合同列表”和“合同文件”字段

---

#### TC-HW-0136：课程预约管理-推送合同功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0136 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6169046396 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入课程预约管理页，并且预约了多个课程
- 2、选择一条“已完成”，“已取消”状态的课程预约信息后

**Then**：

- 无推送合同按钮

---

#### TC-HW-0137：课程预约管理-推送合同功能验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0137 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6169046396 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入课程预约管理页，并且预约了多个课程
- 2、选择一条“已预约”状态的课程预约信息后
- 3、点击推送合同，显示二次确认弹窗
- 4、点击确定，弹窗消失，合同列表显示为“已推送”状态
- 5、再次点击推送合同

**Then**：

- 推送合同按钮置灰，无法推送

---

#### TC-HW-0138：课程预约管理-修改验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0138 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6152752773 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、选择一个存在的课程预约管理
- 2、点击修改

**Then**：

- 1、信息回显 2、课程名称不允许修改，课程日期不允许修改到之前日期和无库存的 3、点击确定，保存成功，更新时间更新，信息内容修改更新，进入到公众号查看显示一致 4、点击取消，不做处理

---

#### TC-HW-0139：课程预约管理-修改验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0139 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6152752773 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、研学公众号 新增的预约后
- 2、查看 课程预约管理列表顺序

**Then**：

- 按照更新时间，最新的显示在最上面

---

#### TC-HW-0140：研学-合同模版页新建模版多日营选择功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0140 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6116273667 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- 1、点击新建模版
- 2、显示新建弹窗
- 3、选择“单日营” or “多日营”
- 4、其他信息填写完整后
- 5、点击确定

**Then**：

- 新增模版数据成功
- 如果选择的是 单日营，新增的数据类别均为：单日营
- 如果选择的是 多日营，新增的数据类别均为：多日营

---

#### TC-HW-0141：订单管理-订单状态验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0141 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6048100444 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、使用抖音和微店的订单csv文件
- 2、csv文件中状态存在未核销、待发货、已发货、已完成
- 3、进行导入

**Then**：

- 导入成功后 订单管理中状态显示：待预约，该状态同步到 公众号与公众号一致
- 公众号显示：待预约

---

#### TC-HW-0142：订单管理-订单状态验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0142 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6048100444 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、使用抖音和微店的订单csv文件
- 2、csv文件中状态存在已核销
- 3、进行导入

**Then**：

- 导入成功后 订单管理中状态显示：已预约，该状态同步到 公众号与公众号一致
- 公众号：已预约

---

#### TC-HW-0143：订单管理-订单状态验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0143 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6048100444 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、使用抖音和微店的订单csv文件
- 2、csv文件中状态存在已退款
- 3、进行导入

**Then**：

- 导入成功后，且将相同商品Id状态为已预约更新为已退款 订单管理中状态显示：已退款，该状态同步到 公众号与公众号一致
- 公众号：已退款

---

#### TC-HW-0144：订单管理-订单状态验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0144 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6048100444 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、造数据，在csv文件中，添加一条未核销数据（5选2商品关联csv文件中该订单的商品ID）
- 2、然后公众号预约1次该订单

**Then**：

- 该订单状态变为：已预约 如果预约的课程已到期后，课程自动变为已核销（前端显示已预约）

---

#### TC-HW-0145：订单管理-订单状态验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0145 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6048100444 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、造数据，在csv文件中，添加一条未核销数据（5选2商品关联csv文件中该订单的商品ID）
- 2、公众号预约2次
- 3、且课程已过期

**Then**：

- 订单状态变为：已完成

---

#### TC-HW-0146：订单管理-订单状态验证 - 场景6

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0146 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6048100444 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、研学公众号预约一个课程，等待该课程时间到期后

**Then**：

- 自动核销
- 查看订单管理后台该订单变为：已完成状态 公众号该订单状态变为：已完成状态

---

#### TC-HW-0147：商品管理-修改、上架、下架、复制验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0147 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6076898478 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、点击修改
- 2、已存在商品管理数据，进入到修改弹窗页
- 3、选择一个商品信息，进行修改
- 4、点击确定

**Then**：

- 信息回显 修改成功后 数据更新成功 更新时间发生改变

---

#### TC-HW-0148：商品管理-修改、上架、下架、复制验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0148 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6076898478 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、渠道商品管理中已存在商品管理数据
- 2、点击上架

**Then**：

- 显示二次确认上架弹窗： 点击确定： 渠道商品变为：已上架状态 进入 研学公众号-预约页查看显示信息是否一致 如： 1、商品名称：对应 公众号的 商品名称 2、主图：对应 公众号的 商品的轮播图 3、详情图：对应 公众号的 商品图片详情 4、售价：对应 公众号的 商品售价 5、商品内容-商品类别：对应 公众号的 课程包的名称 6、商品内容-课程：对应 公众号的 课程包下的课程名称 7、预约规则：对应 公众号的 预约规则信息 点击取消，不做其他操作

---

#### TC-HW-0149：商品管理-修改、上架、下架、复制验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0149 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6076898478 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、渠道商品管理中已存在商品管理数据
- 2、点击下架

**Then**：

- 显示二次确认下架弹窗： 点击确认，直接下架成功，渠道商品变为：待上架状态
- 查看公众号中的订单信息展示正常 点击取消，不做其他操作

---

#### TC-HW-0150：商品管理-修改、上架、下架、复制验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0150 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6076898478 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、已存在商品管理数据
- 2、点击复制

**Then**：

- 除渠道+渠道商品ID不回显示，其他信息自动回显信息 支持修改 点击确定，复制成功，对比信息一致

---

#### TC-HW-0151：商品管理-新增验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0151 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6058951144 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入到平台商品管理页
- 2、点击新增，显示新增弹窗
- 3、输入商品名称
- 4、点击确定

**Then**：

- 新增成功 更新时间与最后编辑人与当时创建的保持一致

---

#### TC-HW-0152：商品管理-新增验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0152 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6058951144 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入到平台商品管理页
- 2、点击新增，显示新增弹窗
- 3、输入相同商品名称
- 4、点击确定

**Then**：

- 不支持保存 提示：已存在相同商品

---

#### TC-HW-0153：商品管理-新增验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0153 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6058951144 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入到平台商品管理，选择一个商品名称，点击查看
- 2、进入到“渠道商品管理”当前商品的详情页，点击新增按钮
- 3、输入渠道（下拉列表展示）、商品ID（业务进行填写，需要与订单里的商品ID一致）、主图、详情图、售价、商品内容、预约规则
- 4、点击确定

**Then**：

- 新增成功后，默认为：未上架状态，销量数量跟随订单管理的数量一致

---

#### TC-HW-0154：商品管理-新增验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0154 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6058951144 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入到平台商品管理页，选择一个商品名称，点击查看
- 2、进入到当前渠道商品的详情页
- 3、点击页面，返回按钮

**Then**：

- 返回到商品管理页

---

#### TC-HW-0155：商品管理-新增验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0155 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6058951144 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入到平台商品管理页，选择一个商品名称，点击查看
- 2、进入到当前渠道商品的详情页
- 3、点击添加商品，输入的商品ID与订单管理里的商品ID不一致

**Then**：

- 支持添加
- 但不与订单管理中关联

---

#### TC-HW-0156：商品管理-新增验证 - 场景6

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0156 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6058951144 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入到平台商品管理页，选择一个商品名称，点击查看
- 2、进入到当前渠道商品的详情页
- 3、点击添加商品，输入渠道（下拉列表展示）、商品ID（业务进行填写，需要与订单里的商品ID一致）、主图、详情图、售价、商品内容、预约规则
- 4、存在未填信息

**Then**：

- 均必填， 未填，则无法保存

---

#### TC-HW-0157：商品管理-新增验证 - 场景7

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0157 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6058951144 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入到平台商品管理页，选择一个商品名称，点击查看
- 2、进入到当前渠道商品的详情页
- 3、点击添加渠道商品，显示弹窗
- 4、点击添加多个商品类别

**Then**：

- 1、支持添加多个商品类别 2、支持点击删除商品类别 3、商品类别名称：字数限制10个 4、类别名称，不允许相同

---

#### TC-HW-0158：商品管理-新增验证 - 场景8

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0158 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6058951144 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入到平台商品管理页，选择一个商品名称，点击查看
- 2、进入到当前渠道商品的详情页
- 3、点击添加渠道商品，显示弹窗
- 4、点击添加商品类别，添加输入课程名称

**Then**：

- 1、类别选择数量只允许整数 2、每个类别中支持添加多个课程，支持删除课程

---

#### TC-HW-0159：订单管理-导入、导出功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0159 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6074384533 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、点击导入

**Then**：

- 弹出导入弹窗

---

#### TC-HW-0160：订单管理-导入、导出功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0160 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6074384533 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 2、点击上传csv文件
- 3、选择渠道 抖音 or 微店（下拉列表）
- 4、点击确定

**Then**：

- 导入成功 选择的渠道为抖音 or 微店 对应 订单管理列表中的购买渠道

---

#### TC-HW-0161：订单管理-导入、导出功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0161 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6074384533 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 2、点击上传抖音csv文件
- 3、选择渠道的是 微店（下拉列表）
- 4、点击确定

**Then**：

- 提示：渠道错误，无法导入

---

#### TC-HW-0162：订单管理-导入、导出功能验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0162 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6074384533 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、已导入数据后
- 2、查看对比 公众号的数据是否一致

**Then**：

- 其他与csv字段对应： 1、购买平台：明确抖音或微店等具体购买渠道 2、订单金额： 抖音平台：对应「订单实收」字段 微店平台：对应「实付金额」字段 3、联系方式： 抖音平台：对应「联系方式」字段 微店平台：对应「下单账号」字段 4、支付时间：订单实际支付完成时间 5、商品ID 与公众号关联字段： 1、订单编号：对应公众号的订单号 2、商品名称：对应公众号的 课程名称 3、订单金额：对应公众号的 价格 4、预约主题：对应公众号的 主题和研学小包 5、订单状态：对应公众号的 订单状态

---

#### TC-HW-0163：订单管理-导入、导出功能验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0163 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6074384533 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、导入的csv文件中存在多条重复数据（根据订单编号去重）、字段为空、不符合的字段
- 2、点击导入该csv文件

**Then**：

- 不支持存在重复订单编号

---

#### TC-HW-0164：订单管理-导入、导出功能验证 - 场景6

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0164 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6074384533 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、导入除csv文件外后缀格式文件

**Then**：

- 无法导入，置灰状态

---

#### TC-HW-0165：订单管理-导入、导出功能验证 - 场景7

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0165 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6074384533 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、点击导出

**Then**：

- 导出筛选项相关的订单管理数据

---

#### TC-HW-0166：课程库存管理-新增、上架、下架验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0166 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5999102656 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、点击新增

**Then**：

- 显示新增弹窗

---

#### TC-HW-0167：课程库存管理-新增、上架、下架验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0167 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5999102656 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、点击新增
- 2、输入课程名称（对应课程信息里的课程名称，下拉选项）、课程时间、课程日期、每日最大库存
- 3、点击确定

**Then**：

- 生成对应记录，默认为：未上架 注：如果课程名称和课程时间段、课程日期相同 则新增失败

---

#### TC-HW-0168：课程库存管理-新增、上架、下架验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0168 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5999102656 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、输入课程时间时
- 2、点击+号

**Then**：

- 支持新增多个时间段，且只支持最多5个时间段，超过无法添加 并且，课程时间段至少有一个时间段，否则无法保存

---

#### TC-HW-0169：课程库存管理-新增、上架、下架验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0169 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5999102656 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、输入的课程时间，多个课程时间
- 2、点击确定

**Then**：

- 生成多条数据，一个课程时间生成一条数据

---

#### TC-HW-0170：课程库存管理-新增、上架、下架验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0170 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5999102656 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、新增成功后

**Then**：

- 课程库存数据按照课程日期排序最新的显示在最上面

---

#### TC-HW-0171：课程库存管理-新增、上架、下架验证 - 场景6

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0171 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5999102656 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、存在课程库存信息
- 2、勾选指定课程库存信息
- 3、点击上架 / 下架

**Then**：

- 上架后，进入公众号查看指定的上架的课程是否正常，剩余数量发生变化，数量增加 点击下架后， 如果公众号存在已预约的课程，则无法下架 如果公众号不存在已预约的课程，下架成功，进入公众号查看指定的下架课程是否正常，剩余数量发生变化，数量减少

---

#### TC-HW-0172：课程库存管理-新增、上架、下架验证 - 场景7

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0172 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5999102656 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、存在课程库存信息
- 2、勾选指定课程库存信息
- 3、点击上架 / 下架

**Then**：

- 支持批量上架 和 下架

---

#### TC-HW-0173：课程库存管理-新增、上架、下架验证 - 场景8

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0173 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5999102656 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入 新增弹窗
- 2、输入课程名称（对应课程信息里的课程名称，下拉选项）、课程时间、课程日期、每日最大库存
- 3、存在未填情况，点击确定

**Then**：

- 都必填，没填的无法保存

---

#### TC-HW-0174：课程信息管理-修改、上架、下架状态功能验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0174 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5996912396 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、选择一条未上架的数据
- 2、点击上架

**Then**：

- 显示上架确定弹窗 点击确定： 如果课程暂无库存，则上架失败，点击弹窗的跳转到课程库存管理页 如果课程有库存，则上架成功 点击取消：不做处理

---

#### TC-HW-0175：课程信息管理-修改、上架、下架状态功能验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0175 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5996912396 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、选择一条数据
- 2、点击修改

**Then**：

- 显示修改弹窗 信息回显 修改 课程名称、价格、主图、详情图 点击确定，保存成功 点击取消：不做处理 课程信息管理列表更新时间更新

---

#### TC-HW-0176：课程信息管理-修改、上架、下架状态功能验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0176 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5996912396 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、选择一条已上架的数据
- 2、点击下架

**Then**：

- 显示下架确定弹窗 点击确定： 如果上架的商品（商品管理页）里存在该课程，就无法下架 如果上架的商品（商品管理页）里存在该课程，提示下架成功，该课程无法预约 点击取消：不做处理

---

#### TC-HW-0177：课程信息管理-新增验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0177 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5996599327 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、点击新建按钮

**Then**：

- 显示新建弹窗

---

#### TC-HW-0178：课程信息管理-新增验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0178 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5996599327 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 2、输入课程名称、价格
- 3、上传 主图、详情图
- 4、点击确定

**Then**：

- 新增一条数据到 课程信息管理页，并且与上传的信息一致 创建时间与更新时间一致 编辑人与账号对应 状态默认：未上架

---

#### TC-HW-0179：课程信息管理-新增验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0179 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5996599327 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、新增成功后，默认为未上架状态
- 2、数据为未上架状态

**Then**：

- 未上架的课程不显示在预约界面

---

#### TC-HW-0180：课程信息管理-新增验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0180 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5996599327 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、新增成功后
- 2、排序检查

**Then**：

- 通过更新时间进行排序，最新的显示在最上面

---

#### TC-HW-0181：课程信息管理-新增验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0181 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5996599327 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、新增成功后，并且状态为 已上架状态
- 2、对应公众号的课程详情显示检查

**Then**：

- 1、课程名称：对应公众号的课程名称 2、主图：对应公众号的轮播图 3、详情图：对应公众号的详情图 4、价格：对应公众号的价格

---

#### TC-HW-0182：课程信息管理-新增验证 - 场景6

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0182 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5996599327 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- 1、进入 新增弹窗
- 2、输入课程名称、价格
- 3、上传 主图、详情图
- 4、存在数据未填情况，点击确定

**Then**：

- 课程名称必填，不填无法保存 价格、主图、详情图选填

---

#### TC-HW-0183：合同列表-搜索、查看合同、导入、导出验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0183 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982305575 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、点击导入

**Then**：

- 弹出导入弹出 显示： 1、导入用户信息 2、已上传 状态

---

#### TC-HW-0184：合同列表-搜索、查看合同、导入、导出验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0184 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982305575 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、点击导入
- 2、点击 导入用户信息
- 3、已上传 用户信息后
- 4、点击确定

**Then**：

- 保存成功后 等待合同记录生成后，给对应用户信息里的用户手机号发送短信通知 收到短信后，查看短信内容链接对应合同链接

---

#### TC-HW-0185：合同列表-搜索、查看合同、导入、导出验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0185 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982305575 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、点击导入
- 2、点击 导入用户信息
- 3、已上传 用户信息后
- 4、点击确定
- 5、导入成功后
- 6、状态显示规则

**Then**：

- 合同列表中的合同状态规则： 状态分为：跟E签宝对比保持一致

---

#### TC-HW-0186：合同列表-搜索、查看合同、导入、导出验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0186 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982305575 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、点击导入
- 2、选择A文件导入（按照身份证、主题、营期相同去重）
- 3、导入成功后
- 4、再次导入A文件

**Then**：

- 不会出现重复的身份证、主题、营期数据（去重）

---

#### TC-HW-0187：合同列表-搜索、查看合同、导入、导出验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0187 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982305575 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、点击导出
- 2、点击 导出用户信息

**Then**：

- 浏览器下载csv文件 打开csv文件，内容与合同列表一致

---

#### TC-HW-0188：合同列表-搜索、查看合同、导入、导出验证 - 场景6

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0188 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982305575 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、存在合同列表数据
- 2、选择一条合同列表数据
- 3、查看合同链接

**Then**：

- 直接显示合同链接，复制该链接后，可以正常打开

---

#### TC-HW-0189：合同列表-搜索、查看合同、导入、导出验证 - 场景7

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0189 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982305575 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、顶部搜索栏，输入孩子姓名、家长电话、主题、合同状态、营期开始日期

**Then**：

- 不支持模糊搜索 点击重置清空所有筛选条件

---

#### TC-HW-0190：合同列表-搜索、查看合同、导入、导出验证 - 场景8

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0190 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982305575 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、页面存在分页功能

**Then**：

- 1-所有数据按照录入时间倒序排列 2-默认单页显示 20条/页，支持切换10条/页，50条/页，100条/页

---

#### TC-HW-0191：模版管理-新建模版验证 - 场景1

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0191 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982212744 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、进入到合同模版页后
- 2、点击新建模版

**Then**：

- 弹出新建模版弹窗 弹窗内容： 1、研学主题 2、上传合同文档 3、已上传-文件

---

#### TC-HW-0192：模版管理-新建模版验证 - 场景2

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0192 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982212744 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、进入到合同模版页后
- 2、点击新建模版
- 3、输入研学主题
- 4、点击上传合同文档

**Then**：

- 等待1分钟左右 显示： 已上传显示文件名称+移除按钮

---

#### TC-HW-0193：模版管理-新建模版验证 - 场景3

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0193 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982212744 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、进入到合同模版页后
- 2、点击新建模版
- 3、输入研学主题
- 4、点击上传合同文档
- 5、点击已上传文件旁边x

**Then**：

- 移除已上传到文件 再次点击上传合同文档时，可继续上传合同文档

---

#### TC-HW-0194：模版管理-新建模版验证 - 场景4

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0194 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982212744 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、进入到合同模版页后
- 2、点击新建模版
- 3、输入研学主题
- 4、点击上传合同文档
- 5、点击确定

**Then**：

- 保存成功至合同模版列表 并且状态默认为：启用

---

#### TC-HW-0195：模版管理-新建模版验证 - 场景5

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-HW-0195 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 打开洋葱研学管理后台 |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5982212744 |

**Given**：

- 打开洋葱研学管理后台

**When**：

- 1、进入到合同模版页后
- 2、点击新建模版
- 3、输入研学主题
- 4、点击上传合同文档
- 5、点击取消

**Then**：

- 不做任何保存，隐藏弹窗

---
