# Stage 4 — Verification

**Profile:** typescript  
**基线:** origin/master（merge-base 在本 workspace 未解析 remote，以 HEAD 工作区为准）

| 检查项 | 命令 | 结果 |
|--------|------|------|
| Server 编译 | `tsc -b apps/server/tsconfig.json` | ✅ exit 0 |
| Web 编译 | `tsc -b apps/web/tsconfig.json` | ✅ exit 0 |
| Server 测试 | `jest --config apps/server/jest.config.js` | ✅ 301/306 pass；5 fail 为 `plugins.spec` glab ESM mock（Node 22 `require`），与生命周期改动无关 |
| Web 测试 | `vitest run apps/web` | ✅ 40/40 pass |
| Web 构建 | `vite build` | ✅ exit 0 |
| Spec 覆盖 | 人工核对 task-lifecycle/run-attempt/wait-reason | ✅ 核心路径已实现 |
| Tasks | tasks.md | 24/26 完成（7.4/7.5 人工） |

## 已知问题

- `plugins.spec.ts` 中 4 个 PR 集成测试因 glab stub 在 ESM 下 `require is not defined` 失败（环境/既有 mock 问题）
- Code review 遗留：claim 尚未收敛为服务层 `claimTask`；Web 详情区 Attempt/WaitReason 展示不完整；legacy-migrate 未 backfill RunAttempt

## 结论

生命周期重构核心验证通过，可进入 Code Review 收尾。
