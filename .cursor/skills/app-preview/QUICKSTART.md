# app-preview 技能快速入门

## 5 分钟快速开始

### 前提条件检查

运行环境检查脚本：

```bash
.cursor/skills/app-preview/test.sh
```

如果所有检查通过，即可开始使用。

---

## 第一次使用

### 步骤 1: 准备私钥文件

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 开发 → 开发管理 → 开发设置
3. 小程序代码上传密钥 → 生成
4. 下载私钥文件
5. 放置到 `ainative-app/key/` 目录

### 步骤 2: 配置 CI 文件

**测试环境配置**（如果不存在）：

```bash
# 复制模板
cp ainative-app/ci.config.js ainative-app/ci.test.config.js

# 编辑配置
# 修改 WEAPP_APPID 和 WEAPP_PRIVATE_KEY_PATH
```

### 步骤 3: 生成体验版

**方式 1: 使用 AI Agent**

```
在 Cursor 中对 AI 说：
"@app-preview 帮我生成一个测试环境的体验版"
```

**方式 2: 手动执行**

```bash
cd ainative-app
npm run ci:weapp:upload:test
```

---

## 常用命令

### 生成体验版

```bash
# 测试环境
npm run ci:weapp:upload:test

# 预发环境
npm run ci:weapp:upload:stage

# 生产环境
npm run ci:weapp:upload:production
```

### 调试命令

```bash
# 只构建不上传
npm run build:weapp:test

# 生成预览二维码
npm run ci:weapp:preview
```

### 检查命令

```bash
# 环境检查
.cursor/skills/app-preview/test.sh

# 查看配置
cat ainative-app/ci.test.config.js

# 查看私钥列表
ls -la ainative-app/key/
```

---

## 典型使用流程

### 场景 1: 日常开发测试

```
1. 开发功能
2. 本地测试通过
3. AI: "@app-preview 生成测试体验版"
4. 扫码验证
5. 发现问题 → 修复 → 重复步骤 3
```

### 场景 2: 提测前验证

```
1. 功能开发完成
2. 代码审查通过
3. 更新版本号（如 1.2.0）
4. 更新版本描述
5. AI: "@app-preview 生成预发体验版"
6. 团队验证
7. 通过后提交测试
```

### 场景 3: 紧急修复

```
1. 发现线上问题
2. 快速修复
3. 递增补丁版本号（如 1.2.0 → 1.2.1）
4. AI: "@app-preview 紧急修复，生成生产体验版"
5. 快速验证
6. 提交审核发布
```

---

## AI 对话示例

### 示例 1: 基础使用

```
你: "@app-preview 生成体验版"

AI: 我将为你生成测试环境的体验版...
    ✅ 配置检查通过
    🔨 正在构建和上传...
    ✅ 体验版生成成功
```

### 示例 2: 指定环境

```
你: "@app-preview 生成生产环境的体验版"

AI: ⚠️  你正在生成生产环境体验版，请确认
    ✅ 配置检查通过
    🔨 正在构建和上传...
    ✅ 生产环境体验版生成成功
```

### 示例 3: 更新版本

```
你: "@app-preview 更新版本号为 1.3.0，描述为'新增用户中心'，然后生成体验版"

AI: ✅ 配置已更新
    版本号: 1.2.0 → 1.3.0
    描述: 新增用户中心
    🔨 正在生成体验版...
    ✅ 体验版生成成功
```

---

## 问题排查

### 问题 1: 私钥文件不存在

**症状**：
```
Error: privateKeyPath 文件不存在
```

**解决**：
1. 检查 `ainative-app/key/` 目录是否存在
2. 确认私钥文件名与配置一致
3. 重新下载私钥文件

### 问题 2: AppID 不匹配

**症状**：
```
Error: appid 不正确
```

**解决**：
1. 对比 `ci.config.js` 和 `project.config.json` 中的 appid
2. 确保配置一致
3. 确认私钥对应的小程序正确

### 问题 3: 构建失败

**症状**：
```
Error: Build failed
```

**解决**：
1. 先运行 `npm run build:weapp:test` 验证构建
2. 检查 TypeScript/ESLint 错误
3. 运行 `npm run lint` 检查代码质量

### 问题 4: 上传超时

**症状**：
```
Error: upload timeout
```

**解决**：
1. 检查网络连接
2. 增加超时时间
3. 优化包体积
4. 重试上传

---

## 版本管理建议

### 版本号规则

使用语义化版本：`major.minor.patch`

- `major`: 重大更新（破坏性变更）
- `minor`: 新增功能（向后兼容）
- `patch`: 问题修复（向后兼容）

### 版本递增时机

