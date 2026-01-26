# 代码质量工具配置

本项目已配置 ESLint、Prettier 和 Husky 提交前校验。

## 工具说明

### ESLint

用于 TypeScript/JavaScript 代码的静态分析和错误检查。

### Prettier

用于统一代码格式化风格。

### Husky + lint-staged

在 git commit 前自动对暂存的文件进行 lint 和格式化。

## 配置文件

### 根目录

- `.prettierrc` - Prettier 全局配置
- `.prettierignore` - Prettier 忽略文件
- `.husky/pre-commit` - Git pre-commit 钩子
- `package.json` - lint-staged 配置

### Backend

- `.eslintrc.js` - ESLint 配置（TypeScript）
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

当执行 `git commit` 时，Husky 会自动触发 pre-commit 钩子：

1. 对暂存的文件运行 lint-staged
2. 根据文件类型执行相应的命令：
   - `backend/**/*.{ts,js}` → ESLint + Prettier
   - `frontend/**/*.{ts,tsx,js,jsx,vue}` → ESLint + Prettier
   - `shared/**/*.{ts,js}` → Prettier
   - `**/*.{json,md}` → Prettier
3. 如果检查通过，提交成功
4. 如果检查失败，提交会被中止

## 规则说明

### ESLint 规则

- 使用 TypeScript 推荐规则
- 未使用的变量会报错（以 `_` 开头的除外）
- console.log 会警告（console.warn 和 console.error 除外）
- any 类型会警告

### Prettier 规则

- 使用分号
- 单引号
- 每行最大 100 字符
- 使用 2 空格缩进
- 使用 ES5 尾逗号
- 使用 LF 换行符

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

## 跳过 pre-commit 钩子

在特殊情况下（不推荐），可以使用以下命令跳过 pre-commit 检查：

```bash
git commit --no-verify -m "your message"
```

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

A: 编辑对应的配置文件（`.eslintrc.js` 或 `.prettierrc`）。
