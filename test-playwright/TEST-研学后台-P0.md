# 测试文档

---

## 第二部分：测试用例

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


#### TC-yanxue-001：订单管理页面新增结算时间字段显示

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-001                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1. 登录管理后台 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1. 登录管理后台

**When**：

- 1. 查看订单列表

**Then**：

- 订单列表显示"结算时间"列，字段值正确显示

---

#### TC-yanxue-002：抖音订单结算时间计算(核销时间+5)，通过csv导入到渠道订单管理 - 1. 抖音订单履约出行日期：2026-03-05 › 1. 查看订单结算时间

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-002                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1. 抖音订单履约出行日期：2026-03-05 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1. 抖音订单履约出行日期：2026-03-05

**When**：

- 1. 查看订单结算时间

**Then**：

- 结算时间 = 2026-03-10 00:00:00

---

#### TC-yanxue-003：抖音订单结算时间计算(核销时间+5)，通过csv导入到渠道订单管理 - 1. 抖音订单履约出行日期：2026-03-28 › 1. 查看订单结算时间

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-003                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1. 抖音订单履约出行日期：2026-03-28 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1. 抖音订单履约出行日期：2026-03-28

**When**：

- 1. 查看订单结算时间

**Then**：

- 结算时间 = 2026-04-02 00:00:00

---

#### TC-yanxue-004：抖音订单结算时间计算(核销时间+5)，通过csv导入到渠道订单管理 - 1. 抖音订单未核销 › 1. 查看订单结算时间

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-004                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1. 抖音订单未核销 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1. 抖音订单未核销

**When**：

- 1. 查看订单结算时间

**Then**：

- 结算时间显示为空或默认值

---

#### TC-yanxue-005：小程序订单结算时间计算(T+1)，通过csv导入到渠道订单管理 - 1. 小程序订单交易时间：2026-03-05 14:30:00 › 1. 查看订单结算时间

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-005                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1. 小程序订单交易时间：2026-03-05 14:30:00 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1. 小程序订单交易时间：2026-03-05 14:30:00

**When**：

- 1. 查看订单结算时间

**Then**：

- 结算时间 = 2026-03-06 00:00:00

---

#### TC-yanxue-006：小程序订单结算时间计算(T+1)，通过csv导入到渠道订单管理 - 1. 小程序订单交易时间：2026-03-31 23:59:59 › 1. 查看订单结算时间

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-006                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1. 小程序订单交易时间：2026-03-31 23:59:59 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1. 小程序订单交易时间：2026-03-31 23:59:59

**When**：

- 1. 查看订单结算时间

**Then**：

- 结算时间 = 2026-04-01 00:00:00

---

#### TC-yanxue-007：【研学后台】渠道订单管理-修改手机号验证 - 1、进入研学后台测试网 2、进入到渠道订单管理 › 1、选择一个订单服务状态为：待预约 or 已预约 进行修改

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-007                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台测试网；2、进入到渠道订单管理 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台测试网
- 2、进入到渠道订单管理

**When**：

- 1、选择一个订单服务状态为：待预约 or 已预约 进行修改

**Then**：

- 支持修改手机号

---

#### TC-yanxue-008：【研学后台】渠道订单管理-修改手机号验证 - 1、进入研学后台测试网 2、进入到渠道订单管理 › 1、选择一个服务状态为已出行订单

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-008                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台测试网；2、进入到渠道订单管理 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台测试网
- 2、进入到渠道订单管理

**When**：

- 1、选择一个服务状态为已出行订单

**Then**：

- 不支持修改手机号

---

#### TC-yanxue-009：【研学后台】编辑商品协议验证 - 1. 登陆研学后台 2、进入 平台商品管理 › 1. 选择任意商品，点击查看，点击编辑。 2. 在弹窗中，输入合法的“协议名称”（如：储蓄卡专用协议）和有效的“协议链接”。 3. 点击确定。

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-009                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1. 登陆研学后台；2、进入 平台商品管理 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1. 登陆研学后台
- 2、进入 平台商品管理

**When**：

- 1. 选择任意商品，点击查看，点击编辑。
- 2. 在弹窗中，输入合法的“协议名称”（如：储蓄卡专用协议）和有效的“协议链接”。
- 3. 点击确定。

**Then**：

- 1. 弹窗关闭，页面提示“创建成功”。

---

