# 开发环境配置

## 前置要求

### 必需工具

| 工具 | 版本要求 | 说明 |
|-----|---------|------|
| Node.js | >= 20.19.0 | JavaScript 运行环境 |
| pnpm | >= 8.8.0 | 包管理工具 |
| Git | 最新版本 | 版本控制 |
| VS Code | 最新版本 | 推荐编辑器 |

### 推荐工具

- **浏览器**: Chrome / Edge (最新版本)
- **终端**: iTerm2 (Mac) / Windows Terminal (Windows)
- **Git 客户端**: SourceTree / GitKraken (可选)

---

## 环境安装

### 1. 安装 Node.js

#### macOS / Linux

使用 nvm 安装:

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装 Node.js
nvm install 20
nvm use 20

# 验证安装
node -v  # v20.19.0 或更高
npm -v
```

#### Windows

1. 下载 Node.js 安装包: https://nodejs.org/
2. 运行安装程序
3. 验证安装:

```bash
node -v
npm -v
```

### 2. 安装 pnpm

```bash
# 使用 npm 安装
npm install -g pnpm@latest

# 验证安装
pnpm -v  # 8.8.0 或更高
```

### 3. 配置 pnpm

```bash
# 设置淘宝镜像（可选，提升国内下载速度）
pnpm config set registry https://registry.npmmirror.com

# 查看配置
pnpm config get registry
```

---

## 项目初始化

### 1. 克隆项目

```bash
# HTTPS 方式
git clone https://your-git-server.com/ainative-shadow.git

# SSH 方式
git clone git@your-git-server.com:ainative-shadow.git

# 进入项目目录
cd ainative-shadow
```

### 2. 安装依赖

```bash
# 安装项目依赖
pnpm install

# 如果遇到网络问题，可以清除缓存后重试
pnpm store prune
pnpm install
```

### 3. 环境变量配置

创建 `.env.development` 文件（开发环境）:

```bash
# 应用版本
VITE_VERSION=0.0.1

# 开发服务器端口
VITE_PORT=3000

# 应用基础路径
VITE_BASE_URL=/

# API 基础路径
VITE_API_URL=http://localhost:8080

# API 代理目标地址
VITE_API_PROXY_URL=http://localhost:8080

# 是否携带凭证
VITE_WITH_CREDENTIALS=true
```

创建 `.env.production` 文件（生产环境）:

```bash
# 应用版本
VITE_VERSION=0.0.1

# 应用基础路径
VITE_BASE_URL=/

# API 基础路径
VITE_API_URL=https://api.example.com

# 是否携带凭证
VITE_WITH_CREDENTIALS=true
```

### 4. 启动开发服务器

```bash
# 启动开发服务器
pnpm dev

# 服务器启动后，访问 http://localhost:3000
```

---

## VS Code 配置

### 1. 安装推荐插件

在 VS Code 中按 `Ctrl/Cmd + Shift + P`，输入 `Extensions: Show Recommended Extensions`，安装以下插件:

- **Vue Language Features (Volar)**: Vue 3 语言支持
- **TypeScript Vue Plugin (Volar)**: Vue 的 TypeScript 支持
- **ESLint**: 代码检查
- **Prettier**: 代码格式化
- **Stylelint**: 样式检查
- **GitLens**: Git 增强
- **Path Intellisense**: 路径智能提示
- **Auto Rename Tag**: 自动重命名标签
- **CSS Peek**: CSS 类名跳转

### 2. VS Code 设置

在项目根目录创建 `.vscode/settings.json`:

```json
{
  // 编辑器配置
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.fixAll.stylelint": "explicit"
  },
  "editor.tabSize": 2,
  
  // Vue 配置
  "vue.server.hybridMode": false,
  
  // TypeScript 配置
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  
  // 文件关联
  "files.associations": {
    "*.vue": "vue"
  },
  
  // 排除文件
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true,
    "**/node_modules": true,
    "**/dist": true
  },
  
  // Stylelint 配置
  "stylelint.validate": ["css", "scss", "vue"],
  
  // ESLint 配置
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
    "vue"
  ]
}
```

### 3. 代码片段

创建 `.vscode/vue.code-snippets`:

```json
{
  "Vue Component": {
    "prefix": "vue3",
    "body": [
      "<script setup lang=\"ts\">",
      "import { ref } from 'vue'",
      "",
      "$0",
      "</script>",
      "",
      "<template>",
      "  <div>",
      "    ",
      "  </div>",
      "</template>",
      "",
      "<style scoped lang=\"scss\">",
      "",
      "</style>"
    ],
    "description": "Vue 3 组件模板"
  }
}
```

---

## 常用命令

### 开发命令

```bash
# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 构建移动端版本
pnpm build:mobile

