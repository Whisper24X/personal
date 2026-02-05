# 使用示例

本文档提供 app-preview 技能的实际使用示例，涵盖各种常见场景。

---

## 场景 1: 首次使用 - 生成测试环境体验版

### 用户请求

```
用户: 帮我生成一个小程序体验版用于测试
```

### AI Agent 执行流程

#### 步骤 1: 确认环境

```
AI: 我将为你生成测试环境的体验版。
```

默认使用 `test` 环境。

#### 步骤 2: 验证配置

```bash
# 检查配置文件
ls ainative-app/ci.test.config.js

# 检查私钥文件
ls ainative-app/key/*.key
```

**情况 A: 配置完整**

```
✅ 配置文件存在: ci.test.config.js
✅ 私钥文件存在: key/private.wxtest.key
```

继续执行步骤 3。

**情况 B: 配置缺失**

```
❌ 配置缺失

请确保以下文件存在：
1. ainative-app/ci.test.config.js
2. ainative-app/key/private.wxtest.key

配置文件模板：
module.exports = {
  WEAPP_APPID: "wxXXXXXXXXXXXXXXXX",
  WEAPP_PRIVATE_KEY_PATH: "key/private.wxXXXXXXXXXXXXXXXX.key",
  WEAPP_VERSION: "1.0.0",
  WEAPP_DESC: "测试版本"
}

私钥获取方式：
1. 登录微信公众平台
2. 开发 → 开发设置 → 小程序代码上传密钥
3. 下载并放置到 ainative-app/key/ 目录
```

停止执行，等待用户配置完成。

#### 步骤 3: 执行构建上传

```bash
cd ainative-app && npm run ci:weapp:upload:test
```

设置 `block_until_ms: 180000`（3分钟）

#### 步骤 4: 反馈结果

```
✅ 体验版生成成功

环境: test
版本: 1.0.0
描述: 测试版本

请在微信开发者工具或微信公众平台查看体验版二维码。
```

---

## 场景 2: 指定环境 - 生成生产环境体验版

### 用户请求

```
用户: 生成生产环境的体验版
```

### AI Agent 执行流程

#### 步骤 1: 确认环境

```
AI: 我将为你生成生产环境的体验版。

⚠️  注意：你正在生成生产环境的体验版，请确认代码已经过充分测试。
```

使用 `production` 环境。

#### 步骤 2: 验证配置

```bash
# 检查生产配置
ls ainative-app/ci.config.js

# 检查生产私钥
cat ainative-app/ci.config.js | grep WEAPP_PRIVATE_KEY_PATH
ls ainative-app/key/private.wx003545950d54d0e3.key
```

#### 步骤 3: 执行构建上传

```bash
cd ainative-app && npm run ci:weapp:upload:production
```

#### 步骤 4: 反馈结果

```
✅ 生产环境体验版生成成功

环境: production
版本: 1.1.8
描述: 修复异常问题，支持配置商品协议、优化部分体验

请在微信公众平台查看体验版二维码。
```

---

## 场景 3: 更新版本信息后生成体验版

### 用户请求

```
用户: 把版本号改为 1.2.0，描述改为"新增用户中心功能"，然后生成测试体验版
```

### AI Agent 执行流程

#### 步骤 1: 更新配置文件

```bash
# 读取当前配置
cat ainative-app/ci.test.config.js

# 更新版本号和描述
```

使用 StrReplace 工具修改：

```javascript
// 原内容
module.exports = {
  WEAPP_APPID: "wxtest123456789",
  WEAPP_PRIVATE_KEY_PATH: "key/private.wxtest.key",
  WEAPP_VERSION: "1.1.8",
  WEAPP_DESC: "测试版本"
}

// 新内容
module.exports = {
  WEAPP_APPID: "wxtest123456789",
  WEAPP_PRIVATE_KEY_PATH: "key/private.wxtest.key",
  WEAPP_VERSION: "1.2.0",
  WEAPP_DESC: "新增用户中心功能"
}
```

#### 步骤 2: 执行上传

```bash
cd ainative-app && npm run ci:weapp:upload:test
```

#### 步骤 3: 反馈结果

```
✅ 配置已更新并生成体验版

更新内容:
- 版本号: 1.1.8 → 1.2.0
- 描述: 测试版本 → 新增用户中心功能

体验版已成功上传。
```

