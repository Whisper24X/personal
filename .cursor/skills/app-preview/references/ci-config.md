# CI 配置详解

## 配置文件结构

ainative-app 使用两个独立的 CI 配置文件来支持多环境部署：

```
ainative-app/
├── ci.config.js          # 生产/预发环境配置
├── ci.test.config.js     # 测试环境配置
└── key/
    ├── private.wx003545950d54d0e3.key  # 生产小程序私钥
    └── private.wxtest.key              # 测试小程序私钥（如有）
```

---

## 配置文件详解

### 基础配置格式

```javascript
// ci.config.js
module.exports = {
  // 小程序 AppID（必填）
  WEAPP_APPID: "wx003545950d54d0e3",
  
  // 上传私钥路径（必填）
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key",
  
  // 版本号（必填）
  WEAPP_VERSION: "1.1.8",
  
  // 版本描述（必填）
  WEAPP_DESC: "修复异常问题，支持配置商品协议、优化部分体验"
}
```

### 配置项说明

#### WEAPP_APPID

- **类型**: `string`
- **必填**: 是
- **说明**: 微信小程序的唯一标识符
- **获取方式**:
  1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
  2. 开发 → 开发管理 → 开发设置
  3. 复制"开发者 ID" 中的 AppID
- **示例**: `"wx003545950d54d0e3"`
- **注意事项**:
  - 必须与 `project.config.json` 中的 `appid` 一致
  - 不同环境可以使用不同的 AppID（推荐）

#### WEAPP_PRIVATE_KEY_PATH

- **类型**: `string`
- **必填**: 是
- **说明**: 小程序代码上传私钥文件的相对路径（相对于 ainative-app 目录）
- **获取私钥**:
  1. 登录微信公众平台
  2. 开发 → 开发管理 → 开发设置
  3. "小程序代码上传密钥" → "生成"
  4. 下载私钥文件
  5. 放置到 `ainative-app/key/` 目录
- **示例**: `"key/private.wx003545950d54d0e3.key"`
- **注意事项**:
  - 路径相对于配置文件所在目录
  - 私钥文件必须实际存在
  - 建议私钥文件命名包含 AppID，便于区分
  - **务必将 key/ 目录添加到 .gitignore**

#### WEAPP_VERSION

- **类型**: `string`
- **必填**: 是
- **说明**: 小程序版本号，用于版本管理和追踪
- **格式**: 建议使用语义化版本（Semantic Versioning）
  - `major.minor.patch`
  - 示例: `"1.2.3"`
- **版本递增规则**:
  - `major`: 重大更新（破坏性变更）
  - `minor`: 新增功能（向后兼容）
  - `patch`: 问题修复（向后兼容）
- **示例**: `"1.1.8"`
- **注意事项**:
  - 每次上传必须使用不同的版本号
  - 建议与 `package.json` 中的 `version` 保持同步

#### WEAPP_DESC

- **类型**: `string`
- **必填**: 是
- **说明**: 版本更新说明，描述本次更新的内容
- **建议格式**:
  ```
  新增xxx功能，修复xxx问题，优化xxx体验
  ```
- **示例**: `"修复异常问题，支持配置商品协议、优化部分体验"`
- **注意事项**:
  - 简洁明了，便于团队成员快速了解更新内容
  - 可以作为版本追踪的依据
  - 建议包含关键词：新增、修复、优化等

---

## 多环境配置策略

### 策略 1: 使用相同 AppID（简单）

**适用场景**: 
- 小团队
- 测试和生产使用同一个小程序
- 无需严格隔离环境

**配置方式**:

```javascript
// ci.config.js（生产/预发）
module.exports = {
  WEAPP_APPID: "wx003545950d54d0e3",
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key",
  WEAPP_VERSION: "1.1.8",
  WEAPP_DESC: "生产环境版本"
}

// ci.test.config.js（测试）
module.exports = {
  WEAPP_APPID: "wx003545950d54d0e3",  // 相同 AppID
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key",  // 相同私钥
  WEAPP_VERSION: "1.1.8-test",  // 通过版本号区分
  WEAPP_DESC: "测试环境版本"
}
```

**优点**:
- 配置简单
- 只需管理一个小程序
- 私钥共用

**缺点**:
- 测试版本和生产版本在同一个小程序中
- 可能误将测试版本发布到生产
- 版本管理混乱

---

### 策略 2: 使用不同 AppID（推荐）

**适用场景**: 
- 中大型团队
- 需要严格的环境隔离
- 测试和生产分离

**配置方式**:

