# backend-dev 脚本说明

本目录存放 `backend-dev` 技能使用的验证脚本。由于目录已经限定在后端技能下，脚本名不再添加 `backend` 前缀。

## 命名规则

脚本名统一使用：

```text
<domain>-<action>.sh
```

字段说明：

- `domain`：脚本负责的检查领域，例如 `compliance`、`flow`、`artifacts`、`docs`。
- `action`：脚本角色。
  - `verify`：可直接执行的验证入口。
  - `check`：被入口脚本 `source` 的专项检查模块，不建议单独执行。
  - `context`：公共上下文、变量和函数，不做具体检查。

## 可直接执行

```bash
./scripts/compliance-verify.sh --backend-dir <backend-dir> --task-type <type>
./scripts/flow-verify.sh --backend-dir <backend-dir>
./scripts/artifacts-verify.sh <backend-dir>
./scripts/docs-verify.sh <backend-dir>
```

脚本用途：

- `compliance-verify.sh`：合规验证总入口，检查本次后端变更是否偏离 `backend-dev` 规则。
- `flow-verify.sh`：检查后端基础工件和可选 HTTP Gateway 注册。
- `artifacts-verify.sh`：检查构建产物、历史残留目录、过期命令和文档一致性。
- `docs-verify.sh`：检查技能文档、模板、Markdown 链接、Makefile target 和历史措辞。

## 被入口加载

以下脚本由 `compliance-verify.sh` 加载，不直接执行：

- `compliance-context.sh`：公共上下文、路径解析、Git diff 和错误收集。
- `compliance-core-check.sh`：核心工件检查，包括构建产物、HTTP 注册、Biz 常量和生成文件风险。
- `compliance-generation-check.sh`：Proto/API 与 GORM 生成一致性检查。
- `compliance-http-rpc-check.sh`：第三方 HTTP RPC 写法、Resty、ProviderSet 和 Wire 检查。

## 维护要求

- 新增可执行验证入口时，使用 `*-verify.sh`。
- 新增被入口加载的专项检查时，使用 `*-check.sh`。
- 新增公共函数或上下文时，使用 `*-context.sh`。
- 每个脚本顶部必须包含 `说明`、`用途`，并说明是否可直接执行。
- 新增脚本后，需要更新本文件和 `SKILL.md` 中的脚本清单。
