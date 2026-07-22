# Improve Execute

## 目标

基于 `improveAnalyzeResult.md` 做最小修复，并回写根因字段。

## 必须写回

- `resolution_note`
- `root_cause_summary`
- `evidence`

## 输出

- `improveExecuteResult.md`

## 约束

- 先根因调查，再改代码
- 只修一个根因
- 不做大范围重构
- 修复后必须给出可交给 run 的 rerun scope
