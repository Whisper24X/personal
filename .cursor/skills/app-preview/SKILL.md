---
name: app-preview
description: 生成 ainative-app 小程序体验版供测试验证。支持多环境（test/stage/production）构建和上传体验版。当用户提到"体验版"、"预览版"、"上传小程序"、"生成体验版"或需要在微信开发者工具中预览时使用。
---

# ainative-app 小程序体验版生成

用于生成 ainative-app（Taro 项目）的微信小程序体验版，供测试人员和产品验证使用。

## 快速开始

生成体验版分为三个步骤：

1. **选择目标环境**
2. **验证 CI 配置**
3. **构建并上传体验版**

## 步骤 1: 选择目标环境

ainative-app 支持多环境构建：

| 环境 | 说明 | 构建命令 |
|------|------|----------|
| test | 测试环境 | `npm run ci:weapp:upload:test` |
| stage | 预发环境 | `npm run ci:weapp:upload:stage` |
| production | 生产环境 | `npm run ci:weapp:upload:production` |

**默认使用 test 环境**，除非用户明确指定其他环境。

## 步骤 2: 验证 CI 配置

在上传前，必须验证 CI 配置文件存在且配置正确。

### 配置文件位置

- 生产/预发环境：`ainative-app/ci.config.js`
- 测试环境：`ainative-app/ci.test.config.js`

### 配置文件格式

```javascript
module.exports = {
  WEAPP_APPID: "wx003545950d54d0e3",                    // 小程序 AppID
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx*.key",        // 私钥路径
  WEAPP_VERSION: "1.1.8",                                // 版本号
  WEAPP_DESC: "修复异常问题，支持配置商品协议、优化部分体验"  // 版本描述
}
```

### 验证检查项

使用以下步骤验证配置：

1. **检查配置文件是否存在**
   - 测试环境：`ainative-app/ci.test.config.js`
   - 生产/预发：`ainative-app/ci.config.js`

2. **检查私钥文件是否存在**
   - 路径：`ainative-app/key/private.wx*.key`
   - 私钥文件必须对应配置中的 `WEAPP_PRIVATE_KEY_PATH`

3. **如果配置缺失**，提示用户：
   ```
   ❌ CI 配置缺失

   请确保以下文件存在：
   - ainative-app/ci.config.js（或 ci.test.config.js）
   - ainative-app/key/private.wx*.key

   配置示例请参考：ainative-app/ci.config.js
   ```

## 步骤 3: 构建并上传体验版

验证通过后，执行构建上传命令。

### 执行命令

根据目标环境执行对应命令：

```bash
# 进入 ainative-app 目录
cd ainative-app

# 测试环境（默认）
npm run ci:weapp:upload:test

# 预发环境
npm run ci:weapp:upload:stage

# 生产环境
npm run ci:weapp:upload:production
```

### 命令说明

这些命令会：
1. 使用 Taro 构建小程序代码（根据环境配置）
2. 调用 `@tarojs/plugin-mini-ci` 插件
3. 使用 `miniprogram-ci` SDK 上传至微信后台
4. 生成体验版二维码

### 监控构建过程

**设置合理的超时时间**：
- 首次构建：`block_until_ms: 180000`（3分钟）
- 增量构建：`block_until_ms: 120000`（2分钟）

**关键输出信息**：
- `构建环境:` - 确认环境变量
- `上传成功` - 上传完成标识
- 体验版二维码 URL

### 成功输出示例

```
✅ 体验版生成成功

环境: test
版本: 1.1.8
描述: 修复异常问题，支持配置商品协议、优化部分体验

体验版二维码已生成，请在微信小程序管理后台查看。
```

## 常见问题处理

### 问题 1: 私钥文件不存在

```
错误: privateKeyPath 文件不存在
```

**解决方案**：
1. 检查 `ainative-app/key/` 目录下是否有私钥文件
2. 确认私钥文件名与 `ci.config.js` 中的 `WEAPP_PRIVATE_KEY_PATH` 一致
3. 如需获取私钥，在微信公众平台下载并放置到 `key/` 目录

### 问题 2: AppID 不匹配

```
错误: appid 不正确
```

**解决方案**：
1. 对比 `ci.config.js` 中的 `WEAPP_APPID` 与 `project.config.json` 中的 `appid`
2. 确保两者一致
3. 测试环境可能使用不同的 AppID，检查 `ci.test.config.js`

### 问题 3: 构建失败

```
错误: Build failed
```

**解决方案**：
1. 先执行 `npm run build:weapp:test` 验证构建是否成功
2. 检查代码是否有 TypeScript/ESLint 错误
3. 确认 `node_modules` 已正确安装（`npm install`）

### 问题 4: 上传超时

**解决方案**：
1. 检查网络连接
2. 增大超时时间：`block_until_ms: 240000`（4分钟）
3. 尝试将命令移至后台运行：`block_until_ms: 0`

## 完整工作流示例

```markdown
用户: "帮我生成一个测试环境的体验版"

Agent 操作流程：

1. 确认环境：test
2. 验证配置文件：
   - ✅ 检查 ainative-app/ci.test.config.js 存在
   - ✅ 检查 ainative-app/key/private.wx*.key 存在
3. 执行构建上传：
   ```bash
   cd ainative-app && npm run ci:weapp:upload:test
   ```
4. 监控输出，等待完成
5. 反馈结果给用户
```

## 版本管理建议

每次生成体验版时，建议：

1. **更新版本号**：修改 `ci.config.js` 中的 `WEAPP_VERSION`
   - 遵循语义化版本：`major.minor.patch`
   - 示例：`1.1.8` → `1.1.9`

2. **填写版本描述**：更新 `WEAPP_DESC`
   - 简要说明本次更新内容
   - 便于后续追溯

3. **记录发布日志**
   - 在项目文档中记录每次体验版发布
   - 包含：版本号、环境、发布时间、更新内容

## 环境配置文件说明

### ci.config.js（生产/预发）

用于生产和预发环境，包含正式小程序的 AppID 和私钥配置。

### ci.test.config.js（测试）

用于测试环境，可以使用独立的测试小程序 AppID，与生产环境隔离。

**如果测试环境配置不存在**：
- 项目会 fallback 到 `ci.config.js`
- 建议创建独立的测试配置文件以隔离环境

## 相关文档

- [Taro CI 文档](https://taro-docs.jd.com/docs/plugin-mini-ci)
- [微信小程序 CI](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)
- 项目配置：`ainative-app/config/index.ts`
- package.json：`ainative-app/package.json`

## 注意事项

1. **私钥安全**：私钥文件应添加到 `.gitignore`，不提交到代码库
2. **环境隔离**：确认使用正确的环境配置，避免误上传到生产环境
3. **版本冲突**：上传前确认版本号未被使用
4. **权限检查**：确保使用的私钥有上传权限
5. **构建清理**：出现问题时可删除 `dist/` 目录后重新构建
