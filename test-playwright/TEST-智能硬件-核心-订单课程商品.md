# 测试文档（核心：订单 / 课程 / 商品）

> **测试环境（MCP / 浏览器自动化）**：默认使用研学管理后台测试网（如 `https://trip-shadow-test.yangcong345.com`）及前置条件中的入口 URL；执行前需已登录管理后台账号。When 步骤在对应页面内依次操作。

> **侧栏菜单文案来源**：与线上「洋葱研学」后台前端构建产物（`trip/static/js/index.*.js`）中路由 `meta.title` 一致；若部署版本与测试网不一致，以实测页面为准。下列「侧栏点击」路径中的菜单名须与页面侧栏**完全一致**。

> **常用入口（一级 → 二级，与 path 对应）**：`订单管理` → `渠道订单管理`（`/trip/order/channel`）；`课程管理` → `课程信息管理`（`/trip/course/info`）、`课程库存管理`（`/trip/course/inventory`）、`课程预约管理`（`/trip/course/appointment`）；`商品管理` → `平台商品管理`（`/trip/good/list`）；`小程序管理` → `优惠券列表`（`/trip/miniProgram/coupon`）；`权限管理` → `账号管理`（`/trip/permission/account`）；`合同管理` → `合同模板`（`/trip/contract/template`）。

---

## 第二部分：测试用例（核心：订单 / 课程 / 商品）

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

#### TC-CORE-0001：[研学后台]旧订单后台操作退款逻辑回归验证验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0001 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631314639 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/order/channel` → 等待订单列表表格加载；或侧栏点击「订单管理」→ 等待子菜单展开 → 点击子菜单「渠道订单管理」→ 等待订单列表表格加载

- 1、选择旧订单、并且是多日营商品、3选2 操作退款
- 2、后台输入退款金额

**Then**：

- 能正常退款，并且能收到退款金额 并且订单状态为：已退款

---


#### TC-CORE-0002：[研学后台]导入订单，子订单拆分逻辑验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0002 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631043204 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/order/channel` → 等待订单列表表格加载；或侧栏点击「订单管理」→ 等待子菜单展开 → 点击子菜单「渠道订单管理」→ 等待订单列表表格加载

- 1、购买多选商品 或 造一笔 抖音/微店 订单（3选2）
- 2、预约其中一个

**Then**：

- 查看后台拆单逻辑： 查看对应的子订单状态为：已预约 父订单状态为：待预约

---


#### TC-CORE-0003：[研学后台]抖音、微店的CSV映射配置新增字段功能验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0003 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6631094690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/order/channel` → 等待订单列表表格加载；或侧栏点击「订单管理」→ 等待子菜单展开 → 点击子菜单「渠道订单管理」→ 等待订单列表表格加载
- 在渠道订单管理页点击「CSV映射配置」按钮 → 等待映射配置弹窗打开
- 在弹窗中按渠道切换至「抖音」「微店」等对应 Tab（若有）→ 等待当前 Tab 内表单加载

**Then**：

- 新增系统字段 商品类型、平台手续费、达人佣金、达人uid 新增订单状态映射字段：待付款、支付成功、交易关闭、已退款、退款中、退款失败 新增服务状态映射字段：待预约、已预约、已出行

**元素选择**：

| 元素 | 类型 | 参数 | 定位 |
| --- | --- | --- | --- |
| 订单管理 | 侧栏一级菜单 | 文本=订单管理 | getByRole('menuitem') / link |
| 渠道订单管理 | 侧栏子菜单 | 文本=渠道订单管理 | getByRole('menuitem') |
| CSV映射配置 | 按钮 | 文本=CSV映射配置 | getByRole('button') |
| 映射配置弹窗 | 对话框 | 标题含 CSV / 映射 | getByRole('dialog') |
| Tab 内映射表单 | Tab 内表单 | 当前激活 pane | `.el-tab-pane[aria-hidden="false"]` 内 `.el-form` |
| 下拉选项 | 下拉选项 | 见表单 label | `getByRole('listbox').getByRole('option', { name: '…' })` |

---


#### TC-CORE-0004：[研学后台]渠道订单管理新增筛选字段验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0004 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6630968690 |