#### TC-yanxue-010：【研学后台】编辑商品协议验证 - 1. 登陆研学后台 2、进入 平台商品管理 › 1. 选择任意商品，点击查看，点击编辑。 2. 在协议链接输入框中，输入“非URL格式的字符串”。 3. 点击确定。

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-010                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1. 登陆研学后台；2、进入 平台商品管理 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1. 登陆研学后台
- 2、进入 平台商品管理

**When**：

- 1. 选择任意商品，点击查看，点击编辑。
- 2. 在协议链接输入框中，输入“非URL格式的字符串”。
- 3. 点击确定。

**Then**：

- 1. 弹窗不关闭。
- 2. 协议链接输入框下方提示“请输入有效的URL链接”。

---

#### TC-yanxue-011：研学后台-商品标签管理验证

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-011                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、网络正常

**When**：

- 1. 使用管理员账号登录后台。
- 2. 进入某商品的编辑页面。
- 3. 在“商品标签1”输入框输入“推荐”。
- 4. “商品标签2”留空。
- 5. 点击保存。

**Then**：

- 1. 保存成功提示。
- 2. 退出后重新进入编辑页，标签1内容为“推荐”，标签2为空。
- 3. 小程序前端该商品价格右侧显示“推荐”标签。

---

#### TC-yanxue-012：研学后台-首页推荐管理勾选验证 - 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel 2、网络正常 › 1. 后台有超过8个有效商品。 2. 进入“首页推荐管理”-“配置商品”。 3. 勾选8个…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-012                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、网络正常

**When**：

- 1. 后台有超过8个有效商品。
- 2. 进入“首页推荐管理”-“配置商品”。
- 3. 勾选8个不同的商品。
- 4. 保存配置。

**Then**：

- 1. 勾选计数器显示“数量”。
- 2. 保存成功。
- 3. 小程序首页轮播或推荐位准确展示这8个商品，顺序与勾选顺序一致。

---

#### TC-yanxue-013：研学后台-首页推荐管理勾选验证 - 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel 2、网络正常 › 1. 已勾选8个商品。 2. 尝试勾选第9个商品的复选框。

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-013                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、网络正常

**When**：

- 1. 已勾选8个商品。
- 2. 尝试勾选第9个商品的复选框。

**Then**：

- 1. 第9个商品的复选框无法被勾选，或勾选后自动取消并提示“最多选择8个商品”。

---

#### TC-yanxue-014：研学后台-商品配置多选一推送规则验证 - 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel 2、网络正常 › 1. 创建一个小程序渠道的商品，仅包含1个课程。 2. 在商品发布/编辑页面，找到“推送预…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-014                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、网络正常

**When**：

- 1. 创建一个小程序渠道的商品，仅包含1个课程。
- 2. 在商品发布/编辑页面，找到“推送预约”选项。

**Then**：

- 1. “推送预约”复选框可被勾选。
- 2. 勾选后保存成功。

---

#### TC-yanxue-015：研学后台-商品配置多选一推送规则验证 - 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel 2、网络正常 › 1. 创建一个小程序渠道的商品，包含2个课程。 2. 在商品发布/编辑页面。

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-015                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、网络正常

**When**：

- 1. 创建一个小程序渠道的商品，包含2个课程。
- 2. 在商品发布/编辑页面。

**Then**：

- 1. “推送预约”复选框置灰不可选，或隐藏。
- 2. 其下方或附近显示提示文案：“这是一个包含多个课程且数量大于1的商品，推送预约信息选项应该选择否”。

---

#### TC-yanxue-016：研学后台-商品配置多选一推送规则验证 - 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel 2、网络正常 › 1. 创建一个非小程序渠道（如抖音、微店）的商品，包含多个课程。 2. 在商品发布/编辑页…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-016                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、网络正常

**When**：

- 1. 创建一个非小程序渠道（如抖音、微店）的商品，包含多个课程。
- 2. 在商品发布/编辑页面。

**Then**：

- 1. “推送预约”选项的可用性遵循原有规则，不受本次新规则影响。

---

#### TC-yanxue-017：【研学后台】渠道订单管理新增筛选字段验证 - 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel 2、进入研学后台 › 1、进入渠道订单管理 2、检测新增筛选字段

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-017                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、进入研学后台 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、进入研学后台

**When**：

- 1、进入渠道订单管理
- 2、检测新增筛选字段

