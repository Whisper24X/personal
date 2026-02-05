# ainative-app 小程序体验版生成技能

## 简介

这个技能帮助开发者快速生成 ainative-app 微信小程序的体验版，供测试人员和产品经理验证功能使用。

## 使用场景

- 开发完成需要测试验证时
- 产品需要查看最新功能时
- 需要在真机上测试小程序时
- 提交代码前的最终验证

## 触发方式

AI Agent 会在以下情况下自动应用此技能：

- 用户说"生成体验版"
- 用户说"上传小程序"
- 用户说"发布测试版本"
- 用户提到"预览版"、"体验版"

## 使用示例

### 示例 1: 生成测试环境体验版

```
用户: 帮我生成一个测试环境的体验版

AI 会执行：
1. 检查 ci.test.config.js 配置
2. 验证私钥文件存在
3. 执行 npm run ci:weapp:upload:test
4. 反馈上传结果
```

### 示例 2: 生成生产环境体验版

```
用户: 生成生产环境的体验版，版本号改为 1.2.0

AI 会执行：
1. 更新 ci.config.js 中的版本号为 1.2.0
2. 检查配置和私钥
3. 执行 npm run ci:weapp:upload:production
4. 反馈上传结果
```

### 示例 3: 更新版本描述后生成体验版

```
用户: 更新版本描述为"新增用户中心功能"，然后生成测试体验版

AI 会执行：
1. 修改 ci.test.config.js 中的 WEAPP_DESC
2. 执行构建上传流程
3. 反馈结果
```

## 环境说明

| 环境 | 配置文件 | 用途 | 命令 |
|------|----------|------|------|
| test | ci.test.config.js | 日常开发测试 | `npm run ci:weapp:upload:test` |
| stage | ci.config.js | 预发布验证 | `npm run ci:weapp:upload:stage` |
| production | ci.config.js | 生产环境 | `npm run ci:weapp:upload:production` |

## 前置条件

### 1. 配置文件

需要存在对应环境的配置文件：

**测试环境**：`ainative-app/ci.test.config.js`
```javascript
module.exports = {
  WEAPP_APPID: "wx***",                          // 测试小程序 AppID
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx*.key", // 私钥路径
  WEAPP_VERSION: "1.0.0",                        // 版本号
  WEAPP_DESC: "测试版本"                          // 版本描述
}
```

**生产环境**：`ainative-app/ci.config.js`
```javascript
module.exports = {
  WEAPP_APPID: "wx003545950d54d0e3",
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key",
  WEAPP_VERSION: "1.1.8",
  WEAPP_DESC: "生产版本"
}
```

### 2. 私钥文件

需要从微信公众平台下载私钥文件，并放置到 `ainative-app/key/` 目录下。

**获取私钥步骤**：
1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入"开发" → "开发管理" → "开发设置"
3. 找到"小程序代码上传密钥"
4. 下载密钥文件，重命名为配置中的文件名
5. 放置到 `ainative-app/key/` 目录

### 3. 依赖安装

确保已安装项目依赖：

```bash
cd ainative-app
npm install
```

## 工作流程

```
┌─────────────────────────────────────────────────────────┐
│ 步骤 1: 确认目标环境                                      │
│  - test (默认)                                           │
│  - stage                                                 │
│  - production                                            │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 步骤 2: 验证配置                                          │
│  ✓ 配置文件存在 (ci.config.js / ci.test.config.js)      │
│  ✓ 私钥文件存在 (key/private.wx*.key)                   │
│  ✓ AppID 配置正确                                        │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 步骤 3: 执行构建上传                                      │
│  1. 清理旧构建产物                                        │
│  2. Taro 编译构建（根据环境配置）                         │
│  3. 调用 miniprogram-ci 上传                             │
│  4. 生成体验版二维码                                      │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 步骤 4: 反馈结果                                          │
│  ✅ 上传成功 → 显示版本信息和二维码                       │
│  ❌ 上传失败 → 显示错误信息和解决方案                     │
└─────────────────────────────────────────────────────────┘
```

## 常见问题

### Q1: 如何获取小程序私钥？

**A**: 
1. 登录微信公众平台
2. 开发 → 开发管理 → 开发设置
3. 小程序代码上传密钥 → 生成
4. 下载私钥文件
5. 放置到 `ainative-app/key/` 目录

### Q2: 测试环境和生产环境可以使用相同的 AppID 吗？