```javascript
// ci.config.js（生产/预发）
module.exports = {
  WEAPP_APPID: "wx003545950d54d0e3",  // 生产小程序
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key",
  WEAPP_VERSION: "1.1.8",
  WEAPP_DESC: "生产环境版本"
}

// ci.test.config.js（测试）
module.exports = {
  WEAPP_APPID: "wxtest123456789",  // 测试小程序（不同 AppID）
  WEAPP_PRIVATE_KEY_PATH: "key/private.wxtest123456789.key",
  WEAPP_VERSION: "1.1.8",  // 可以使用相同版本号
  WEAPP_DESC: "测试环境版本"
}
```

**优点**:
- 环境完全隔离
- 避免误操作
- 版本管理清晰
- 可以使用不同的后端 API 配置

**缺点**:
- 需要申请两个小程序
- 需要管理两套私钥
- 配置稍复杂

**实施步骤**:

1. **申请测试小程序**:
   - 使用不同的邮箱申请
   - 命名为 "xxx-测试版"
   - 记录测试小程序的 AppID

2. **下载测试小程序私钥**:
   - 登录测试小程序后台
   - 生成并下载私钥
   - 重命名为 `private.wxtest*.key`
   - 放置到 `key/` 目录

3. **创建测试配置**:
   ```bash
   cp ci.config.js ci.test.config.js
   # 修改 ci.test.config.js 中的 AppID 和私钥路径
   ```

4. **更新 project.config.json**:
   ```json
   {
     "appid": "wx003545950d54d0e3"  // 主要使用生产 AppID
   }
   ```

---

### 策略 3: 动态配置（高级）

**适用场景**: 
- 多环境、多小程序
- CI/CD 自动化部署
- 需要灵活切换配置

**配置方式**:

```javascript
// ci.config.js
const env = process.env.DEPLOY_ENV || 'production'

const configs = {
  production: {
    WEAPP_APPID: "wx003545950d54d0e3",
    WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key",
    WEAPP_VERSION: require('./package.json').version,
    WEAPP_DESC: "生产环境"
  },
  stage: {
    WEAPP_APPID: "wxstage123456789",
    WEAPP_PRIVATE_KEY_PATH: "key/private.wxstage123456789.key",
    WEAPP_VERSION: require('./package.json').version,
    WEAPP_DESC: "预发环境"
  },
  test: {
    WEAPP_APPID: "wxtest123456789",
    WEAPP_PRIVATE_KEY_PATH: "key/private.wxtest123456789.key",
    WEAPP_VERSION: require('./package.json').version,
    WEAPP_DESC: "测试环境"
  }
}

module.exports = configs[env]
```

**使用方式**:

```bash
# 部署到测试环境
DEPLOY_ENV=test npm run ci:weapp:upload

# 部署到预发环境
DEPLOY_ENV=stage npm run ci:weapp:upload

# 部署到生产环境
DEPLOY_ENV=production npm run ci:weapp:upload
```

**优点**:
- 配置集中管理
- 易于扩展新环境
- 适合 CI/CD 集成

**缺点**:
- 配置复杂度增加
- 需要额外的环境变量管理

---

## 与 Taro 配置集成

### config/index.ts 中的使用

```typescript
// config/index.ts
import * as fs from "fs"
import * as path from "path"

export default defineConfig<"vite">(async (merge, { command, mode }) => {
  const env = mode || "development"
  
  // 根据环境加载对应的 CI 配置
  let ciConfig = {}
  if (["test", "development"].includes(mode)) {
    // 测试环境
    const ciConfigPath = path.resolve(__dirname, "../ci.test.config.js")
    if (fs.existsSync(ciConfigPath)) {
      ciConfig = require(ciConfigPath)
    } else {
      // fallback 到默认配置
      ciConfig = require("../ci.config.js")
    }
  } else {
    // 生产/预发环境
    ciConfig = require("../ci.config.js")
  }
  
  // 传递给 CI 插件
  const CIPluginOpt = {
    weapp: {
      appid: ciConfig["WEAPP_APPID"] || "",
      privateKeyPath: ciConfig["WEAPP_PRIVATE_KEY_PATH"] || ""
    },
    version: ciConfig["WEAPP_VERSION"] || "1.0.0",
    desc: ciConfig["WEAPP_DESC"] || `${env}环境构建版本`
  }
  
  return {
    plugins: [
      ["@tarojs/plugin-mini-ci", CIPluginOpt],
      // ...
    ],
    // ...
  }
})
```

### 配置加载逻辑

```
命令: npm run ci:weapp:upload:test
        ↓
mode = "test"
        ↓
加载 ci.test.config.js
（不存在则 fallback 到 ci.config.js）
        ↓
传递给 @tarojs/plugin-mini-ci
        ↓
调用 miniprogram-ci 上传
```

---

## 版本管理最佳实践

### 方案 1: 手动管理

