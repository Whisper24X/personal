---
name: zhichi-ticket-api
description: >-
  Obtains a Sobot-compatible API token from the internal hardwarecrawler endpoint,
  then queries Zhichi (Sobot) tickets via query_tickets_by_update_time or get_ticket_by_id
  (工单详情含操作历史 update_log_list、回复 deal_list). Use for ticketing, ticket detail,
  operation history, 受理客服 ID lookup via 受理id-mapping.md, Feishu/spreadsheet export
  filtered by 智能硬件受理客服, and when 更新客服 differs—get_ticket_by_id to fill four
  columns (受理客服组ID/组名/客服ID/客服名) for the update agent per SKILL rules.
---

# 智齿 Token + 工单列表 / 工单详情

## 工作流（必须按顺序）

1. **获取 Token**：请求内部接口（方法、Header、Body 以 [reference.md](reference.md) 中「内部 Token 接口」为准；未填项禁止猜测）。
2. **（按需）解析受理客服 / 组 ID**：用户按**客服姓名**、**客服组名**或业务别名（如「智能硬件」）筛选时，**不可**假定 API 支持仅按 `deal_agent_name` 过滤；应打开 [受理id-mapping.md](受理id-mapping.md)（源表 [智齿受理id.xlsx](智齿受理id.xlsx)）查出 **受理客服ID** → 填 `deal_agentid`，**受理客服组ID** → 填 `deal_agent_groupid`。
3. **携带 Token 调智齿**：在 HTTPS 请求 **Header** 中设置 `token: <token 值>`，再 GET 目标接口。智齿开放平台 Token 通常约 **24 小时**有效，应在业务内统一复用并适时刷新，勿为每个请求无意义地重复申请。

**选接口**：

- **按时间窗口拉列表**（批量同步、筛选）：`query_tickets_by_update_time`。
- **单条工单详情 / 操作历史 / 全量回复**：`get_ticket_by_id`（见 [reference.md](reference.md) §4）。用户给出 **工单编号** `ticket_code` 或 **工单 ID** `ticketid` 时用此接口；操作历史在 `item.update_log_list`，客服与客户回复在 `item.deal_list`。

## 智能硬件与表格写入规则

面向飞书/表格等导出时，按下述判定；字段与智齿 JSON 路径见 [reference.md](reference.md) §4.4。

**名词**

- **受理客服**：列表/详情中的接待坐席，对应 `deal_agent_name`、`deal_agentid`，组为 `deal_group_name`、`deal_groupid`（详情中智齿文档亦记为 `deal_groupid` / `deal_group_name`）。
- **更新客服**：与后台「更新人」一致，优先取列表 `items[].update_agent_name`、详情 `item.update_agent_name`；必要时结合 `item.update_log_list` 中坐席操作记录（见 §4.4）。

**判定「是否为智能硬件」**

- 必须用 [受理id-mapping.md](受理id-mapping.md)（源表 [智齿受理id.xlsx](智齿受理id.xlsx)）将 **受理客服姓名或受理客服 ID** 与表中 **受理客服 = 智能硬件** 行对齐；**禁止**仅凭主观判断。

**写入规则**

1. **仅当受理客服为智能硬件时**写入目标表格；受理为其他客服时 **不写入**。
2. 若 **受理客服 = 智能硬件** 且 **更新客服 = 智能硬件**：按业务列要求写入（无需因本规则额外拉详情）。
3. 若 **受理客服 = 智能硬件** 且 **更新客服 ≠ 智能硬件**：必须用 **`ticketid`** 调用 `get_ticket_by_id`，将 **更新客服** 对应的四列写入表格：**受理客服组ID**、**受理客服组**、**受理客服ID**、**受理客服**（即更新操作人侧的组与坐席信息）。若响应中未直接给出更新人的组字段，用 `update_agent_name` 或 `update_log_list[].update_agent_id`（坐席类记录）反查 [受理id-mapping.md](受理id-mapping.md) 补全四列；以实际返回为准。

## 端点（项目约定）

| 用途 | URL |
| --- | --- |
| Token | `https://hardwarecrawler.yc345.tv/api/ticket/token` |
| 按更新时间查列表 | `https://www.sobot.com/api/ws/{ws_id}/ticket/query_tickets_by_update_time` |
| **工单详情（含操作历史、回复）** | `https://www.sobot.com/api/ws/{ws_id}/ticket/get_ticket_by_id` |

路径中的 `{ws_id}` 需与智齿后台/对接文档一致（文档示例常为 `5`）。若环境不同，替换整段 `/ws/{ws_id}/`，勿假定全局唯一。

## 工单列表 query（最小要点）

- **方法**：`GET`。
- **Header**：`token`（必填）；可选 `language`、`timezoneid`（时区，默认常设为 `Asia/Shanghai`）。
- **时间范围**：官方参数表以 `update_start_datetime_ms` / `update_end_datetime_ms`（毫秒时间戳）为主；部分环境与文档示例使用字符串时间。单次查询跨度通常 **不超过一个月**。分页参数 `page_no`、`page_size` 按文档为必填项。
- **按接待人/组过滤**：Query 使用 `deal_agentid`、`deal_agent_groupid`（见 [reference.md](reference.md) 3.1）。名称与 UUID 对照见 [受理id-mapping.md](受理id-mapping.md)。

完整参数表、`items` 字段见 [reference.md](reference.md) §3；**工单详情、`update_log_list`、受理/更新客服与表格列映射** 见 §4（含 §4.4）。

## 安全

- 勿将 Token 写入仓库、截图、公开日志或提交记录。
- 脚本与文档中的示例 Token 仅作格式说明，须替换为实时有效值。

## 何时阅读 reference

- 需要完整 Query 参数、列表响应字段、错误码或内部 Token 接口占位表时，打开 [reference.md](reference.md)。
- 需要 **单条工单详情、`get_ticket_by_id`、操作历史 `update_log_list`、受理/更新客服字段** 时，打开 [reference.md](reference.md) §4 与 §4.4。
- 需要**受理客服 / 受理客服组**与 `deal_agentid` / `deal_agent_groupid` 对应关系时，打开 [受理id-mapping.md](受理id-mapping.md)（或 Excel 源表）。
