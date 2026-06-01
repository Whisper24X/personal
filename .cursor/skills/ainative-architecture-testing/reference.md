# 参考与路径索引（AINative）

## 本仓库 Canonical 文档

| 用途 | 路径 |
|------|------|
| 功能模块图（Mermaid + 映射表） | `docs/architecture/functional-modules.md` |
| 开发规范索引 | `docs/dev-spec/README.md` |
| 无 PRD 核心用例正文 | `docs/testing/core-use-cases.md` |
| XMind 生成脚本 | `docs/testing/build-core-use-cases-xmind.py` |
| 脑图产物 | `docs/testing/core-use-cases.xmind` |
| OPML 备用 | `docs/testing/core-use-cases.opml` |
| 对齐测试报告（可选，若已生成） | `docs/testing/core-use-cases-test-report.md` |
| Agent 入口 | `AGENTS.md` |

## 与 `.agents/skills` 子技能的关系

本合并技能与下列目录**内容一致、路径不同**；以仓库内 `.agents/skills/...` 为长期维护副本时，可二选一加载：

- `/.agents/skills/project-functional-map/` — 功能模块图专项
- `/.agents/skills/xmind-zen-export/` — XMind Zen 专项

根目录 `ainative-architecture-testing/` 便于**整包复制**到其他项目或 skills.sh 发布。

## 框架入口速查（扫新项目时）

| 栈 | 后端 / 服务 | 前端路由 |
|----|-------------|----------|
| NestJS | `backend/src/app.module.ts` | — |
| Vue + Vue Router | — | `frontend/src/router/routes/*.ts` |
| Monorepo | 根 `package.json` workspaces | 各包 `apps/web` 等 |

## XMind Zen 包结构（摘要）

```
*.xmind (ZIP)
├── content.json
├── manifest.json
└── metadata.json
```

主题节点：`id`、`class: "topic"`、`title`、`children.attached`；链式用例伪代码见原 `xmind-zen-export/reference.md`。

## E2E 与 Playwright（本仓库）

- 配置：`frontend/playwright.config.ts`（`baseURL` 与 Vite 端口一致，默认 8000）
- 冒烟：`frontend/e2e/smoke.spec.ts`

## 上游参考

- [xmindmark xmindmark-to-xmind.ts](https://github.com/xmindltd/xmindmark/blob/main/src/lib/xmindmark-to-xmind.ts)