```javascript
// ci.config.js
module.exports = {
  WEAPP_VERSION: "1.1.8",  // 每次上传前手动更新
  // ...
}
```

**适用**: 小团队，发布频率低

---

### 方案 2: 同步 package.json

```javascript
// ci.config.js
const pkg = require('./package.json')

module.exports = {
  WEAPP_VERSION: pkg.version,  // 自动同步
  // ...
}
```

**使用**:

```bash
# 更新版本号
npm version patch  # 1.1.8 -> 1.1.9
npm version minor  # 1.1.9 -> 1.2.0
npm version major  # 1.2.0 -> 2.0.0

# 上传
npm run ci:weapp:upload:test
```

**适用**: 版本管理规范的团队

---

### 方案 3: 时间戳版本

```javascript
// ci.config.js
const pkg = require('./package.json')
const timestamp = Date.now()

module.exports = {
  WEAPP_VERSION: `${pkg.version}.${timestamp}`,  // 1.1.8.1675843200000
  // ...
}
```

**优点**: 
- 每次上传都是唯一版本号
- 不会冲突

**缺点**:
- 版本号不直观
- 难以追踪

**适用**: 开发阶段频繁上传

---

### 方案 4: Git 信息版本

```javascript
// ci.config.js
const pkg = require('./package.json')
const { execSync } = require('child_process')

const gitCommit = execSync('git rev-parse --short HEAD').toString().trim()
const gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()

module.exports = {
  WEAPP_VERSION: `${pkg.version}`,
  WEAPP_DESC: `分支: ${gitBranch}, 提交: ${gitCommit}`,  // 包含 git 信息
  // ...
}
```

**优点**:
- 可追溯到具体代码版本
- 便于问题定位

**适用**: 使用 Git 的团队

---

## 安全注意事项

### 1. 私钥文件保护

**必须做**:

```bash
# .gitignore
ainative-app/key/*.key
ainative-app/ci.*.config.js  # 可选，如果包含敏感信息
```

**权限设置**:

```bash
chmod 600 key/private.*.key
```

**备份私钥**:
- 将私钥安全存储（密码管理器、加密云盘）
- 团队成员各自保管
- 设置私钥过期提醒

---

### 2. 配置文件保护

**方案 1**: 配置文件不提交到仓库

```bash
# .gitignore
ci.config.js
ci.test.config.js

# 提供模板文件
ci.config.example.js
```

```javascript
// ci.config.example.js
module.exports = {
  WEAPP_APPID: "wxXXXXXXXXXXXXXXXX",  // 替换为实际 AppID
  WEAPP_PRIVATE_KEY_PATH: "key/private.wxXXXXXXXXXXXXXXXX.key",
  WEAPP_VERSION: "1.0.0",
  WEAPP_DESC: "版本描述"
}
```

**方案 2**: 配置文件提交，但不包含敏感信息

```javascript
// ci.config.js (可以提交)
module.exports = {
  WEAPP_APPID: process.env.WEAPP_APPID || "wx003545950d54d0e3",
  WEAPP_PRIVATE_KEY_PATH: process.env.WEAPP_PRIVATE_KEY_PATH || "key/private.key",
  WEAPP_VERSION: "1.1.8",
  WEAPP_DESC: "版本描述"
}
```

```bash
# .env (不提交)
WEAPP_APPID=wx003545950d54d0e3
WEAPP_PRIVATE_KEY_PATH=key/private.wx003545950d54d0e3.key
```

---

### 3. CI/CD 环境变量

在 CI/CD 平台中使用环境变量：

**GitHub Actions**:

```yaml
# .github/workflows/upload.yml
- name: Upload to WeChat
  env:
    WEAPP_APPID: ${{ secrets.WEAPP_APPID }}
    WEAPP_PRIVATE_KEY: ${{ secrets.WEAPP_PRIVATE_KEY }}
  run: |
    echo "$WEAPP_PRIVATE_KEY" > key/private.key
    npm run ci:weapp:upload:test
```

**GitLab CI**:

```yaml
# .gitlab-ci.yml
upload:
  script:
    - echo "$WEAPP_PRIVATE_KEY" > key/private.key
    - npm run ci:weapp:upload:test
  variables:
    WEAPP_APPID: $WEAPP_APPID
```

---

## 配置验证

### 验证脚本

创建一个验证脚本，检查配置是否正确：

