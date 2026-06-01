---
name: test-reviewer
description: 复盘测试、测试复盘、分析测试结果、review测试、测试报告分析、为什么通过率低、为什么阻塞多、优化测试策略、test review、analyze test results。基于执行记录复盘根因，输出可落地的用例与策略优化建议。
---

# Test Reviewer

## 适用时机

- 用户要求回顾测试过程并解释为何首轮通过率低。
- 用户要求优化 case、模板或解阻策略。
- 用户要求提升稳定性与解阻率。

## 依赖文件

- `references/contract-v2-lite.md`（复盘时参考当前协议规则）
- `references/case-template-v2-lite.md`（复盘时参考当前模板结构）

## 输入材料

- 执行记录文件（如 `TEST-初版-自动化执行记录-*.md`）
- case 文件（如 `TEST-初版.md`、`TEST-智能硬件-核心-订单课程商品.md`）

## 复盘流程

1. 统计结论分布：PASS / FAIL / BLOCKED_*。
2. 按根因聚类：
   - 数据门槛（DATA）
   - 外部依赖（EXT_DEP）
   - 能力缺口（CAPABILITY_GAP）
   - 权限（PERMISSION）
   - 交互不稳定（INTERACTION）
3. 判断哪些问题可在模板层解决，哪些需工程化解决。
4. 输出最小改造：
   - contract 规则增量
   - case 模板字段增量
   - 代表用例试点清单
5. 生成回归验证计划（先 2 条难例，再扩全量）。

## 输出结构

```markdown
## Findings（按严重度）
- F1: ...
- F2: ...

## 可模板化修复项
- ...

## 需工程化修复项
- ...

## 建议改动
- contract:
- case-template:

## 回归计划
- P0试点:
- 验证指标:
```
