# Git Commit 提交规范

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范来统一 Git 提交信息格式。

## 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 1. Type（必填）

提交类型，必须是以下之一：

- **feat**: 新功能（feature）
- **fix**: 修复 bug
- **docs**: 文档更新
- **style**: 代码格式（不影响代码运行的变动，如空格、格式化等）
- **refactor**: 重构（既不是新增功能，也不是修复 bug 的代码变动）
- **perf**: 性能优化
- **test**: 测试相关
- **build**: 构建系统或外部依赖的变动（如 webpack、npm 等）
- **ci**: CI 配置文件和脚本的变动
- **chore**: 其他不修改 src 或 test 的变动
- **revert**: 回滚之前的 commit

### 2. Scope（可选）

提交影响的范围，例如：

- `backend`: 后端相关
- `frontend`: 前端相关
- `api`: API 相关
- `database`: 数据库相关
- `workflow`: 工作流相关
- `role`: 角色系统相关
- `action`: 行动系统相关
- `deps`: 依赖更新

### 3. Subject（必填）

提交的简短描述：

- 使用动词开头，第一人称现在时（如 "change" 而不是 "changed" 或 "changes"）
- 首字母小写
- 结尾不加句号
- 不超过 50 个字符

### 4. Body（可选）

详细描述：

- 解释为什么做这个改动
- 如何解决问题
- 与之前行为的对比

### 5. Footer（可选）

- 关闭的 Issue: `Closes #123`
- Breaking Changes: `BREAKING CHANGE: description`

## 使用方法

### 方法一：使用 Commitizen（推荐）

```bash
# 添加文件到暂存区
git add .

# 使用交互式提交工具
pnpm commit
```

这会启动一个交互式命令行工具，引导你填写规范的提交信息。

### 方法二：手动编写

```bash
git commit -m "feat(backend): add user authentication API"
```

## 提交示例

### 添加新功能

```bash
feat(api): add user login endpoint

- Implement JWT authentication
- Add login validation
- Create user session management

Closes #123
```

### 修复 Bug

```bash
fix(frontend): resolve login form validation error

The email validation was not working correctly when
the user input contained special characters.
```

### 文档更新

```bash
docs: update API documentation for authentication endpoints
```

### 重构代码

```bash
refactor(backend): extract database connection to separate module

Improve code organization and reusability
```

### 性能优化

```bash
perf(workflow): optimize document generation process

- Use streaming for large files
- Implement caching for frequently used templates
- Reduce memory usage by 40%
```

### 样式调整

```bash
style(frontend): format code with prettier
```

### 测试

```bash
test(backend): add unit tests for authentication service
```

### 构建相关

```bash
build(deps): upgrade typescript to 5.3.3
```

### CI/CD 配置

```bash
ci: add automated deployment workflow
```

### 其他杂项

```bash
chore: update .gitignore to exclude log files
```

### Breaking Changes

```bash
feat(api): change authentication API response format

BREAKING CHANGE: The authentication endpoint now returns
a different response structure. Update your client code
to handle the new format.

Before:
{ token: "xxx" }

After:
{ accessToken: "xxx", refreshToken: "yyy" }
```

## 提交验证

项目已配置 commitlint 和 husky，会在提交时自动验证提交信息格式：

1. **commit-msg 钩子**: 验证提交信息格式是否符合规范
2. **pre-commit 钩子**: 运行 lint-staged 检查代码质量

如果提交信息不符合规范，提交会被拒绝，并显示错误信息。

## 常见错误

### ❌ 错误示例

```bash
# type 大写
Feat: add new feature

# 缺少 type
add new feature

# subject 以句号结尾
feat: add new feature.

# subject 太长（超过 100 字符）
feat: this is a very very very very very very very very very very very very very long commit message

# type 不在允许列表中
feature: add new feature
```

### ✅ 正确示例

```bash
feat: add new feature
fix(api): resolve authentication bug
docs: update README
refactor(backend): improve code structure
```

## 配置文件

- `commitlint.config.js`: commitlint 配置
- `.husky/commit-msg`: commit-msg 钩子
- `package.json`: commitizen 配置

## 跳过验证（不推荐）

在特殊情况下，可以跳过提交验证：

```bash
git commit --no-verify -m "your message"
```

⚠️ **注意**: 除非必要，否则不建议跳过验证。

## 相关资源

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Commitlint](https://commitlint.js.org/)
- [Commitizen](https://github.com/commitizen/cz-cli)
