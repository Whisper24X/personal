---
name: zhichi-ticket-api
description: >-
  Obtains a Sobot-compatible API token from the internal hardwarecrawler endpoint,
  then queries Zhichi (Sobot) tickets by update time via query_tickets_by_update_time.
  Use when integrating with 智齿/Sobot ticketing, syncing tickets by update window,
  hardwarecrawler ticket token, or when the user mentions query_tickets_by_update_time.
---

# 智齿 Token + 工单按更新时间查询

## 工作流（必须按顺序）

1. **获取 Token**：请求内部接口（方法、Header、Body 以 [reference.md](reference.md) 中「内部 Token 接口」为准；未填项禁止猜测）。
2. **携带 Token 调智齿**：在 HTTPS 请求 **Header** 中设置 `token: <token 值>`，再 GET 工单查询地址。智齿开放平台 Token 通常约 **24 小时**有效，应在业务内统一复用并适时刷新，勿为每个请求无意义地重复申请。

## 端点（项目约定）

| 步骤 | URL |
| --- | --- |
| Token | `https://hardwarecrawler.yc345.tv/api/ticket/token` |
| 工单查询 | `https://www.sobot.com/api/ws/{ws_id}/ticket/query_tickets_by_update_time` |

路径中的 `{ws_id}` 需与智齿后台/对接文档一致（文档示例常为 `5`）。若环境不同，替换整段 `/ws/{ws_id}/`，勿假定全局唯一。

## 工单查询（最小要点）

- **方法**：`GET`。
- **Header**：`token`（必填）；可选 `language`、`timezoneid`（时区，默认常设为 `Asia/Shanghai`）。
- **时间范围**：官方参数表以 `update_start_datetime_ms` / `update_end_datetime_ms`（毫秒时间戳）为主；部分环境与文档示例使用字符串时间。单次查询跨度通常 **不超过一个月**。分页参数 `page_no`、`page_size` 按文档为必填项。

完整参数表、`items` 字段、错误码见 [reference.md](reference.md)。

## 安全

- 勿将 Token 写入仓库、截图、公开日志或提交记录。
- 脚本与文档中的示例 Token 仅作格式说明，须替换为实时有效值。

## 何时阅读 reference

- 需要完整 Query 参数、响应字段、错误码或内部 Token 接口占位表时，打开 [reference.md](reference.md)。
