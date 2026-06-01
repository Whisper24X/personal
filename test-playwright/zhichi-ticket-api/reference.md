# 智齿工单 API 参考

## 1. 开放平台 Token 通用规则（智齿文档）

- 调用业务类接口时，须在 **HTTPS 请求 Header** 中携带 `token`。
- Token 为开放平台全局调用凭证，应 **统一获取与复用**；勿为各业务线分别频繁刷新，否则易导致失效。
- 建议预留至少 **32 字符** 存储空间；有效期常见约 **24h**（以返回的 `expire_in` 为准，当前多为 86400 秒内）。
- Token 失效时按接口返回提示重新获取。

---

## 2. 内部 Token 接口（hardwarecrawler）

**Base URL**：`https://hardwarecrawler.yc345.tv/api/ticket/token`

以下表格为 **占位**：对接前请向接口负责人确认并补全，**禁止在未确认时编造 Header/Body**。

| 项目 | 说明 |
| --- | --- |
| HTTP 方法 | 待填（用户曾选 POST 或其它） |
| Content-Type | 待填（如 `application/json`） |
| 鉴权 | 待填（Cookie、Bearer、签名等） |
| 请求 Header | 待填 |
| 请求 Body 模板 | 待填 |
| 成功响应示例 | 待填 |
| Token 字段路径 | 待填（例如响应 JSON 中 `data.token`） |
| 过期相关字段 | 待填（如有 `expire_in` 等） |

---

## 3. query_tickets_by_update_time（智齿开放平台）

**本仓库约定 Host**（与 SKILL 一致）：

`https://www.sobot.com/api/ws/{ws_id}/ticket/query_tickets_by_update_time`

文档亦常见 `https://sg.sobot.io/api/ws/{ws_id}/ticket/...` 等形式，以实际部署为准；**仅 `{ws_id}` 需与租户一致**。

### 3.1 请求

- **方法**：`GET`
- **Header**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| token | String | 是 | 开放平台 Token |
| language | String | 否 | 语言等 |
| timezoneid | String | 否 | 时区，如 `Asia/Shanghai`，默认常见为 `Asia/Shanghai` |

- **Query 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| update_start_datetime_ms | Long | 是（文档表） | 更新起始时间（毫秒），如 `1678085323404` |
| update_end_datetime_ms | Long | 是（文档表） | 更新结束时间（毫秒）。**查询时间范围一般不超过一个月** |
| update_start_datetime | String | 见环境 | 文档示例用字符串，如 `2018-09-18 00:00:00` |
| update_end_datetime | String | 见环境 | 文档示例用字符串，如 `2018-09-18 23:59:59` |
| ticket_status | String | 否 | `0` 未领取，`1` 处理中，`2` 待回复，`3` 已解决，`99` 已关闭，`98` 已删除；含自定义状态 |
| ticket_from | String | 否 | 工单来源（文档枚举较多，略） |
| ticket_typeid | String | 否 | 工单分类 ID |
| userid | String | 否 | 客户 ID |
| user_partnerid | String | 否 | 客户对接 ID |
| deal_agentid | String | 否 | 接待客服 ID |
| deal_agent_groupid | String | 否 | 接待客服组 ID |
| page_no | Integer | 是 | 当前页，从 1 起 |
| page_size | Integer | 是 | 每页条数，默认常见 15，**最大 50** |

**参数冲突说明**：官方文档表格以 `*_ms` 为主，示例 curl 使用字符串时间。对接时 **优先使用 `update_start_datetime_ms` / `update_end_datetime_ms`**；若环境仅接受字符串格式，再改用 `update_start_datetime` / `update_end_datetime`，并以实际返回为准。

### 3.2 响应（顶层）

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| ret_code | String | 返回码 |
| ret_msg | String | 返回信息 |
| items | List | 工单列表 |
| page_no | Integer | 当前页 |
| page_size | Integer | 每页条数 |
| page_count | Integer | 总页数 |
| total_count | Integer | 总条数 |

### 3.3 items 中单条工单（常见字段）

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| ticketid | String | 工单 ID |
| ticket_title | String | 标题 |
| ticket_content | String | 问题描述 |
| ticket_code | String | 工单编号 |
| ticket_from | String | 来源 |
| ticket_level | String | 优先级：`0` 低，`1` 中，`2` 高，`3` 紧急 |
| ticket_status | String | 状态（同 Query 中 ticket_status 枚举） |
| start_type | String | 创建人类型：`0` 客服，`1` 客户 |
| start_name | String | 创建人名称 |
| ticket_type_name | String | 分类名称展示 |
| deal_agent_name | String | 接待客服名 |
| deal_group_name | String | 接待技能组名 |
| create_datetime | String | 创建时间 |
| create_datetime_ms | Long | 创建时间（毫秒） |
| update_datetime | String | 更新时间 |
| update_datetime_ms | Long | 更新时间（毫秒） |
| user_nick | String | 客户昵称 |
| user_name | String | 客户姓名 |
| user_tels | String | 电话，多个逗号分隔 |
| user_emails | String | 邮箱，多个逗号分隔 |
| evaluation_datetime | String | 评价时间 |
| evaluation_datetime_ms | Long | 评价时间（毫秒） |
| score | Integer | 评分 1–5 星 |
| remark | String | 评价备注 |

### 3.4 示例 curl（格式示意）

```bash
curl -H 'token: <YOUR_TOKEN>' \
  -H 'language: en' \
  -H 'timezoneid: Asia/Shanghai' \
  'https://www.sobot.com/api/ws/5/ticket/query_tickets_by_update_time?update_start_datetime=2018-09-18%2000:00:00&update_end_datetime=2018-09-18%2023:59:59&page_no=1&page_size=15'
```

将 `5` 换为实际 `ws_id`；若使用毫秒参数，替换 Query 中的时间字段为 `update_start_datetime_ms` / `update_end_datetime_ms`。

---

## 4. 常见错误码（与 Token 相关，摘自智齿文档常见项）

| ret_code | 含义 |
| --- | --- |
| 900001 | Token 为空 |
| 900002 | Token 过期，需重新获取 |

其它业务码以智齿当前文档与接口返回 `ret_msg` 为准。