---

## 场景 4: 上传失败 - 私钥文件不存在

### 用户请求

```
用户: 生成体验版
```

### AI Agent 执行流程

#### 步骤 1-2: 验证配置时发现问题

```bash
# 检查私钥
ls ainative-app/key/private.wxtest.key
# 文件不存在
```

#### 步骤 3: 反馈错误和解决方案

```
❌ 私钥文件不存在

问题: 无法找到私钥文件 key/private.wxtest.key

解决方案:
1. 登录微信公众平台 (https://mp.weixin.qq.com/)
2. 进入"开发" → "开发管理" → "开发设置"
3. 找到"小程序代码上传密钥"，点击"生成"
4. 下载私钥文件
5. 将文件重命名为 private.wxtest.key
6. 放置到 ainative-app/key/ 目录下
7. 再次运行生成体验版命令

如果你已有私钥文件，请检查：
- 文件路径是否正确
- 文件名是否与配置文件中的 WEAPP_PRIVATE_KEY_PATH 一致
```

停止执行，等待用户解决问题。

---

## 场景 5: 上传失败 - 构建错误

### 用户请求

```
用户: 生成测试体验版
```

### AI Agent 执行流程

#### 步骤 1-3: 执行构建时失败

```bash
cd ainative-app && npm run ci:weapp:upload:test
```

输出:

```
构建环境: build 目标环境: test
ERROR in ./src/pages/user/index.vue
  TS2339: Property 'userInfo' does not exist on type ...
```

#### 步骤 4: 反馈错误和解决方案

```
❌ 构建失败

错误: TypeScript 类型错误
位置: src/pages/user/index.vue

错误详情:
Property 'userInfo' does not exist on type ...

建议解决步骤:
1. 先单独测试构建:
   cd ainative-app && npm run build:weapp:test

2. 检查并修复 TypeScript 错误:
   npx tsc --noEmit

3. 或者我可以帮你查看并修复这个文件中的类型错误。

你希望我帮你修复这个错误吗？
```

根据用户回复决定下一步操作。

---

## 场景 6: 批量生成 - 多环境体验版

### 用户请求

```
用户: 分别生成测试和预发环境的体验版
```

### AI Agent 执行流程

#### 步骤 1: 确认操作

```
AI: 我将依次生成测试和预发环境的体验版。

计划:
1. 生成测试环境体验版
2. 生成预发环境体验版

预计耗时: 约 5-6 分钟
```

#### 步骤 2: 生成测试环境

```bash
cd ainative-app && npm run ci:weapp:upload:test
```

等待完成。

#### 步骤 3: 生成预发环境

```bash
cd ainative-app && npm run ci:weapp:upload:stage
```

等待完成。

#### 步骤 4: 反馈结果

```
✅ 两个环境的体验版都已生成

测试环境:
- 版本: 1.2.0
- 描述: 测试版本

预发环境:
- 版本: 1.2.0
- 描述: 预发版本

请在微信公众平台查看对应的体验版二维码。
```

---

## 场景 7: 自动化版本管理

### 用户请求

```
用户: 自动递增版本号并生成体验版
```

### AI Agent 执行流程

#### 步骤 1: 读取当前版本

```bash
cat ainative-app/ci.test.config.js | grep WEAPP_VERSION
```

输出: `WEAPP_VERSION: "1.2.0"`

#### 步骤 2: 询问版本类型

```
AI: 当前版本: 1.2.0

请选择版本递增类型:
1. patch (1.2.0 → 1.2.1) - 问题修复
2. minor (1.2.0 → 1.3.0) - 新增功能
3. major (1.2.0 → 2.0.0) - 重大更新
```

假设用户选择 `patch`。

#### 步骤 3: 更新版本号

```javascript
// 原版本: 1.2.0
// 新版本: 1.2.1
```

使用 StrReplace 更新配置文件。

#### 步骤 4: 生成体验版

```bash
cd ainative-app && npm run ci:weapp:upload:test
```

#### 步骤 5: 反馈结果

```
✅ 版本号已自动递增并生成体验版

版本变更: 1.2.0 → 1.2.1
类型: patch (问题修复)

体验版已成功上传。
```

---

## 场景 8: 集成 Git 信息

