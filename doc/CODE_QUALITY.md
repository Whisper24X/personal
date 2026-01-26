# 代码质量工具配置

本项目已配置 ESLint、Prettier、Husky、lint-staged 和 Commitlint 来确保代码质量和提交规范。

## 工具说明

### ESLint

用于 TypeScript/JavaScript 代码的静态分析和错误检查。

### Prettier

用于统一代码格式化风格。

### Husky + lint-staged

在 git commit 前自动对暂存的文件进行 lint 和格式化。

### Commitlint + Commitizen

规范 Git 提交信息格式，使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

## 配置文件

### 根目录

- `.prettierrc` - Prettier 全局配置
- `.prettierignore` - Prettier 忽略文件
- `.husky/pre-commit` - Git pre-commit 钩子
- `.husky/commit-msg` - Git commit-msg 钩子
- `commitlint.config.js` - Commitlint 配置
- `package.json` - lint-staged 和 commitizen 配置

### Backend

- `.eslintrc.cjs` - ESLint 配置（TypeScript）
- `.prettierrc` - Prettier 配置

### Frontend

- `.eslintrc.cjs` - ESLint 配置（Vue 3 + TypeScript）
- `.prettierrc` - Prettier 配置

## 可用命令

### 根目录

```bash
# 检查所有子项目的代码
pnpm lint

# 自动修复所有子项目的代码问题
pnpm lint:fix

# 格式化所有代码
pnpm format

# 检查代码格式
pnpm format:check

# 使用交互式提交工具（推荐）
pnpm commit
```

### Backend

```bash
cd backend

# 检查代码
pnpm lint

# 自动修复代码问题
pnpm lint:fix

# 格式化代码
pnpm format

# 检查代码格式
pnpm format:check
```

### Frontend

```bash
cd frontend

# 检查代码
pnpm lint

# 自动修复代码问题
pnpm lint:fix

# 格式化代码
pnpm format

# 检查代码格式
pnpm format:check
```

## 提交前校验

当执行 `git commit` 时，Husky 会自动触发两个钩子：

### 1. pre-commit 钩子

对暂存的文件运行 lint-staged：

- `backend/**/*.{ts,js}` → ESLint + Prettier
- `frontend/**/*.{ts,tsx,js,jsx,vue}` → ESLint + Prettier
- `shared/**/*.{ts,js}` → Prettier
- `**/*.{json,md}` → Prettier

### 2. commit-msg 钩子

验证提交信息格式是否符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

如果任一检查失败，提交会被中止。

## Git 提交规范

本项目使用 Conventional Commits 规范。详细说明请查看 [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md)。

### 快速开始

**推荐使用交互式提交工具：**

```bash
# 添加文件到暂存区
git add .

# 使用交互式提交
pnpm commit
```

**或手动编写符合规范的提交信息：**

```bash
git commit -m "feat(backend): add user authentication API"
```

### 提交类型

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `build`: 构建系统
- `ci`: CI 配置
- `chore`: 其他杂项
- `revert`: 回滚

### 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

示例：

```
feat(backend): add user authentication API

- Implement JWT authentication
- Add login validation
- Create user session management

Closes #123
```

## 规则说明

### ESLint 规则

- 使用 TypeScript 推荐规则
- 未使用的变量会报错（以 `_` 开头的除外）
- console.log 会警告（console.warn 和 console.error 除外）
- any 类型会警告

### Prettier 规则

- 使用分号
- 单引号
- 每行最大 150 字符
- 使用 2 空格缩进
- 使用 ES5 尾逗号
- 使用 LF 换行符

### Commitlint 规则

- type: 必填，必须是预定义的类型之一
- scope: 可选，影响范围
- subject: 必填，简短描述，不超过 100 字符
- body: 可选，详细描述
- footer: 可选，关联的 Issue 或 Breaking Changes

## 配置 lint-staged

lint-staged 配置位于根目录 `package.json` 中：

```json
"lint-staged": {
  "backend/**/*.{ts,js}": [
    "pnpm --filter @mind2build/backend exec eslint --fix",
    "prettier --write"
  ],
  "frontend/**/*.{ts,tsx,js,jsx,vue}": [
    "pnpm --filter @mind2build/frontend exec eslint --fix",
    "prettier --write"
  ],
  "shared/**/*.{ts,js}": [
    "prettier --write"
  ],
  "**/*.{json,md}": [
    "prettier --write"
  ]
}
```

## 跳过钩子

在特殊情况下（不推荐），可以使用以下命令跳过钩子：

```bash
# 跳过所有钩子
git commit --no-verify -m "your message"

# 或只跳过 pre-commit 但保留 commit-msg 验证
git commit -n -m "feat: your message"
```

⚠️ **注意**: 除非必要，否则不建议跳过验证。

## 常见问题

### Q: 如何在 VS Code 中使用？

A: 安装以下插件：

- ESLint
- Prettier - Code formatter

并在 VS Code 设置中启用 "Format On Save"。

### Q: pre-commit 钩子没有运行？

A: 确保已经安装依赖：

```bash
pnpm install
```

### Q: 如何更新规则？

A: 编辑对应的配置文件：

- ESLint: `.eslintrc.cjs`
- Prettier: `.prettierrc`
- Commitlint: `commitlint.config.js`

### Q: 提交信息验证失败？

A: 确保提交信息符合 Conventional Commits 规范。使用 `pnpm commit` 可以通过交互式工具生成符合规范的提交信息。

### Q: 如何查看提交规范？

A: 查看 [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md) 获取详细的提交规范说明和示例。

## 相关文档

- [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md) - Git 提交规范详细说明
- [Conventional Commits](https://www.conventionalcommits.org/) - 提交规范官方文档
- [Commitlint](https://commitlint.js.org/) - Commitlint 官方文档
