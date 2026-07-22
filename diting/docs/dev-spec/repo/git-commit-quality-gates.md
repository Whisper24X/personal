# Git 提交质量门禁

仓库根目录统一安装并维护 Git hooks（与 ainative `docs/dev-spec/repo/git-commit-quality-gates.md` 对齐，按本 monorepo 的 npm workspaces 适配）。

## 要求

- 在仓库根目录执行 `npm install`，以便 `husky` 通过根 `package.json` 的 `prepare` 脚本安装 hooks。
- 每次提交必须通过根目录 `pre-commit` 门禁。
- 根 `pre-commit` 执行：`npm run quality-gate`。
- 根 `quality-gate` 当前执行：
  - `npm run type-check`（`apps/server` + `apps/web`）
- 根 `type-check` 执行：
  - `apps/server`：`type-check`（`tsc --noEmit`，含 `packages/core`、`packages/plugin-api` 源码路径）
  - `apps/web`：`type-check`（`tsc -b`）
- 提交说明须通过根 `commit-msg` hook 与 `commitlint`（Conventional Commits）。格式与示例见 [Git 提交说明规范](./git-commit-convention.md)；提交前可用 `npm run commitlint:check -- <file>` 预检。
- Source Control「生成 commit message」须遵循根目录 `.cursorrules`（见 [Git 提交说明规范](./git-commit-convention.md) 中「Cursor 生成 commit message」一节）。

## 说明

- 勿在 `apps/server`、`apps/web` 或 `packages/*` 下单独维护第二套 hook 入口。
- 若新增 workspace 需要在提交时校验，应接入根 `quality-gate`，而不是再挂一条 hook 链。
- 本仓库尚未配置 ESLint 等 lint 脚本；待引入后应在根 `quality-gate` 中串联，勿在子包重复挂 hook。
- 运行时 `default-quality` 插件与提交 hook 分工不同：插件按四层质量模型评分，第一层为 `type-check`、`lint`、`git-diff` 等静态检测，第二层为单元测试，第三层为 `build` 与启动/冒烟测试，第四层只读取开发流程已产出的 API/UI 自动化测试报告指标，不在质量插件内重新执行自动化测试。