# 预览构建结果
pnpm serve
```

### 代码检查

```bash
# ESLint 检查
pnpm lint

# ESLint 自动修复
pnpm fix

# Prettier 格式化
pnpm lint:prettier

# Stylelint 检查并修复
pnpm lint:stylelint

# Lint-staged（提交前检查）
pnpm lint:lint-staged
```

### Git 提交

```bash
# 使用 Commitizen 规范提交
pnpm commit

# 或直接使用 git commit
git commit -m "feat: 新增用户管理功能"
```

### 依赖管理

```bash
# 安装依赖
pnpm install

# 添加依赖
pnpm add package-name

# 添加开发依赖
pnpm add -D package-name

# 更新依赖
pnpm update

# 移除依赖
pnpm remove package-name
```

---

## 开发工作流

### 1. 创建分支

```bash
# 从 main 分支创建新分支
git checkout main
git pull
git checkout -b feature/user-management
```

### 2. 开发功能

```bash
# 启动开发服务器
pnpm dev

# 开发过程中实时检查
pnpm lint
```

### 3. 提交代码

```bash
# 查看修改
git status

# 添加文件
git add .

# 提交（使用 commitizen）
pnpm commit

# 或直接提交
git commit -m "feat: 新增用户管理功能"

# 推送到远程
git push origin feature/user-management
```

### 4. 代码审查

提交 Pull Request / Merge Request，等待团队成员审查。

### 5. 合并代码

审查通过后，合并到主分支。

---

## 常见问题

### Q1: pnpm install 失败？

**A**: 尝试以下方法:

```bash
# 清除缓存
pnpm store prune

# 删除 node_modules 和 pnpm-lock.yaml
rm -rf node_modules pnpm-lock.yaml

# 重新安装
pnpm install

# 如果还是失败，切换镜像源
pnpm config set registry https://registry.npmmirror.com
```

### Q2: 启动项目报错？

**A**: 检查以下几点:

1. Node.js 版本是否符合要求（>= 20.19.0）
2. pnpm 版本是否符合要求（>= 8.8.0）
3. 是否正确配置了 `.env.development` 文件
4. 端口 3000 是否被占用

```bash
# 检查端口占用（macOS/Linux）
lsof -i :3000

# 检查端口占用（Windows）
netstat -ano | findstr :3000
```

### Q3: ESLint 报错？

**A**: 
1. 确保已安装 ESLint 插件
2. 重启 VS Code
3. 运行 `pnpm lint:fix` 自动修复

### Q4: Git 提交被 Husky 拦截？

**A**: 
1. 检查代码是否通过 ESLint 检查
2. 检查提交信息格式是否符合规范
3. 运行 `pnpm lint:fix` 修复问题后重新提交

### Q5: 本地开发如何调试后端接口？

**A**: 配置代理:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
```

---

## 性能优化建议

### 1. 使用 pnpm 而不是 npm/yarn

pnpm 使用符号链接，节省磁盘空间，安装速度更快。

### 2. 启用 HTTP 缓存

在 `.npmrc` 中配置:

```
store-dir=~/.pnpm-store
```

### 3. 使用镜像加速

```bash
pnpm config set registry https://registry.npmmirror.com
```

---

## 调试技巧

### 1. Chrome DevTools

- **Elements**: 查看 DOM 结构和样式
- **Console**: 查看日志和错误
- **Network**: 查看网络请求
- **Vue DevTools**: 查看 Vue 组件状态

### 2. VS Code 调试

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/src"
    }
  ]
}
```

### 3. 断点调试

在代码中添加 `debugger` 语句:

```typescript
const handleClick = () => {
  debugger  // 浏览器会在这里暂停
  console.log('clicked')
}
```

---

## 相关文档

- [架构概览](architecture.md)
- [开发指南](../README.md)
- [代码规范](code-standards.md)
