# 管理后台正向场景自动化

基于 [TEST.md](../TEST.md) 中**正向场景**且**类型=管理后台**的 8 条用例，使用 Midscene + Playwright 执行自动化。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SHADOW_LOGIN_URL` | 登录页地址 | `http://localhost:8080/shadow/login` |
| `SHADOW_ACCOUNT` | 登录账号 | `19371968034` |
| `SHADOW_PASSWORD` | 登录密码 | `12345678Dyw` |
| `HEADLESS` | 是否无头运行 | 未设置则有头（`1` 为无头） |

视觉模型配置使用项目根目录 `.env` 中的 `MIDSCENE_*`（见根目录 README）。

## 运行方式

在项目根目录执行：

```bash
# 运行全部 8 条正向用例
npm run test:shadow

# 只运行指定用例
npm run test:shadow -- --cases=TC-001,TC-007
```

支持的用例 ID：`TC-001`、`TC-002`、`TC-004`、`TC-005`、`TC-007`、`TC-008`、`TC-009`、`TC-010`。

## CSV 与上传类用例

- **TC-002**、**TC-005**、**TC-010** 需要上传 CSV，默认使用 `fixtures/orders_other.csv`。
- CSV 需符合「其他」渠道映射：至少包含与映射配置一致的列名（如 `channel_name` 对应系统字段「三方渠道」）。列名、订单状态值、服务状态值需与后台「其他」Tab 中配置的映射一致。
- 若实际业务要求的必填列与示例不同，请复制 `fixtures/orders_other.csv` 后按需修改列名与数据。

## 目录说明

- `shadow-login.ts`：登录 + 进入渠道订单管理。
- `run-shadow-tests.ts`：主入口，解析 `--cases`、登录、依次执行用例并输出结果。
- `cases/shadow-tests.ts`：8 条 TC 的 When/Then 实现（Midscene `aiAct` / `aiWaitFor` / `aiAssert` + Playwright 文件上传兜底）。
