# 开发流程

## 环境要求
- Node.js >= 20.19.0
- pnpm >= 8.8.0

## 初始化
```bash
cd ainative-shadow
pnpm install
pnpm dev
```

## 常用命令
- `pnpm dev` - 本地开发
- `pnpm build` - 生产构建（含类型检查）
- `pnpm serve` - 本地预览构建产物
- `pnpm lint` - ESLint 检查
- `pnpm fix` - ESLint 自动修复
- `pnpm lint:prettier` - Prettier 格式化
- `pnpm lint:stylelint` - Stylelint 修复
- `pnpm lint:lint-staged` - lint-staged 规则
- `pnpm commit` - 交互式提交（cz-git）
- `pnpm clean:dev` - 清理演示数据（首次初始化可选）

## 日常开发建议
1. 新增页面：`src/views/` 新建页面 → `src/router/modules/` 添加路由 → 多语言补充 `menus.*` 文案
2. 新增接口：`src/api/` 定义接口 → `src/types/api/` 补充类型
3. 新增状态：`src/store/modules/` 新增 Store → 按需设置持久化

## 提交前检查
- 本地运行 `pnpm lint` 与 `pnpm build`
- 样式变更同时检查 `pnpm lint:stylelint`
- 变更菜单/路由时同步更新多语言文件