**Given**：

- 1、研学后台：https://trip-shadow-test.yangcong345.com/trip/order/channel

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/order/channel` → 等待订单列表表格加载；或侧栏点击「订单管理」→ 等待子菜单展开 → 点击子菜单「渠道订单管理」→ 等待订单列表表格加载
- 在渠道订单管理页顶部的搜索/筛选区域中，确认筛选字段展示

**Then**：

- [商品类型][退款时间][服务状态][订单状态]

**元素选择**：

| 元素 | 类型 | 参数 | 定位 |
| --- | --- | --- | --- |
| 商品类型 | 表单项+下拉框 | label=商品类型 | `.el-form-item` filter hasText 商品类型 + `.el-select` |
| 退款时间 | 表单项+日期选择器 | label=退款时间 | `.el-form-item` filter hasText 退款时间 + `.el-date-editor` |
| 服务状态 | 表单项+下拉框 | label=服务状态 | `.el-form-item` filter hasText 服务状态 + `.el-select` |
| 订单状态 | 表单项+下拉框 | label=订单状态 | `.el-form-item` filter hasText 订单状态 + `.el-select` |

---


#### TC-CORE-0005：研学后台-订单操作日志详情功能验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0005 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6449233128 |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon` → 等待页面加载；侧栏点击「订单管理」→ 等待子菜单展开 → 点击子菜单「渠道订单管理」→ 等待订单列表表格加载

- 1、选择微店或抖音订单
- 2、操作订单状态为待预约或已预约状态的订单，修改手机号状
- 3、输入手机号：19371968034，点击确定

**Then**：

- 操作日志新增一条日志 显示： 操作者、执行操作、操作时间、操作原因（显示无）

---


#### TC-CORE-0006：渠道订单管理-退款功能测试

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0006 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429841700 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- **导航**：侧栏点击「订单管理」→ 等待子菜单展开 → 点击子菜单「渠道订单管理」→ 等待订单列表表格加载（Given 为课程信息页入口时，仍以渠道订单列表为操作页；亦可浏览器直达 `https://trip-shadow-test.yangcong345.com/trip/order/channel`）

- 1. 在目标订单行点击「操作退款」按钮 → 等待退款弹窗打开
- 2. 检查弹窗内容

**Then**：

- 显示退款弹窗，包含订单编号、商品名称等字段

---


#### TC-CORE-0007：渠道订单管理-操作按钮权限和显示测试

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0007 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429973572 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- **导航**：侧栏点击「订单管理」→ 等待子菜单展开 → 点击子菜单「渠道订单管理」→ 等待订单列表表格加载（亦可浏览器直达 `https://trip-shadow-test.yangcong345.com/trip/order/channel`）

- 1. 查看微店或抖音渠道的订单
- 2. 检查操作列

**Then**：

- 显示原有操作按钮（不变）

---


#### TC-CORE-0008：订单管理-订单状态验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0008 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6048100444 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/permission/account` → 等待页面加载；侧栏点击「订单管理」→ 等待子菜单展开 → 点击子菜单「渠道订单管理」→ 等待订单列表表格加载

- 1、使用抖音和微店的订单csv文件
- 2、csv文件中状态存在未核销、待发货、已发货、已完成
- 3、在渠道订单管理页点击「导入」或同类导入入口 → 等待导入弹窗 → 选择文件并提交导入

**Then**：

- 导入成功后 订单管理中状态显示：待预约，该状态同步到 公众号与公众号一致
- 公众号显示：待预约

---


#### TC-CORE-0009：订单管理-导入、导出功能验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0009 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6074384533 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/permission/account` → 等待页面加载；侧栏点击「订单管理」→ 等待子菜单展开 → 点击子菜单「渠道订单管理」→ 等待订单列表表格加载

- 1、点击「导入」按钮 → 等待导入弹窗打开

**Then**：

- 弹出导入弹窗

---


#### TC-CORE-0010：课程预约管理-预约合同推送入口操作

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0010 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429408856 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- **导航**：浏览器访问 Given 中的入口 URL → 等待页面加载；侧栏点击「课程管理」→ 等待子菜单展开 → 点击子菜单「课程预约管理」→ 等待课程预约列表表格加载（亦可直达 `https://trip-shadow-test.yangcong345.com/trip/course/appointment`）