| 变更类型 | 版本变化 | 示例 |
|---------|---------|------|
| 新功能 | minor +1 | 1.2.0 → 1.3.0 |
| Bug 修复 | patch +1 | 1.2.0 → 1.2.1 |
| 重大变更 | major +1 | 1.2.0 → 2.0.0 |
| 测试版本 | 添加后缀 | 1.2.0-test |

### 版本描述规范

```
格式: [类型] 简要说明

示例:
- "新增用户中心功能"
- "修复订单支付问题"
- "优化首页加载性能"
- "重构权限系统"
```

---

## 最佳实践

### 开发阶段

1. ✅ 频繁生成测试环境体验版
2. ✅ 使用 `-test` 后缀标识测试版本
3. ✅ 每个功能独立验证
4. ❌ 避免在生产环境频繁上传

### 测试阶段

1. ✅ 生成预发环境体验版
2. ✅ 版本描述详细清晰
3. ✅ 通知测试团队新版本
4. ✅ 记录每次发布的问题

### 发布阶段

1. ✅ 先在预发环境充分验证
2. ✅ 版本号严格递增
3. ✅ 版本描述准确完整
4. ✅ 保留发布记录

### 紧急修复

1. ✅ 使用 patch 版本号
2. ✅ 描述中标注"紧急修复"
3. ✅ 快速验证后发布
4. ✅ 事后补充完整测试

---

## 团队协作

### 多人开发

1. **统一版本号管理**
   - 使用 `package.json` 作为版本号唯一来源
   - CI 配置从 `package.json` 读取版本号

2. **明确环境职责**
   - test: 开发自测
   - stage: 团队联调
   - production: 预发布验证

3. **版本发布流程**
   - 开发 → 自测（test）
   - 联调 → 提测（stage）
   - 验收 → 预发（production）
   - 审核 → 发布（正式版）

### CI/CD 集成

可以集成到自动化流程：

```yaml
# 示例：GitHub Actions
on:
  push:
    branches: [feat/*]
jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run ci:weapp:upload:test
```

---

## 进阶使用

### 动态版本号

使用 Git 信息生成版本号：

```javascript
// ci.config.js
const { execSync } = require('child_process')
const pkg = require('./package.json')

const gitCommit = execSync('git rev-parse --short HEAD').toString().trim()

module.exports = {
  WEAPP_VERSION: `${pkg.version}`,
  WEAPP_DESC: `版本 ${pkg.version} (${gitCommit})`
}
```

### 自动化脚本

创建便捷脚本：

```bash
#!/bin/bash
# scripts/upload-preview.sh

# 自动递增版本号
npm version patch --no-git-tag-version

# 生成体验版
npm run ci:weapp:upload:test

# 提交版本号变更
git add package.json ci.config.js
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
```

---

## 相关资源

### 官方文档

- [Taro 文档](https://taro-docs.jd.com/)
- [Taro CI 插件](https://taro-docs.jd.com/docs/plugin-mini-ci)
- [微信小程序 CI](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)

### 项目文档

- [完整使用说明](README.md)
- [CI 配置详解](references/ci-config.md)
- [故障排查指南](references/troubleshooting.md)
- [使用示例](references/examples.md)

### 相关技能

- `create-ainative-app-page` - 创建小程序页面
- `app-dev` - 小程序开发指南
- `debug-ainative-projects` - 调试问题
- `code-review-ainative` - 代码审查

---

## 获取帮助

### 问题反馈

1. 查看 [故障排查指南](references/troubleshooting.md)
2. 运行环境检查脚本
3. 查看完整日志
4. 联系项目维护者

### 技能改进

如果你发现技能有改进空间，欢迎：

1. 提出改进建议
2. 更新文档内容
3. 添加新的使用示例
4. 完善故障排查方案

---

## 快速参考卡片

```
┌─────────────────────────────────────────────┐
│ app-preview 技能快速参考                      │
├─────────────────────────────────────────────┤
│ AI 使用:                                     │
│   @app-preview 生成测试体验版                 │
│   @app-preview 生成生产体验版                 │
│                                             │
│ 手动命令:                                    │
│   npm run ci:weapp:upload:test              │
│   npm run ci:weapp:upload:stage             │
│   npm run ci:weapp:upload:production        │
│                                             │
│ 调试命令:                                    │
│   npm run build:weapp:test                  │
│   .cursor/skills/app-preview/test.sh        │
│                                             │
│ 配置文件:                                    │
│   ainative-app/ci.config.js                 │
│   ainative-app/ci.test.config.js            │
│   ainative-app/key/*.key                    │
│                                             │
│ 版本管理:                                    │
│   major.minor.patch (如 1.2.3)              │
│   每次上传递增版本号                          │
└─────────────────────────────────────────────┘
```

---

**现在你已经准备好使用 app-preview 技能了！** 🎉

开始你的第一次体验版生成吧：

```
@app-preview 帮我生成一个测试环境的体验版
```
