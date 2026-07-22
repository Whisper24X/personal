# Stage 6 — Closeout

- OpenSpec validate: `openspec validate add-failure-repair-orchestration --strict` ✅
- 制品目录: `openspec/changes/add-failure-repair-orchestration/` 完整
- tasks.md: 8/8 完成
- 未执行 git commit / push（用户未要求）
- 归档: 请用户在终端执行 `openspec archive add-failure-repair-orchestration --yes`

## 假设与风险

- Web `App.spec.tsx` 在当前环境有 11 项超时失败，未改 web 源码；API 仅新增可选 `failureRepair` 字段，向后兼容
- repair goal 的 objective/constraints 仍由既有 helper 生成，与 `repairPlan` 在 high-risk 场景可能略有差异（SUGGESTION 级）
