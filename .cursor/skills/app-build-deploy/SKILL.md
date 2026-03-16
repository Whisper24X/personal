---
name: app-build-deploy
description: ainative-app 小程序编译打包部署。支持多环境（test/stage/production）构建、本地构建。当用户提到"小程序构建"、"小程序部署"、"app 打包"、"编译小程序"或需要构建发布小程序时使用。
---

# ainative-app 小程序构建部署

ainative-app 是基于 Taro + Vue3 的微信小程序项目。

## 快速开始

根据用户需求选择对应操作：

| 操作 | 使用场景 |
|------|---------|
| 本地构建 | 开发调试、验证构建 |

## 操作 1: 本地构建

用于本地开发和构建验证，不上传到微信后台。

### 构建命令

```bash
# 进入项目目录
cd ainative-app

# 开发环境构建（未压缩）
npm run build:weapp

# 测试环境构建
npm run build:weapp:test

# 预发环境构建
npm run build:weapp:stage

# 生产环境构建
npm run build:weapp:production
```

### 构建产物

构建完成后，代码输出到 `ainative-app/dist/` 目录。

### 本地预览

使用微信开发者工具打开 `ainative-app/dist/` 目录进行预览。

### 环境差异

| 环境 | 特点 | API 地址 |
|------|------|---------|
| development | 代码未压缩，保留调试信息 | 开发环境 API |
| test | 测试环境配置 | 测试环境 API |
| stage | 预发环境配置 | 预发环境 API |
| production | 代码压缩混淆 | 生产环境 API |

## 常见问题处理

### 问题 1: 构建失败

```
错误: Build failed
```

**解决**：
1. 先执行 `npm run build:weapp:test` 验证构建
2. 检查代码是否有 TypeScript/ESLint 错误
3. 确认依赖已安装：`npm install`

## 项目结构

```
ainative-app/
├── src/                    # 源码目录
├── dist/                   # 构建产物
├── config/                 # 构建配置
│   └── index.ts           # Taro 配置入口
├── project.config.json    # 微信开发者工具配置
└── package.json           # 依赖和脚本
```

## 相关文档

- [Taro 文档](https://taro-docs.jd.com/)
- app-dev skill: 小程序开发规范

## 注意事项

1. **环境隔离**：确认使用正确的环境配置
2. **构建清理**：问题时删除 `dist/` 后重新构建
