# 阶段 4 验证报告

## 验证结果

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| 后端计划内测试 | `npm run test -w apps/server -- packages/core/src/titing/plugin-runtime.spec.ts apps/server/src/titing/repositories.spec.ts apps/server/src/titing/plugins.spec.ts apps/server/src/titing/external-plugins.spec.ts packages/core/src/titing/services.spec.ts packages/core/src/titing/run-observability.spec.ts` | 通过：6 suites / 175 tests |
| 前端 App 测试 | `npm run test -w apps/web -- src/App.spec.tsx` | 通过：18 tests |
| 类型检查 | `npm run type-check` | 通过：server + web |
| 全量测试 | `npm test` | 通过：server 15 suites / 216 tests，web 18 tests |
| IDE 诊断 | `ReadLints` | 无错误 |
| OpenSpec strict validate | `openspec validate "add-openspec-autonomous-completion-gate" --strict` | 通过 |

## 失败与修复记录

- 后端聚合测试首次在沙箱内失败，原因是测试需要在临时目录创建 git hooks 和 `.cursor` 目录，沙箱返回 `EPERM`；使用非沙箱权限重跑后通过。
- `npm test` 首次失败于 migration 重复列：`001_initial.sql` 与 `006_repair_goal_metadata.sql` 同时添加 `metadata_json`。已改为只由 `006` 执行增量迁移，重跑通过。
- 前端 App 测试首次因新增插件链节点导致“本次参与”出现多次而失败。已将断言改为 `getAllByText`，重跑通过。
- OpenSpec strict validate 首次失败于 `NonOpenSpecGateSkip` requirement 缺少 `SHALL` / `MUST`，已修正 spec 文案后重跑通过。