### 用户请求

```
用户: 生成体验版，版本描述包含当前的 git 提交信息
```

### AI Agent 执行流程

#### 步骤 1: 获取 Git 信息

```bash
git rev-parse --short HEAD
git rev-parse --abbrev-ref HEAD
git log -1 --pretty=%B
```

输出:
- commit: `a1b2c3d`
- branch: `feat/user-center`
- message: `feat: 新增用户中心页面`

#### 步骤 2: 构建版本描述

```javascript
WEAPP_DESC: "feat: 新增用户中心页面 (feat/user-center@a1b2c3d)"
```

#### 步骤 3: 更新配置并上传

```bash
# 更新配置
# 执行上传
cd ainative-app && npm run ci:weapp:upload:test
```

#### 步骤 4: 反馈结果

```
✅ 体验版生成成功

版本: 1.2.1
描述: feat: 新增用户中心页面 (feat/user-center@a1b2c3d)

包含 Git 信息:
- 分支: feat/user-center
- 提交: a1b2c3d
- 消息: feat: 新增用户中心页面
```

---

## 场景 9: 调试模式 - 仅构建不上传

### 用户请求

```
用户: 先帮我构建一下测试环境的代码，但不要上传
```

### AI Agent 执行流程

#### 步骤 1: 执行构建（不上传）

```bash
cd ainative-app && npm run build:weapp:test
```

设置 `block_until_ms: 120000`（2分钟）

#### 步骤 2: 检查构建产物

```bash
ls -lah ainative-app/dist/
```

#### 步骤 3: 反馈结果

```
✅ 构建完成

构建环境: test
输出目录: ainative-app/dist/
包大小: 2.3 MB

构建产物包含:
- app.js, app.json, app.wxss
- pages/ (所有页面)
- components/ (所有组件)

你可以:
1. 在微信开发者工具中打开 dist 目录进行预览
2. 确认无误后，执行上传命令生成体验版

需要我继续上传吗？
```

根据用户回复决定是否上传。

---

## 场景 10: 紧急修复 - 快速发布补丁版本

### 用户请求

```
用户: 紧急修复了一个 bug，快速生成一个补丁版本
```

### AI Agent 执行流程

#### 步骤 1: 快速检查

```bash
# 检查是否有未提交的改动
git status

# 检查当前版本
cat ainative-app/ci.config.js | grep WEAPP_VERSION
```

#### 步骤 2: 递增补丁版本

```javascript
// 1.2.1 → 1.2.2
WEAPP_VERSION: "1.2.2"
WEAPP_DESC: "紧急修复: [简要说明]"
```

#### 步骤 3: 快速构建上传

```bash
cd ainative-app && npm run ci:weapp:upload:production
```

#### 步骤 4: 反馈结果

```
✅ 紧急补丁版本已发布

版本: 1.2.2
类型: 紧急修复
环境: production

⚠️  后续步骤:
1. 在微信公众平台提交审核（如需发布到正式版）
2. 通知测试团队验证修复效果
3. 更新版本发布记录
```

---

## 场景 11: 多小程序管理

### 用户请求

```
用户: 我们有测试小程序和正式小程序，分别生成体验版
```

### AI Agent 执行流程

#### 步骤 1: 确认配置

```bash
# 检查测试小程序配置
cat ainative-app/ci.test.config.js

# 检查正式小程序配置
cat ainative-app/ci.config.js
```

输出:

```javascript
// ci.test.config.js
{
  WEAPP_APPID: "wxtest123456789",  // 测试小程序
  // ...
}

// ci.config.js
{
  WEAPP_APPID: "wx003545950d54d0e3",  // 正式小程序
  // ...
}
```

#### 步骤 2: 生成测试小程序体验版

```bash
cd ainative-app && npm run ci:weapp:upload:test
```

#### 步骤 3: 生成正式小程序体验版

```bash
cd ainative-app && npm run ci:weapp:upload:production
```

#### 步骤 4: 反馈结果

```
✅ 两个小程序的体验版都已生成

测试小程序:
- AppID: wxtest123456789
- 版本: 1.2.0
- 环境: test

正式小程序:
- AppID: wx003545950d54d0e3
- 版本: 1.2.0
- 环境: production

请在各自的微信公众平台后台查看体验版二维码。
```