**Then**：

- 【商品类型】【退款时间】【服务状态】【订单状态】

---

#### TC-yanxue-018：【研学后台】渠道订单管理新增筛选字段验证 - 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel 2、进入研学后台 › 1、支持通过商品类型查询 2、选择 单日营、多日营

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-018                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、进入研学后台 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、进入研学后台

**When**：

- 1、支持通过商品类型查询
- 2、选择 单日营、多日营

**Then**：

- 查询对应的商品

---

#### TC-yanxue-019：【研学后台】渠道订单管理新增筛选字段验证 - 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel 2、进入研学后台 › 1、设置退款时间

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-019                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、进入研学后台 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、进入研学后台

**When**：

- 1、设置退款时间

**Then**：

- 查看对应时间下的退款订单

---

#### TC-yanxue-020：【研学后台】渠道订单管理新增筛选字段验证 - 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel 2、进入研学后台 › 1、支持选择服务状态查询 2、选择 待预约、已预约、已出行

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-020                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、进入研学后台 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、进入研学后台

**When**：

- 1、支持选择服务状态查询
- 2、选择 待预约、已预约、已出行

**Then**：

- 查询对应的服务状态的订单

---

#### TC-yanxue-021：【研学后台】渠道订单管理新增筛选字段验证 - 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel 2、进入研学后台 › 1、支持选择订单状态查询 2、选择 待付款、支付成功、交易关闭、已退款、退款中、退…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-021                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、进入研学后台 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、进入研学后台

**When**：

- 1、支持选择订单状态查询
- 2、选择 待付款、支付成功、交易关闭、已退款、退款中、退款失败

**Then**：

- 查询对应的订单状态的订单

---

#### TC-yanxue-022：【研学后台】课程预约管理，点击添加课程预约，身份证为选填项

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-022                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel；2、进入研学后台 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel
- 2、进入研学后台
- 3、点击进入课程预约管理

**When**：

- 1、添加课程预约
- 2、不输入课程预约中身份证

**Then**：

- 也可以添加课程预约成功

---

#### TC-yanxue-023：研学后台-同一类别中商品多次选择验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 课程管理-课程预约管理 › 1、点击新增预约 2、输入课程预约信息…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-023                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 课程管理-课程预约管理

**When**：

- 1、点击新增预约
- 2、输入课程预约信息
- 3、选择课程分类为：7选2的课程

**Then**：

- 每次只选一个课程，但最多只能选择2门课程，超过2门时，无法再继续约课
- 完成预约的课程，进入小程序预约记录/后台课程预约管理新增一条预约，筛选可查看到

---

#### TC-yanxue-024：研学后台-同一类别中商品多次选择验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 课程管理-课程预约管理 › 1、点击新增预约 2、输入课程预约信息…（2）

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-024                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 课程管理-课程预约管理

**When**：

- 1、点击新增预约
- 2、输入课程预约信息
- 3、选择课程分类为：7选2的课程
- 4、已选择“A课程”
- 5、再次进入该课程分类

**Then**：

- 依然可以继续选择A课程。并支持预约成功

---

#### TC-yanxue-025：研学后台-同一类别中商品多次选择验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 课程管理-课程预约管理 › 1、7选2订单已预约2次 2、选择其中…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-025                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 课程管理-课程预约管理

**When**：

- 1、7选2订单已预约2次
- 2、选择其中一次，取消预约了
- 3、再次进入到7选2课程预约页

**Then**：

- 可再次预约

---

#### TC-yanxue-026：研学后台-新增多日营课程预约功能验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 课程管理-课程预约管理 › 1、点击新增预约 2、点击输入手机号 …

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-026                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 课程管理-课程预约管理

**When**：

- 1、点击新增预约
- 2、点击输入手机号
- 3、选择“多日营”类型商品

**Then**：

- 不显示课程时段

---

#### TC-yanxue-027：研学后台-新增多日营课程预约功能验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 课程管理-课程预约管理 › 1、点击新增预约 2、点击输入手机号 …（2）

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-027                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 课程管理-课程预约管理

**When**：

- 1、点击新增预约
- 2、点击输入手机号
- 3、选择“多日营”类型商品
- 4、点击课程日期

**Then**：

- 支持选择日期-日期段

---

