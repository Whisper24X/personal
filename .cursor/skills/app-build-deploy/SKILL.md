---
name: app-build-deploy
description: ainative-app 小程序编译打包部署。支持多环境（test/stage/production）构建、本地构建、体验版上传。当用户提到"小程序构建"、"小程序部署"、"app 打包"、"编译小程序"或需要构建发布小程序时使用。
---

# ainative-app 小程序构建部署

ainative-app 是基于 Taro + Vue3 的跨平台小程序项目，支持微信、H5、支付宝等多端。

## 快速开始

根据用户需求选择对应操作：

| 操作 | 使用场景 |
|------|---------|
| 本地构建 | 开发调试、验证构建 |
| 体验版上传 | 测试验证、产品体验 |
| CI/CD 部署 | 自动化部署（无需手动操作） |

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

## 操作 2: 体验版上传

构建并上传到微信后台，生成体验版二维码供测试。

### 前置条件检查

**必须验证以下配置文件存在**：

1. **CI 配置文件**
   - 测试环境：`ainative-app/ci.test.config.js`
   - 生产/预发：`ainative-app/ci.config.js`

2. **私钥文件**
   - 路径：`ainative-app/key/private.wx*.key`
   - 必须与 CI 配置中的 `WEAPP_PRIVATE_KEY_PATH` 一致

3. **配置文件格式**

```javascript
module.exports = {
  WEAPP_APPID: "wx60377e5c4f19d3be",                    // 小程序 AppID
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx*.key",        // 私钥路径
  WEAPP_VERSION: "1.1.8",                                // 版本号
  WEAPP_DESC: "修复异常问题，支持配置商品协议、优化部分体验"  // 版本描述
}
```

### 上传命令

```bash
cd ainative-app

# 测试环境体验版
npm run ci:weapp:upload:test

# 预发环境体验版
npm run ci:weapp:upload:stage

# 生产环境体验版
npm run ci:weapp:upload:production
```

### 执行超时设置

- 首次构建：`block_until_ms: 180000`（3 分钟）
- 增量构建：`block_until_ms: 120000`（2 分钟）

### 成功标识

输出包含以下信息表示成功：

```
✅ 上传成功
版本: 1.1.8
描述: xxx
体验版二维码已生成
```

## 操作 3: CI/CD 自动部署

项目暂无 GitLab CI 配置，小程序通常采用手动构建上传方式。

如需自动化部署，可在 GitLab CI 中配置：

```yaml
【测试环境】小程序上传:
  stage: deploy_test
  only:
    - test
  script:
    - cd ainative-app
    - npm install
    - npm run ci:weapp:upload:test
  tags:
    - ops
```

## 常见问题处理

### 问题 1: 私钥文件不存在

```
错误: privateKeyPath 文件不存在
```

**解决**：
1. 检查 `ainative-app/key/` 目录
2. 确认私钥文件名与配置一致
3. 从微信公众平台下载私钥放置到 `key/` 目录

### 问题 2: AppID 不匹配

```
错误: appid 不正确
```

**解决**：
1. 对比 `ci.config.js` 中的 `WEAPP_APPID`
2. 与 `project.config.json` 中的 `appid` 保持一致

### 问题 3: 构建失败

```
错误: Build failed
```

**解决**：
1. 先执行 `npm run build:weapp:test` 验证构建
2. 检查代码是否有 TypeScript/ESLint 错误
3. 确认依赖已安装：`npm install`

### 问题 4: 版本冲突

```
错误: 该版本号已存在
```

**解决**：
1. 更新 `ci.config.js` 中的 `WEAPP_VERSION`
2. 遵循语义化版本号：`major.minor.patch`

## 版本管理建议

每次上传体验版前：

1. **更新版本号**
   - 修改 `ci.config.js` 的 `WEAPP_VERSION`
   - 遵循：`1.1.8` → `1.1.9`

2. **填写版本描述**
   - 更新 `WEAPP_DESC`
   - 简要说明更新内容

3. **环境隔离**
   - 测试环境使用 `ci.test.config.js`
   - 生产/预发使用 `ci.config.js`

## 项目结构

```
ainative-app/
├── src/                    # 源码目录
├── dist/                   # 构建产物
├── config/                 # 构建配置
│   └── index.ts           # Taro 配置入口
├── key/                    # 私钥目录（不提交 Git）
│   └── private.wx*.key    # 微信小程序私钥
├── ci.config.js           # CI 配置（生产/预发）
├── ci.test.config.js      # CI 配置（测试）
├── project.config.json    # 微信开发者工具配置
└── package.json           # 依赖和脚本
```

## 相关文档

- [Taro 文档](https://taro-docs.jd.com/)
- [Taro CI 插件](https://taro-docs.jd.com/docs/plugin-mini-ci)
- [微信小程序 CI](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)
- app-dev skill: 小程序开发规范
- app-preview skill: 体验版生成专用

## 注意事项

1. **私钥安全**：私钥文件已在 `.gitignore`，不要提交到代码库
2. **环境隔离**：确认使用正确的环境配置
3. **版本递增**：每次上传前检查版本号
4. **权限验证**：确保私钥有上传权限
5. **构建清理**：问题时删除 `dist/` 后重新构建
