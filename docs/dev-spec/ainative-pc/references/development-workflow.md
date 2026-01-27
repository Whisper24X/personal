# 开发流程

## 环境准备
- Node 版本以 `package.json` 的 `engines` 为准
- 包管理工具使用 `pnpm`

## 本地开发
1. 安装依赖：`pnpm install`
2. 启动开发：`pnpm dev`
3. 访问地址：`http://localhost:5173`

## 提交前自检
- 代码检查：`pnpm lint`
- 类型检查：`pnpm type-check`
- 单元测试：`pnpm test:unit`
- 端到端测试：`pnpm test:e2e`（首次需 `pnpm exec playwright install`）

## 环境变量
- Vite 通过 `.env` / `.env.local` 读取环境变量
- 仅以 `VITE_` 开头的变量会暴露给前端代码
