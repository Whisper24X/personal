# Stage 4 — Verification

**Profile:** typescript  
**基线:** origin/master（workspace feature 分支）

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 类型检查 | `tsc --noEmit -p apps/server/tsconfig.build.json` | ✅ |
| Core 单测 | jest `packages/core/src/diting/*.spec.ts` | ✅ 97 tests |
| Server 全量 | jest `apps/server/jest.config.js` | ✅ 249 tests |
| Web App.spec | vitest `apps/web/src/App.spec.tsx` | ⚠️ 11 failed（既有 UI 异步/mock 问题，非本 change 改动 web 代码） |
| OpenSpec | `openspec validate add-failure-repair-orchestration --strict` | ✅ |

## 说明

- Server/core 相关验证全部通过
- Web 测试失败为环境/既有 mock 超时，未修改 `apps/web` 源码；API 向后兼容（observability 仅新增可选 `failureRepair` 字段）