- 1. 查看推送合同状态为"需要"的课程预约页
- 2. 检查合同推送入口

**Then**：

- 页面显示合同推送入口

---


#### TC-CORE-0011：课程信息管理-新增功能操作-选择推送合同

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0011 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6429630757 |

**Given**：

- 1、进入 https://trip-shadow-test.yangcong345.com/trip/course/info

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/course/info` → 等待页面加载；或侧栏点击「课程管理」→ 等待子菜单展开 → 点击子菜单「课程信息管理」→ 等待课程列表表格加载

- 1. 点击「新增」按钮 → 等待新增课程弹窗打开
- 2. 在弹窗中选择"需要推送合同"
- 3. 填写其他必填信息后保存

**Then**：

- 课程创建成功，推送合同状态为"需要"

---


#### TC-CORE-0012：研学后台-课程管理-课程库存管理新建库存功能验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0012 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408724992 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/contract/template` → 等待页面加载；侧栏点击「课程管理」→ 等待子菜单展开 → 点击子菜单「课程库存管理」→ 等待课程库存列表加载

- 1. 点击「新增选项」按钮 → 等待弹窗打开
- 2. 查看弹窗内容

**Then**：

- 弹窗显示课程选择列表，包含单日和多日课程选项

---


#### TC-CORE-0013：研学后台-课程管理-修改课程功能验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0013 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408803476 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/contract/template` → 等待页面加载；侧栏点击「课程管理」→ 等待子菜单展开 → 点击子菜单「课程信息管理」→ 等待课程列表表格加载

- 1. 在目标课程行点击「编辑」或同类编辑入口 → 等待编辑弹窗或表单加载
- 2. 修改课程名称、时间等信息
- 3. 保存更改

**Then**：

- 课程信息更新成功

---


#### TC-CORE-0014：研学后台-课程管理-课程信息管理新增功能验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0014 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408595057 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/contract/template` → 等待页面加载；侧栏点击「课程管理」→ 等待子菜单展开 → 点击子菜单「课程信息管理」→ 等待课程列表表格加载

- 1. 点击「新增课程」按钮 → 等待新增课程弹窗打开
- 2. 查看弹窗内容

**Then**：

- 弹窗包含课程类型选项，选项包括：单日、多日

---


#### TC-CORE-0015：课程预约管理-推送合同功能验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0015 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6169046396 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/permission/account` → 等待页面加载；侧栏点击「课程管理」→ 等待子菜单展开 → 点击子菜单「课程预约管理」→ 等待课程预约列表表格加载

- 1、筛选或定位「已预约」状态的课程预约记录

**Then**：

- 操作栏新增 推送合同 功能

---


#### TC-CORE-0016：课程预约管理-修改验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0016 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6152752773 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/permission/account` → 等待页面加载；侧栏点击「课程管理」→ 等待子菜单展开 → 点击子菜单「课程预约管理」→ 等待课程预约列表表格加载

- 1、选择一个存在的课程预约管理
- 2、点击「修改」→ 等待编辑弹窗或表单加载

**Then**：

- 1、信息回显 2、课程名称不允许修改，课程日期不允许修改到之前日期和无库存的 3、点击确定，保存成功，更新时间更新，信息内容修改更新，进入到公众号查看显示一致 4、点击取消，不做处理

---


#### TC-CORE-0017：课程库存管理-新增、上架、下架验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0017 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5999102656 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/permission/account` → 等待页面加载；侧栏点击「课程管理」→ 等待子菜单展开 → 点击子菜单「课程库存管理」→ 等待课程库存列表加载

- 1、点击「新增」或「新增选项」按钮 → 等待新增弹窗打开

**Then**：

- 显示新增弹窗

---


#### TC-CORE-0018：课程信息管理-修改、上架、下架状态功能验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0018 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5996912396 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/permission/account` → 等待页面加载；侧栏点击「课程管理」→ 等待子菜单展开 → 点击子菜单「课程信息管理」→ 等待课程列表表格加载