---

## 场景 12: 配合开发流程 - 功能开发后生成体验版

### 完整工作流

#### 阶段 1: 开发新功能

```
用户: 帮我开发一个用户中心页面

AI: (使用 create-ainative-app-page 技能)
- 创建页面
- 实现功能
- 测试通过
```

#### 阶段 2: 代码审查

```
用户: 检查一下代码质量

AI: (使用 code-review-ainative 技能)
- 代码审查
- 修复问题
- 确认通过
```

#### 阶段 3: 生成体验版

```
用户: 生成体验版供产品验证

AI: (使用 app-preview 技能)
✅ 体验版生成成功

版本: 1.3.0
描述: 新增用户中心页面
环境: test

体验版二维码已生成，请扫码体验。
```

#### 阶段 4: 反馈处理

如果产品提出问题:

```
用户: 产品说有个 bug，帮我修复后重新生成体验版

AI:
1. 修复 bug
2. 更新版本号为 1.3.1
3. 重新生成体验版
```

---

## 场景 13: CI/CD 集成建议

### 用户请求

```
用户: 如何在 CI/CD 中自动生成体验版？
```

### AI Agent 响应

```
我可以为你提供 CI/CD 集成方案。以下是基于 GitHub Actions 的示例：

1. 创建工作流文件: .github/workflows/upload-preview.yml

```yaml
name: Upload Preview Version

on:
  push:
    branches:
      - feat/*
      - fix/*

jobs:
  upload:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
      
      - name: Install dependencies
        run: |
          cd ainative-app
          npm install
      
      - name: Setup WeChat CI credentials
        env:
          WEAPP_PRIVATE_KEY: ${{ secrets.WEAPP_PRIVATE_KEY }}
        run: |
          mkdir -p ainative-app/key
          echo "$WEAPP_PRIVATE_KEY" > ainative-app/key/private.key
      
      - name: Upload to WeChat
        run: |
          cd ainative-app
          npm run ci:weapp:upload:test
      
      - name: Clean up
        run: |
          rm -f ainative-app/key/private.key
```yaml

2. 在 GitHub 仓库设置中添加 Secrets:
   - WEAPP_PRIVATE_KEY: 私钥文件内容

3. 推送代码到 feat/* 或 fix/* 分支时自动生成体验版

需要我帮你创建这个工作流文件吗？
```

---

## 常用命令快速参考

### 基础命令

```bash
# 测试环境
cd ainative-app && npm run ci:weapp:upload:test

# 预发环境
cd ainative-app && npm run ci:weapp:upload:stage

# 生产环境
cd ainative-app && npm run ci:weapp:upload:production
```

### 调试命令

```bash
# 只构建不上传
npm run build:weapp:test

# 生成预览二维码（不上传）
npm run ci:weapp:preview

# 打开微信开发者工具
npm run ci:weapp:open
```

### 检查命令

```bash
# 检查配置文件
cat ci.test.config.js

# 检查私钥文件
ls -la key/

# 检查构建产物
ls -la dist/

# 检查包大小
du -sh dist/
```

---

## 最佳实践总结

### 开发阶段

1. 使用测试环境配置
2. 频繁生成体验版供自测
3. 版本号使用 `x.y.z-test` 格式

### 测试阶段

1. 生成测试环境体验版
2. 版本描述要详细
3. 通知测试团队二维码

### 发布阶段

1. 先生成预发环境体验版
2. 充分验证后生成生产环境
3. 版本号严格递增
4. 记录发布日志

### 紧急修复

1. 使用 patch 版本号
2. 描述中标注"紧急修复"
3. 快速验证后发布
4. 事后补充完整测试

---

## 问题排查检查清单

生成体验版前的检查清单：

```
□ 代码已提交到 Git
□ 代码已通过 ESLint 检查
□ TypeScript 编译无错误
□ 本地构建成功
□ 配置文件存在且正确
□ 私钥文件存在
□ 版本号已更新
□ 版本描述已填写
□ 网络连接正常
□ 确认目标环境
```

生成失败后的排查步骤：

```
1. 检查错误信息
2. 查看完整日志
3. 验证配置文件
4. 检查私钥文件
5. 尝试本地构建
6. 清理缓存重试
7. 查阅故障排查文档
```
