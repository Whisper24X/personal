---
name: test-executor
description: 执行测试、跑测试、跑用例、运行测试、执行case、自动化测试、浏览器测试、run test、execute test、按用例测试。使用 chrome-devtools-mcp 操作浏览器，按协议执行测试用例并输出带证据的标准结论。
---

# Test Executor

## 适用时机

- 用户要求按用例执行自动化测试。
- 用户要求"严格按约束执行""先解阻再落 BLOCKED"。
- 用户要求给出可复盘的证据与结论。

## 依赖文件

- `references/contract-v2-lite.md`

## 执行工具

通过 **chrome-devtools-mcp** 操作浏览器执行测试，主要能力分类：

| 类别 | 工具 | 用途 |
|------|------|------|
| 页面导航 | `navigate_page`, `list_pages`, `select_page`, `new_page`, `close_page` | 打开入口、切换标签页 |
| 元素交互 | `click`, `fill`, `fill_form`, `type_text`, `press_key`, `hover`, `drag`, `upload_file` | 表单填写、按钮点击、文件上传等 |
| 页面快照 | `take_snapshot`, `take_screenshot` | 获取 DOM 结构（Observation 证据）、截图取证 |
| 网络证据 | `list_network_requests`, `get_network_request` | 采集 reqid、endpoint、status 等关键网络证据 |
| Console | `list_console_messages`, `get_console_message` | 捕获错误提示与异常 |
| 脚本执行 | `evaluate_script` | DOM 查询、数据回读、状态校验 |
| 等待与弹窗 | `wait_for`, `handle_dialog` | 等待元素/网络就绪、处理 alert/confirm |

### 工具与 ReAct 阶段映射

- **Observation**：`take_snapshot` + `list_network_requests` + `list_console_messages`
- **Action**：`click` / `fill` / `upload_file` / `navigate_page` 等交互工具
- **Recover（自愈）**：`press_key`（关闭弹层）→ `navigate_page`（重开入口）→ 重放
- **Verify**：`take_snapshot`（UI 状态）+ `get_network_request`（网络证据）+ `evaluate_script`（数据回读）

## 执行流程（固定）

1. 读取 contract 与目标 case。
2. 执行 Stage0 预检（数据/权限/入口/能力位）。
3. 按最短路径执行主目标（ReAct）。
4. 命中卡点进入 `3 x N` 解阻：
   - 单卡点最多 3 轮，单变量变更；
   - 有证据增量且风险可控才进入下一循环。
5. 按断言优先原则判定结论。
6. 输出标准记录：`cycle/round/variable/deltaEvidence/riskCheck`。

## 强约束

- 先判完成断言，再判样本路径。
- 允许 `PASS（样本偏离）`，但必须写明偏离原因。
- 不得改动 case 目标与核心断言。
- 无证据不得落结论。

## 输出模板

使用以下结构输出执行结果：

```markdown
## <用例ID> 执行结果
- Result: PASS / PASS（样本偏离） / FAIL / BLOCKED_*
- SamplePath: 优先样本 / 备用样本 / 偏离说明
- Observation:
- Action:
- De-block:
  - cycle=1 round=1 variable=... deltaEvidence=... riskCheck=...
- Verify:
- 关键请求:
- 结论依据:
```
