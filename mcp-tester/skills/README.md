# Skills 使用说明

本目录包含 3 个面向 Agent 测试工作的 Skill，建议按"编写 -> 执行 -> 复盘优化"的顺序使用。

## Skill 列表

- `testcase-author`
  - 用途：新建/改写用例为 Agent 友好格式
  - 适用：需求新增、旧用例歧义大、执行分歧高
  - 依赖：`_reference/case-template-v2-lite.md`

- `test-executor`
  - 用途：按 V2-Lite 协议执行用例并输出标准记录
  - 适用：批量执行、严格约束回归、需要可审计证据
  - 依赖：`_reference/contract-v2-lite.md`

- `test-reviewer`
  - 用途：基于执行记录复盘，输出可落地优化
  - 适用：通过率低、阻塞多、误判多、需提升解阻率
  - 依赖：无（基于输入的执行记录和 case 文件工作）

## 推荐顺序

1. 先用 `testcase-author` 规范 case。
2. 再用 `test-executor` 执行并沉淀证据。
3. 最后用 `test-reviewer` 做复盘与迭代优化。

## 设计原则

- 每个 Skill 完全自包含，可独立分发使用。
- `_reference/` 存放该 Skill 依赖的协议或模板，属于只读参考文件。
- 不同 Skill 可独立演进各自的 reference 版本。

## 最小工作流

1. 选 1-2 条难例，按 case-template 补齐。
2. 执行时严格记录 `cycle / round / variable / deltaEvidence / riskCheck`。
3. 每轮后确认是否有"新证据增量"，再决定继续或停止。
4. 按 `PASS/FAIL/BLOCKED_*` 落结论并保留最小证据集。