#### TC-yanxue-028：研学后台-新增多日营课程预约功能验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 课程管理-课程预约管理 › 1、点击新增预约 2、点击输入手机号 …（3）

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-028                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 课程管理-课程预约管理

**When**：

- 1、点击新增预约
- 2、点击输入手机号
- 3、选择“多日营”类型商品
- 4、填写完所有必要信息后，点击确定

**Then**：

- 小程序预约记录、后台课程预约管理新增一条课程预约信息

---

#### TC-yanxue-029：研学后台-编辑多日营课程预约功能验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 课程管理-课程预约管理 › 1、点击已预约的“多日营”课程 2、点…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-029                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 课程管理-课程预约管理

**When**：

- 1、点击已预约的“多日营”课程
- 2、点击取消预约

**Then**：

- 支持取消预约
- 小程序预约记录、后台课程预约管理减少一条课程预约信息

---

#### TC-yanxue-030：研学后台-编辑多日营课程预约功能验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 课程管理-课程预约管理 › 1、点击已预约的“多日营”课程 2、点…（2）

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-030                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 课程管理-课程预约管理

**When**：

- 1、点击已预约的“多日营”课程
- 2、点击编辑

**Then**：

- 不显示课程时段
- 支持选择课程日期：日期-日期段

---

#### TC-yanxue-031：研学后台-编辑多日营课程预约功能验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 课程管理-课程预约管理 › 1、点击已预约的“多日营”课程 2、点…（3）

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-031                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 课程管理-课程预约管理

**When**：

- 1、点击已预约的“多日营”课程
- 2、点击编辑
- 3、编辑完成后
- 4、点击确定

**Then**：

- 多日营课程信息发生更新

---

#### TC-yanxue-032：研学后台-订单操作日志详情功能验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 订单管理-渠道订单管理 › 1、选择微店或抖音订单 2、操作订单修…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-032                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 订单管理-渠道订单管理

**When**：

- 1、选择微店或抖音订单
- 2、操作订单修改订单状态后

**Then**：

- 操作日志新增一条日志
- 显示：
- 操作者、执行操作、操作时间、操作原因（显示无）

---

#### TC-yanxue-033：研学后台-订单操作日志详情功能验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 订单管理-渠道订单管理 › 1、选择任意订单 2、操作退款，订单退…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-033                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 订单管理-渠道订单管理

**When**：

- 1、选择任意订单
- 2、操作退款，订单退款后

**Then**：

- 操作日志新增一条日志
- 显示：
- 操作者、执行操作、操作时间、操作原因（显示退款原因）

---

#### TC-yanxue-034：研学后台-订单操作日志详情功能验证 - 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon 2、网络正常 3、进入 订单管理-渠道订单管理 › 1、选择任意订单 2、操作修改手机号，…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-034                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon
- 2、网络正常
- 3、进入 订单管理-渠道订单管理

**When**：

- 1、选择任意订单
- 2、操作修改手机号，修改成功后

**Then**：

- 操作日志新增一条日志
- 显示：
- 操作者、执行操作、操作时间、操作原因（显示无）

---

#### TC-yanxue-035：课程信息管理-新增功能操作-选择推送合同 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 课程信息管理 页 › 1. 点击新增按钮 2. 在弹窗中选择"需要推送合同" 3. 填写…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-035                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 课程信息管理 页

**When**：

- 1. 点击新增按钮
- 2. 在弹窗中选择"需要推送合同"
- 3. 填写其他必填信息后保存

**Then**：

- 课程创建成功，推送合同状态为"需要"

---

#### TC-yanxue-036：课程信息管理-新增功能操作-选择推送合同 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 课程信息管理 页 › 1. 点击新增按钮 2. 在弹窗中选择"不需要推送合同" 3. 填…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-036                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 课程信息管理 页

**When**：

- 1. 点击新增按钮
- 2. 在弹窗中选择"不需要推送合同"
- 3. 填写其他必填信息后保存

**Then**：

- 课程创建成功，推送合同状态为"不需要"

---

#### TC-yanxue-037：课程信息管理-新增功能操作-选择推送合同 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 课程信息管理 页 › 1. 点击新增按钮 2. 不选择推送合同选项 3. 尝试保存

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-037                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 课程信息管理 页

**When**：

- 1. 点击新增按钮
- 2. 不选择推送合同选项
- 3. 尝试保存

**Then**：

- 提示"请选择是否需要推送合同"，无法保存