**A**: 
可以，但不推荐。建议：
- 测试环境：使用独立的测试小程序 AppID
- 生产环境：使用正式小程序 AppID

这样可以避免测试版本影响线上用户。

### Q3: 版本号如何管理？

**A**: 
建议使用语义化版本号（Semantic Versioning）：

- `major.minor.patch` 格式
- 示例：`1.2.3`
  - major: 重大更新（破坏性变更）
  - minor: 新增功能
  - patch: 问题修复

每次上传体验版前，递增对应的版本号。

### Q4: 上传失败怎么办？

**A**: 
按以下步骤排查：

1. **检查网络连接**
2. **验证配置文件**：AppID、私钥路径是否正确
3. **检查私钥权限**：私钥是否有上传权限
4. **清理构建产物**：删除 `dist/` 目录重新构建
5. **查看详细错误**：检查终端输出的完整错误信息

### Q5: 如何在微信开发者工具中查看体验版？

**A**: 
1. 打开微信开发者工具
2. 登录对应的小程序账号
3. 点击顶部"上传" → "版本管理"
4. 在"开发版本"中可以看到刚上传的体验版
5. 点击"体验版二维码"可以生成预览二维码

或者直接在微信公众平台查看：
1. 登录微信公众平台
2. 管理 → 版本管理
3. 查看"开发版本"

## 与其他技能的关系

| 技能 | 关系 | 说明 |
|------|------|------|
| app-dev | 前置 | 开发完成后生成体验版 |
| create-ainative-app-page | 前置 | 新页面开发后需要体验版验证 |
| debug-ainative-projects | 并行 | 体验版中发现问题时使用调试技能 |
| code-review-ainative | 前置 | 代码审查通过后生成体验版 |

## 最佳实践

### 1. 版本管理

```javascript
// 推荐在 package.json 中统一管理版本号
{
  "version": "1.1.8"
}

// ci.config.js 从 package.json 读取
const pkg = require('./package.json')
module.exports = {
  WEAPP_VERSION: pkg.version,
  // ...
}
```

### 2. 自动化脚本

可以创建自动化脚本简化流程：

```bash
# scripts/upload-preview.sh
#!/bin/bash
ENV=${1:-test}
echo "生成 $ENV 环境体验版..."
cd ainative-app
npm run ci:weapp:upload:$ENV
```

### 3. CI/CD 集成

可以集成到 CI/CD 流程中：

```yaml
# .github/workflows/preview.yml
name: Upload Preview Version
on:
  push:
    branches: [feat/*]
jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run ci:weapp:upload:test
```

### 4. 变更日志

建议维护变更日志：

```markdown
# CHANGELOG.md

## [1.1.9] - 2025-02-05
### 新增
- 用户中心页面

### 修复
- 修复订单列表加载问题

## [1.1.8] - 2025-02-04
### 优化
- 优化首页加载性能
```

## 技术细节

### Taro CI 插件配置

项目使用 `@tarojs/plugin-mini-ci` 插件，配置位于 `config/index.ts`：

```typescript
const CIPluginOpt = {
  weapp: {
    appid: ciConfig["WEAPP_APPID"],
    privateKeyPath: ciConfig["WEAPP_PRIVATE_KEY_PATH"]
  },
  version: ciConfig["WEAPP_VERSION"],
  desc: ciConfig["WEAPP_DESC"]
}
```

### miniprogram-ci

底层使用 `miniprogram-ci` SDK（版本 1.9.17）：

- 官方文档：https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html
- 功能：代码上传、预览、版本管理
- 权限：需要小程序管理员配置上传密钥

## 维护说明

### 更新此技能

当需要更新此技能时：

1. 修改 `SKILL.md`（主文档）
2. 同步更新 `README.md`（详细说明）
3. 测试新的工作流程
4. 更新示例和常见问题

### 反馈问题

如果在使用过程中遇到问题：

1. 检查本文档的"常见问题"部分
2. 查看项目的 CI 配置是否有更新
3. 联系项目维护者

## 参考资料

- [Taro 官方文档](https://taro-docs.jd.com/)
- [Taro CI 插件文档](https://taro-docs.jd.com/docs/plugin-mini-ci)
- [微信小程序 CI 文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)
- [miniprogram-ci NPM](https://www.npmjs.com/package/miniprogram-ci)
- 项目文档：`docs/dev-spec/ainative-app/README.md`
