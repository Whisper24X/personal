# Improve Verify

## 目标

做本地验证与收尾状态标记，不替代 run 的 UI 重跑证据。

## 输出

- `improveVerifyResult.md`

## 状态标记

- 本地修复完成，等待 run 重跑
- 待 run 验证
- run 验证通过，归档完成

## 约束

- UI 重跑未完成时，只能给出中间结论
- run 通过后，才允许更新为归档完成