---

#### TC-yanxue-038：课程信息管理-修改功能操作-选择推送合同 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 课程信息管理 页 › 1. 编辑现有课程（原状态：需要推送合同） 2. 修改为"不需要推…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-038                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 课程信息管理 页

**When**：

- 1. 编辑现有课程（原状态：需要推送合同）
- 2. 修改为"不需要推送合同"
- 3. 保存修改

**Then**：

- 课程信息更新成功，课程预约管理页合同推送入口隐藏

---

#### TC-yanxue-039：课程信息管理-修改功能操作-选择推送合同 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 课程信息管理 页 › 1. 编辑现有课程（原状态：不需要推送合同） 2. 修改为"需要推…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-039                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 课程信息管理 页

**When**：

- 1. 编辑现有课程（原状态：不需要推送合同）
- 2. 修改为"需要推送合同"
- 3. 保存修改

**Then**：

- 课程信息更新成功，课程预约管理页显示合同推送入口

---

#### TC-yanxue-040：课程信息管理-修改功能操作-选择推送合同 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 课程信息管理 页 › 1. 编辑现有课程 2. 只修改课程名称等基本信息 3. 不改变推…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-040                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 课程信息管理 页

**When**：

- 1. 编辑现有课程
- 2. 只修改课程名称等基本信息
- 3. 不改变推送合同选项
- 4. 保存修改

**Then**：

- 课程信息更新成功，课程预约管理页合同推送状态保持不变

---

#### TC-yanxue-041：课程预约管理-预约合同推送入口操作 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 课程预约管理 页 › 1. 查看推送合同状态为"需要"的课程预约页 2. 检查合同推送入口

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-041                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 课程预约管理 页

**When**：

- 1. 查看推送合同状态为"需要"的课程预约页
- 2. 检查合同推送入口

**Then**：

- 页面显示合同推送入口

---

#### TC-yanxue-042：课程预约管理-预约合同推送入口操作 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 课程预约管理 页 › 1. 查看推送合同状态为"不需要"的课程预约页 2. 检查合同推送…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-042                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 课程预约管理 页

**When**：

- 1. 查看推送合同状态为"不需要"的课程预约页
- 2. 检查合同推送入口

**Then**：

- 页面不显示合同推送入口

---

#### TC-yanxue-043：课程预约管理-预约合同推送入口操作 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 课程预约管理 页 › 1. 修改课程的推送合同选项 2. 立即刷新预约页面 3. 检查合…

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-043                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 课程预约管理 页

**When**：

- 1. 修改课程的推送合同选项
- 2. 立即刷新预约页面
- 3. 检查合同推送入口

**Then**：

- 入口显示状态实时更新

---

#### TC-yanxue-044：渠道订单管理-金额数据一致性测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 创建新订单 2. 修改订单状态 3. 检查实付金额和优惠金额

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-044                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 创建新订单
- 2. 修改订单状态
- 3. 检查实付金额和优惠金额

**Then**：

- 实付金额和优惠金额保持不变

---

#### TC-yanxue-045：渠道订单管理-金额数据一致性测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 订单交易关闭 2. 退回优惠券 3. 检查金额字段

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-045                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 订单交易关闭
- 2. 退回优惠券
- 3. 检查金额字段

**Then**：

- 实付金额和优惠金额保持不变

---

#### TC-yanxue-046：渠道订单管理-金额数据一致性测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 订单经历多个状态转换 2. 检查各阶段金额数据

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-046                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 订单经历多个状态转换
- 2. 检查各阶段金额数据

**Then**：

- 实付金额和优惠金额始终保持一致

---

#### TC-yanxue-047：渠道订单管理-操作按钮权限和显示测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 查看微店或抖音渠道的订单 2. 检查操作列

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-047                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 查看微店或抖音渠道的订单
- 2. 检查操作列

**Then**：

- 显示原有操作按钮（不变）

---

#### TC-yanxue-048：渠道订单管理-操作按钮权限和显示测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 查看小程序渠道的订单 2. 检查操作列

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-048                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 查看小程序渠道的订单
- 2. 检查操作列

**Then**：

- 显示「修改手机号」「操作退款」「核销进度」

---

#### TC-yanxue-049：渠道订单管理-操作按钮权限和显示测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 使用无权限账号登录 2. 查看小程序订单

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-049                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 使用无权限账号登录
- 2. 查看小程序订单

