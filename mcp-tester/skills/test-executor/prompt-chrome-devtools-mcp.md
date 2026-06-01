# chrome-devtools-mcp（提示词模板 · 管理后台）

将本文件作为发给 Agent 的任务说明；占位符在发送前替换。工具行为与参数以 **chrome-devtools-mcp** 官方 README 为准。

## 与 skills 的关系

- **test-executor**：执行主协议；工具、ReAct、解阻、Verify、结论与单条结构均以其为准。
- **contract**：`skills/test-executor/references/contract-v2-lite.md`（结论码、断言优先于样本、无证据不落结论）。
- **test-reviewer**：最终面向用户的摘要与复盘口径（根因聚类、可落地项、精简回归）。

## 任务与路径

通过 MCP 验证已部署 **管理后台**。**路径须写清最终选用：** 测试 `docs/{{gitBranch}}/TEST.md`，登录与基址 `docs/{{gitBranch}}/login.md`。

**纳入范围（须同时满足；否则 skipped 写原因）：** 类型=管理后台（其它端→「非本节点范围」）；P0（无列则最高/阻塞发布等价并说明）；仅正向场景；勿滥用 `new_page`/`isolatedContext`（确需写明原因）。

## ReAct 与工具映射

- **Observation：** `take_snapshot`；必要时 `list_network_requests`、`list_console_messages`
- **Action：** `click`、`fill`/`fill_form`、`navigate_page` 等；立即采集证据
- **Recover：** 关弹层 → 重开入口 → 重放
- **Verify：** 快照 + `get_network_request` + `evaluate_script`

**循环：** Thought 先判卡点（数据/外部依赖/能力/权限/交互）；阻碍优先；每轮**单变量**。弹窗先关；数据不符则换样本（`PASS（样本偏离）` 须写原因）；遮挡则恢复可交互；不改 case 目标与核心断言。

## 解阻与上限

单卡点最多 3 轮；contract 允许时 `3×N`。与「主循环最多 8 次」取**更严**；达 contract 停止条件或触顶时落 `BLOCKED_*` 或说明截断。

## 单条输出（必填）

`Result`（PASS / PASS（样本偏离）/ FAIL / BLOCKED_*）· `SamplePath` · `Observation` · `Action` · `De-block`（cycle/round/variable/deltaEvidence/riskCheck）· `Verify` · `关键请求` · `结论依据`。

证据：网络（reqid/endpoint 按 contract）、页面状态、数据对比；有写操作须回滚证据。

## 项目信息

项目 {{projectName}} · 任务 {{taskTitle}} · 分支 {{gitBranch}} · 工作目录 {{gitWorktreePath}}

## 最终输出（禁止只报数字不报原因）

1. 摘要：条数、阶段、PASS/FAIL/BLOCKED 分布  
2. 失败/blocked：根因（DATA/EXT_DEP/CAPABILITY_GAP/PERMISSION/INTERACTION）与共性 1～3 条  
3. Findings（F1…）  
4. 可模板化 / 需工程化修复项（无则「无」）  
5. 回归：先 2 条难例再扩量  
