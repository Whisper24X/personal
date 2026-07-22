# Improve Analyze

## 目标

把 `testReview.md` / `Improve Review Bridge` 转成结构化问题清单，保留全部 pending issue 字段并排序。

## 必须保留

- issueId
- title
- severity
- scope
- rootCauseHint
- suggestedAction
- rerunScope
- evidence

## 输出

- `improveAnalyzeResult.md`

## 约束

- 不丢字段
- 不改变 issue 顺序语义
- 对 UI 自动化失败，只输出可修复分析，不下最终完成结论