**Then**：

- 不显示"操作退款"按钮

---

#### TC-yanxue-050：渠道订单管理-操作按钮权限和显示测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 使用有权限账号登录 2. 查看小程序订单

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-050                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 使用有权限账号登录
- 2. 查看小程序订单

**Then**：

- 显示"操作退款"按钮

---

#### TC-yanxue-051：渠道订单管理-操作按钮权限和显示测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 查看已退款的订单 2. 检查操作列

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-051                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 查看已退款的订单
- 2. 检查操作列

**Then**：

- "操作退款"按钮消失，显示"退款原因"按钮

---

#### TC-yanxue-052：渠道订单管理-退款功能测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 点击"操作退款"按钮 2. 检查弹窗内容

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-052                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 点击"操作退款"按钮
- 2. 检查弹窗内容

**Then**：

- 显示退款弹窗，包含订单编号、商品名称等字段

---

#### TC-yanxue-053：渠道订单管理-退款功能测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 在退款原因文本框输入 2. 测试输入限制

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-053                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 在退款原因文本框输入
- 2. 测试输入限制

**Then**：

- 支持输入文本、数字、字母，限制200字符

---

#### TC-yanxue-054：渠道订单管理-退款功能测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 输入小于等于实付金额的退款金额 2. 点击确认退款

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-054                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 输入小于等于实付金额的退款金额
- 2. 点击确认退款

**Then**：

- 微信商户正常退款，操作成功

---

#### TC-yanxue-055：渠道订单管理-退款功能测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 输入大于实付金额的退款金额 2. 尝试确认退款

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-055                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 输入大于实付金额的退款金额
- 2. 尝试确认退款

**Then**：

- 提示"退款金额不得大于实付金额"，阻止操作

---

#### TC-yanxue-056：渠道订单管理-退款功能测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 输入等于实付金额的退款金额 2. 点击确认退款

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-056                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 输入等于实付金额的退款金额
- 2. 点击确认退款

**Then**：

- 微信商户正常退款，操作成功

---

#### TC-yanxue-057：渠道订单管理-退款功能测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 输入0作为退款金额 2. 尝试确认退款

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-057                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 输入0作为退款金额
- 2. 尝试确认退款

**Then**：

- 提示"退款金额必须大于0"

---

#### TC-yanxue-058：渠道订单管理-退款功能测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 点击已退款订单的"退款原因"按钮 2. 查看弹窗内容

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-058                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 点击已退款订单的"退款原因"按钮
- 2. 查看弹窗内容

**Then**：

- 显示退款原因详情，可点击X关闭

---

#### TC-yanxue-059：渠道订单管理-退款功能测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 完成退款操作后 2. 检查订单状态

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-059                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 完成退款操作后
- 2. 检查订单状态

**Then**：

- 订单状态同步更新为已退款

---

#### TC-yanxue-060：渠道订单管理-退款数据校验和异常处理测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 输入非数字字符 2. 尝试确认退款

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-060                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 输入非数字字符
- 2. 尝试确认退款

**Then**：

- 提示"请输入有效的金额数字"

---

#### TC-yanxue-061：渠道订单管理-退款数据校验和异常处理测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 输入超过200字符的退款原因 2. 尝试确认退款

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-061                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 输入超过200字符的退款原因
- 2. 尝试确认退款

**Then**：

- 提示"退款原因不能超过200字符"

---

#### TC-yanxue-062：渠道订单管理-退款数据校验和异常处理测试 - 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info 2、网络正常 3、进入 渠道订单管理 页 › 1. 不填写退款原因或退款金额 2. 尝试确认退款

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-062                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1. 不填写退款原因或退款金额
- 2. 尝试确认退款

**Then**：

- 提示"请填写完整的退款信息"

---

#### TC-yanxue-063：渠道订单管理-订单备注功能验证

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 用例ID   | TC-yanxue-063                        |
| 类型     | 研学后台                              |
| 优先级   | P0                                    |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info；2、网络正常 |
| 关联需求 | PRD-研学后台-P0                       |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info
- 2、网络正常
- 3、进入 渠道订单管理 页

**When**：

- 1、使用小程序，购买商品后
- 2、填写备注
- 3、进入后台 渠道订单管理页

**Then**：

- 可查看到该订单的备注信息

---
