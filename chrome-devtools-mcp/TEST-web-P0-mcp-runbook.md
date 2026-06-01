# TEST.md：P0 · 正向 · Web（管理后台）— chrome-devtools-mcp 执行清单

本文从 [TEST.md](TEST.md) **第二部分**抽取同时满足：

- 标题含 **「正向」**
- 表格 **优先级 = P0**
- **自动化就绪** 中含 **管理后台 / 浏览器** 可执行步骤（`goto`、`/order/*`、`/course/*`、`/contract/*` 等）

**不包含**：纯小程序 / 抖音真机 / 无页面的接口造数步骤（仍会注明「需小程序或数据准备」）。

**基址**：与 [login.md](login.md) 一致时使用 `SHADOW_BASE = https://trip-shadow-test.yangcong345.com/trip`（路径以你环境为准；若路由为 `#/order/channel` 则拼完整 URL）。

**MCP 工具**（以当前 chrome-devtools-mcp 为准）：`navigate_page` → `take_snapshot` → `fill` / `click` → `wait_for`；每步操作前优先 snapshot。

**环境注意**：若 MCP 报 *browser is already running for … chrome-profile*，请先关闭已占用该 profile 的 Chrome，或按官方说明使用独立 `userDataDir` / `--isolated` 再起 MCP。

---

## 用例与 Web 子步骤（Then 完整成立仍依赖造数 / 小程序时见说明）

| 用例 | ID | Web 步骤摘要 | 数据/端依赖 |
|------|-----|----------------|-------------|
| TC-001 | TC-ORD-001 | 登录 → `…/order/subOrder` → 「渠道订单编号」搜索父单关联号 → 表格行数与子单数 | 需已知订单号；小程序侧为 🟡 |
| TC-004 | TC-PAY-001 | 登录 → `…/order/subOrder` → 按 `ORD_PAY_001`（或环境单号）筛选 → 行列非空 | 需预备待支付→已支付单；小程序 🟡 |
| TC-007 | TC-DY-001 | `…/order/channel` → 「购买渠道」选抖音或按手机/券字段搜 → 列表可见父单 | 需抖音沙箱回调数据 🟡 |
| TC-008 | TC-DY-002 | `…/order/channel` 筛出两行父单 → `…/order/subOrder` 分别筛 → 子单不串单 | 需多券数据 🟡 |
| TC-010 | TC-BK-001 | `…/course/appointment` → 列表/筛选加载 → 按订单或手机找 `ORD_BK_001` 关联预约 | 需预约数据；小程序 🟡 |
| TC-013 | TC-TRIP-001 | 批量任务执行后 → `…/order/subOrder` 筛关联子单 → 「服务状态」出行完成等价 | 无批量菜单；需 job 🔴 + 数据 |
| TC-016 | TC-RFD-001 | `…/order/channel` 或 `…/order/subOrder` → 「退款时间」日期范围 → 与小程序状态对齐 | 需退款流水；小程序发起 🟡 |
| TC-019 | TC-CTR-001 | `…/contract/record` → 「家长手机号」或「学生姓名」搜索 → 合同状态 tag、链接列 | `contract_record_view` |
| TC-022 | TC-SMS-001 | `…/contract/record` → 行内「短信提醒」→ 确认弹窗 → `ElMessage` 成功语义 | 与开课短信不同业务；开课提醒见 API |
| TC-025 | TC-UX-001 | **无纯 Web 主路径**（文档为小程序点击 ≤3s） | Web 侧可改为任意后台「搜索/保存」测反馈，非原文等价 |

**未列入**：TC-023 等为 P0 但非「正向」标题；TC-014 等为 P0 但属边界/非正向。

---

## 推荐执行顺序（仅 Web 冒烟：路由可达 + 表头/筛选项存在）

1. `navigate_page` → `{SHADOW_BASE}/login`  
2. snapshot → 填账号密码 → 点登录 → `wait_for` 离开登录或侧栏出现  
3. 依次 `navigate_page`（或侧栏点击等价菜单）：  
   - `/order/channel`  
   - `/order/subOrder`  
   - `/course/appointment`  
   - `/contract/record`  
4. 每页：`take_snapshot` 确认表头/placeholder 与 TEST.md「元素提示」一致（不强断言业务 Then，除非已备数据）。

侧栏名称对照见 TEST.md **「管理后台侧栏 ↔ 路由映射」** 表。

---

## 与完整验收的差距

- **正向 Then** 多数依赖：小程序操作、支付/抖音回调、定时任务、指定 `ORD_*` 测试数据。  
- 本清单的 **MCP Web 跑法**优先用于：**权限、路由、列表壳、筛选项、合同页短信按钮** 等可观测点；完整 P0 正向需在测试环境造数后按 TEST.md **When（后台）** 再断言 Then。

---

*生成说明：从 TEST.md v1.1 筛选；若 PRD/路由变更，以 `ainative-shadow` 实际路由为准更新 URL。*
