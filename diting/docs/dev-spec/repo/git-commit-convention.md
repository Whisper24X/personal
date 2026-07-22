# Git 提交说明规范（Conventional Commits）

本仓库通过根目录 `commitlint`（`@commitlint/config-conventional`）校验每次提交的说明。Agent 或开发者起草 `git commit -m` 前，应遵循本文格式，避免 `commit-msg` hook 拒绝提交。

相关门禁说明见 [Git 提交质量门禁](./git-commit-quality-gates.md)。

## Cursor「生成 commit message」（✨）

Source Control 里的 **生成 commit message** 默认**不会**读取 `.cursor/rules/`，容易产出 `Add ...; enhance ...` 这类会被 `commitlint` 拒绝的说明。

本仓库约定：

1. 根目录 **[`.cursorrules`](../../../.cursorrules)**（legacy，专供 ✨ 生成）——须与本文格式一致。
2. **[`.cursor/rules/git-commit-conventional.mdc`](../../../.cursor/rules/git-commit-conventional.mdc)** ——供 Agent / Chat 代写 commit 使用。

若 ✨ 生成仍不规范：在 Chat 中让 Agent 根据 staged diff 生成完整说明，并用下方「提交前自检」通过后再提交。生成器会参考**已有** git 历史；请保持历史为「header + body」格式。

### 反例与正例

```
# 会被 commitlint 拒绝（无 type）
Add commitlint configuration and update package dependencies; enhance .gitignore and README documentation

# 不推荐（仅标题，多文件变更时信息不足）
chore(repo): add commitlint and husky hooks

# 推荐
chore(repo): add commitlint and husky hooks

- 新增 commitlint.config.js 与 husky commit-msg hook
- 增加 npm run commitlint:check 供提交前预检
- 补充 docs/dev-spec 与 .cursorrules，约束 SCM 生成格式
```

## 格式

```
type(scope): subject

<body：具体变更说明>

[可选 footer]
```

| 项 | 要求 |
|----|------|
| Header | `type(scope): subject`（`scope` 可选） |
| type | 小写，且为下表之一 |
| subject | 非空；不以英文句号 `.` 结尾；宜小写祈使；**概括本次提交，细节放 body** |
| header 长度 | ≤ 100 字符 |
| Body | **本仓库约定为必填**（多文件/多主题时）；与 header 之间**空一行**；宜用 `- ` 列表写清改动点与动机；可用中文 |
| footer | 可选（如 `BREAKING CHANGE:`、`Refs:`）；本仓库已关闭 `body-max-line-length` 行宽限制 |

## type 含义

| type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `docs` | 仅文档 |
| `style` | 不影响语义的格式（空格、分号等） |
| `refactor` | 既非新功能也非修 bug 的重构 |
| `perf` | 性能优化 |
| `test` | 测试增删改 |
| `build` | 构建系统或外部依赖 |
| `ci` | CI 配置与脚本 |
| `chore` | 其他杂项（工具、配置等） |
| `revert` | 回滚某次提交 |

## 建议 scope（monorepo）

非强制，便于区分变更范围：

| scope | 典型路径 |
|-------|----------|
| `server` | `apps/server` |
| `web` | `apps/web` |
| `core` | `packages/core` |
| `plugin-api` | `packages/plugin-api` |
| `repo` | 根 `package.json`、`husky`、`docs/dev-spec`、共享配置 |
| `openspec` | `openspec/` |

跨多个 workspace 时，用影响面最大的 scope，或 `repo`。

## 示例（含 body）

```
feat(server): add task scheduler skeleton

- 在 apps/server 增加调度入口与状态机占位
- 为后续 repair-loop 对接预留 PluginContext 钩子

fix(web): correct tsconfig project references

- 修复 apps/web 引用 packages 时的 composite 路径
- 恢复 npm run type-check:web 通过

chore(repo): wire husky and commitlint

- 配置 pre-commit 跑 quality-gate（type-check）
- 配置 commit-msg 跑 commitlint
```

## 提交前自检

将**完整**说明（header + 空行 + body）写入临时文件（勿加 `#` 注释行），在仓库根目录执行：

```bash
cat > /tmp/commit-msg.txt <<'EOF'
chore(repo): your subject here

- 变更点 1
- 变更点 2
EOF
npm run commitlint:check -- /tmp/commit-msg.txt
```

退出码为 `0` 后执行 `git commit -F /tmp/commit-msg.txt`（多行含 body 时优先用 `-F`，勿仅用 `-m` 单行）。

## 常见失败原因

| commitlint 报错 | 处理 |
|-----------------|------|
| `type-empty` | 补上 `type:`，如 `feat:` |
| `type-enum` | type 不在允许列表中，改用上表中的 type |
| `subject-empty` | 在冒号后写 subject |
| `subject-full-stop` | 去掉 subject 末尾的 `.` |
| `subject-case` | subject 改为小写祈使，避免 `Add Foo` 式标题 |
| `header-max-length` | 缩短 header 至 100 字符以内 |