```javascript
// scripts/validate-ci-config.js
const fs = require('fs')
const path = require('path')

function validateConfig(configPath) {
  console.log(`\n验证配置: ${configPath}`)
  
  // 检查配置文件存在
  if (!fs.existsSync(configPath)) {
    console.error(`❌ 配置文件不存在: ${configPath}`)
    return false
  }
  console.log(`✅ 配置文件存在`)
  
  // 加载配置
  const config = require(path.resolve(configPath))
  
  // 检查必填字段
  const requiredFields = ['WEAPP_APPID', 'WEAPP_PRIVATE_KEY_PATH', 'WEAPP_VERSION', 'WEAPP_DESC']
  for (const field of requiredFields) {
    if (!config[field]) {
      console.error(`❌ 缺少必填字段: ${field}`)
      return false
    }
    console.log(`✅ ${field}: ${config[field]}`)
  }
  
  // 检查私钥文件
  const keyPath = path.resolve('ainative-app', config.WEAPP_PRIVATE_KEY_PATH)
  if (!fs.existsSync(keyPath)) {
    console.error(`❌ 私钥文件不存在: ${keyPath}`)
    return false
  }
  console.log(`✅ 私钥文件存在`)
  
  // 检查 AppID 格式
  if (!/^wx[a-zA-Z0-9]{16}$/.test(config.WEAPP_APPID)) {
    console.warn(`⚠️  AppID 格式可能不正确: ${config.WEAPP_APPID}`)
  }
  
  // 检查版本号格式
  if (!/^\d+\.\d+\.\d+/.test(config.WEAPP_VERSION)) {
    console.warn(`⚠️  版本号格式建议使用 x.y.z: ${config.WEAPP_VERSION}`)
  }
  
  console.log(`✅ 配置验证通过`)
  return true
}

// 验证所有配置
const configs = [
  'ainative-app/ci.config.js',
  'ainative-app/ci.test.config.js'
]

let allValid = true
for (const config of configs) {
  if (fs.existsSync(config)) {
    allValid = validateConfig(config) && allValid
  }
}

process.exit(allValid ? 0 : 1)
```

**使用**:

```bash
node scripts/validate-ci-config.js
```

---

## 配置模板

### 完整配置模板

```javascript
// ci.config.js
/**
 * 微信小程序 CI 配置
 * 
 * 说明:
 * - 此文件用于配置小程序代码上传参数
 * - 请确保私钥文件已正确放置在 key/ 目录下
 * - 版本号建议使用语义化版本 (major.minor.patch)
 * 
 * 安全提示:
 * - 私钥文件不应提交到代码仓库
 * - 建议将此配置文件添加到 .gitignore（如果包含敏感信息）
 */

module.exports = {
  /**
   * 小程序 AppID
   * 获取: 微信公众平台 → 开发 → 开发设置 → 开发者 ID
   */
  WEAPP_APPID: "wx003545950d54d0e3",
  
  /**
   * 上传私钥路径（相对于此文件）
   * 获取: 微信公众平台 → 开发 → 开发设置 → 小程序代码上传密钥
   */
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key",
  
  /**
   * 版本号（语义化版本）
   * 格式: major.minor.patch
   * 示例: 1.0.0, 1.2.3
   */
  WEAPP_VERSION: "1.1.8",
  
  /**
   * 版本描述
   * 建议包含: 新增功能、修复问题、优化项
   */
  WEAPP_DESC: "修复异常问题，支持配置商品协议、优化部分体验"
}
```

---

## 常见配置错误

### 错误 1: 路径错误

```javascript
// ❌ 错误：使用绝对路径
WEAPP_PRIVATE_KEY_PATH: "/Users/xxx/project/key/private.key"

// ✅ 正确：使用相对路径
WEAPP_PRIVATE_KEY_PATH: "key/private.key"
```

### 错误 2: AppID 错误

```javascript
// ❌ 错误：多余的空格或引号
WEAPP_APPID: " wx003545950d54d0e3 "

// ✅ 正确
WEAPP_APPID: "wx003545950d54d0e3"
```

### 错误 3: 格式错误

```javascript
// ❌ 错误：缺少 module.exports
{
  WEAPP_APPID: "wx003545950d54d0e3",
  // ...
}

// ✅ 正确
module.exports = {
  WEAPP_APPID: "wx003545950d54d0e3",
  // ...
}
```

### 错误 4: 私钥文件命名

```javascript
// ❌ 错误：文件名不匹配
WEAPP_PRIVATE_KEY_PATH: "key/private.key"
// 实际文件: key/private.wx003545950d54d0e3.key

// ✅ 正确：确保文件名一致
WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key"
```

---

## 配置更新记录

建议在配置文件中记录更新历史：

```javascript
/**
 * 更新记录:
 * 
 * 2025-02-05
 * - 更新版本号为 1.1.8
 * - 新增用户中心功能
 * 
 * 2025-02-01
 * - 更新版本号为 1.1.7
 * - 修复订单列表问题
 */
module.exports = {
  // ...
}
```