- 1、选择一条未上架的数据
- 2、点击「上架」按钮 → 等待上架确认弹窗

**Then**：

- 显示上架确定弹窗 点击确定： 如果课程暂无库存，则上架失败，点击弹窗的跳转到课程库存管理页 如果课程有库存，则上架成功 点击取消：不做处理

---


#### TC-CORE-0019：课程信息管理-新增验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0019 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/5996599327 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/permission/account` → 等待页面加载；侧栏点击「课程管理」→ 等待子菜单展开 → 点击子菜单「课程信息管理」→ 等待课程列表表格加载

- 1、点击「新建」或「新增课程」按钮 → 等待新建弹窗打开

**Then**：

- 显示新建弹窗

---


#### TC-CORE-0020：研学后台-同一类别中商品多次选择验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0020 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6442981884 |

**Given**：

- 1、进入研学后台：https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/miniProgram/coupon` → 等待页面加载；或侧栏点击「小程序管理」→ 等待子菜单展开 → 点击子菜单「优惠券列表」→ 等待页面加载

- 1、点击「新增预约」或页面内等价入口 → 等待预约表单/弹窗加载
- 2、输入课程预约信息
- 3、选择课程分类为：7选2的课程

**Then**：

- 每次只选一个课程，但最多只能选择2门课程，超过2门时，无法再继续约课 完成预约的课程，进入小程序预约记录/后台课程预约管理新增一条预约，筛选可查看到

---


#### TC-CORE-0021：研学后台-商品管理-平台商品管理-编辑商品功能验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0021 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408582540 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/contract/template` → 等待页面加载；侧栏点击「商品管理」→ 等待子菜单展开 → 点击子菜单「平台商品管理」→ 等待商品列表表格加载

- 1. 在列表中点击目标商品的「编辑」→ 等待编辑弹窗或表单加载
- 2. 商品包含多个课程
- 3. 是否推送预约信息-预约选项选择"是"
- 4. 点击「确定」

**Then**：

- 提示"是否推送预约信息选项选择有误"，无法提交

---


#### TC-CORE-0022：研学后台-商品管理-平台商品管理新增商品功能验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0022 |
| 类型     | 管理后台 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6408489115 |

**Given**：

- 进入研学后台：https://trip-shadow-test.yangcong345.com/trip/contract/template

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/contract/template` → 等待页面加载；侧栏点击「商品管理」→ 等待子菜单展开 → 点击子菜单「平台商品管理」→ 等待商品列表表格加载

- 1. 点击「新增商品」按钮 → 等待新增商品弹窗打开
- 2. 查看弹窗内容

**Then**：

- 弹窗包含商品类别选项，选项包括：单日类型商品、多日类型商品

---


#### TC-CORE-0023：商品管理-修改、上架、下架、复制验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0023 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6076898478 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/permission/account` → 等待页面加载；侧栏点击「商品管理」→ 等待子菜单展开 → 点击子菜单「平台商品管理」→ 等待商品列表表格加载

- 1、在目标商品行点击「修改」→ 等待编辑弹窗打开
- 2、已存在商品管理数据，进入到修改弹窗页
- 3、选择一个商品信息，进行修改
- 4、点击「确定」

**Then**：

- 信息回显 修改成功后 数据更新成功 更新时间发生改变

---


#### TC-CORE-0024：商品管理-新增验证

| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | TC-CORE-0024 |
| 类型     | 研学 |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account |
| 关联需求 | https://project.feishu.cn/ychardware/test_cases/detail/6058951144 |

**Given**：

- 进入：https://trip-shadow-test.yangcong345.com/trip/permission/account

**When**：

- **导航**：浏览器访问 `https://trip-shadow-test.yangcong345.com/trip/permission/account` → 等待页面加载；侧栏点击「商品管理」→ 等待子菜单展开 → 点击子菜单「平台商品管理」→ 等待商品列表表格加载

- 1、确认当前位于平台商品管理页（列表与工具栏已加载）
- 2、点击「新增」或「新增商品」→ 等待新增弹窗打开
- 3、输入商品名称
- 4、点击「确定」

**Then**：

- 新增成功 更新时间与最后编辑人与当时创建的保持一致

---
