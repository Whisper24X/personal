# 故障排查指南

## 常见错误及解决方案

### 错误类型 1: 配置相关

#### 错误 1.1: 私钥文件不存在

**错误信息**：
```
Error: privateKeyPath 文件不存在或路径不正确
Error: no such file or directory, open 'key/private.wx*.key'
```

**原因**：
- 私钥文件未下载
- 私钥文件路径配置错误
- 私钥文件命名不匹配

**解决方案**：

1. **检查私钥文件是否存在**：
```bash
cd ainative-app
ls -la key/
```

2. **验证配置文件中的路径**：
```javascript
// ci.config.js
WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key"
```

3. **重新下载私钥**：
   - 登录微信公众平台
   - 开发 → 开发管理 → 开发设置
   - 小程序代码上传密钥 → 生成/下载
   - 将文件放到 `ainative-app/key/` 目录
   - 确保文件名与配置一致

4. **检查文件权限**：
```bash
chmod 600 key/private.wx*.key
```

---

#### 错误 1.2: AppID 不匹配或不正确

**错误信息**：
```
Error: appid 不正确
Error: invalid appid
```

**原因**：
- CI 配置中的 AppID 与实际小程序不符
- 私钥对应的小程序与 AppID 不匹配

**解决方案**：

1. **对比配置文件**：
```javascript
// ci.config.js
WEAPP_APPID: "wx003545950d54d0e3"

// project.config.json
"appid": "wx60377e5c4f19d3be"
```

2. **确认正确的 AppID**：
   - 登录微信公众平台
   - 开发 → 开发设置 → 开发者ID
   - 复制 AppID

3. **更新配置**：
```javascript
// ci.config.js
module.exports = {
  WEAPP_APPID: "正确的AppID",
  // ...
}
```

4. **同步 project.config.json**：
```json
{
  "appid": "正确的AppID",
  // ...
}
```

---

#### 错误 1.3: 配置文件格式错误

**错误信息**：
```
SyntaxError: Unexpected token
Error: Cannot find module './ci.config.js'
```

**原因**：
- 配置文件语法错误
- 配置文件不存在
- module.exports 格式错误

**解决方案**：

1. **检查配置文件格式**：
```javascript
// 正确格式
module.exports = {
  WEAPP_APPID: "wx003545950d54d0e3",
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key",
  WEAPP_VERSION: "1.1.8",
  WEAPP_DESC: "版本描述"
}

// 错误格式（缺少 module.exports）
{
  WEAPP_APPID: "wx003545950d54d0e3",
  // ...
}
```

2. **检查文件是否存在**：
```bash
ls -la ainative-app/ci.config.js
ls -la ainative-app/ci.test.config.js
```

3. **验证 JSON 语法**：
   - 使用在线 JSON 验证器
   - 检查是否有多余的逗号
   - 检查引号是否正确闭合

---

### 错误类型 2: 构建相关

#### 错误 2.1: 构建失败

**错误信息**：
```
Error: Build failed
ERROR in ./src/pages/index/index.vue
```

**原因**：
- TypeScript 类型错误
- ESLint 检查失败
- 语法错误
- 依赖缺失

**解决方案**：

1. **先单独测试构建**：
```bash
cd ainative-app
npm run build:weapp:test
```

2. **检查 TypeScript 错误**：
```bash
npx tsc --noEmit
```

3. **检查 ESLint 错误**：
```bash
npm run lint
```

4. **自动修复格式问题**：
```bash
npm run format:fix
```

5. **清理并重新安装依赖**：
```bash
rm -rf node_modules
npm install
```

6. **清理构建缓存**：
```bash
rm -rf dist
rm -rf .taro-cache
```

---

#### 错误 2.2: 依赖安装失败

**错误信息**：
```
npm ERR! code ERESOLVE
npm ERR! peer dep missing
```

**原因**：
- 依赖版本冲突
- npm/node 版本不兼容
- 网络问题

**解决方案**：

1. **检查 Node 版本**：
```bash
node -v  # 建议 >= 16.x
npm -v   # 建议 >= 8.x
```

2. **清理 npm 缓存**：
```bash
npm cache clean --force
```

3. **使用 --legacy-peer-deps**：
```bash
npm install --legacy-peer-deps
```

4. **切换 npm 镜像**：
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

---

#### 错误 2.3: Vite 构建错误

**错误信息**：
```
Error: Transform failed with X error
[vite] Internal server error
```

**原因**：
- Vite 配置问题
- 插件冲突
- 缓存损坏

**解决方案**：

1. **清理 Vite 缓存**：
```bash
rm -rf node_modules/.vite
```

2. **检查 Vite 版本**：
```json
// package.json
"vite": "^4.5.10"  // 确保版本兼容
```

3. **重新构建**：
```bash
npm run build:weapp:test
```

---

### 错误类型 3: 上传相关

#### 错误 3.1: 上传超时

**错误信息**：
```
Error: upload timeout
Error: network error
```

**原因**：
- 网络连接不稳定
- 文件体积过大
- 微信服务器响应慢

**解决方案**：

1. **检查网络连接**：
```bash
ping mp.weixin.qq.com
```

2. **增加超时时间**：
   - 在调用时设置更长的 `block_until_ms`
   - 例如：`block_until_ms: 300000`（5分钟）

3. **优化包体积**：
```bash
# 检查包大小
du -sh dist/

# 移除不必要的文件
# 检查 copy.patterns 配置
```

4. **分包构建**：
   - 检查是否启用了分包配置
   - 优化主包大小

5. **重试上传**：
```bash
npm run ci:weapp:upload:test
```

---

#### 错误 3.2: 权限不足

**错误信息**：
```
Error: 权限不足
Error: no permission to upload
```

**原因**：
- 私钥没有上传权限
- 账号不是管理员或开发者
- 私钥已过期或被禁用

**解决方案**：

1. **检查账号权限**：
   - 登录微信公众平台
   - 管理 → 成员管理
   - 确认账号角色（管理员/开发者）

2. **重新生成私钥**：
   - 开发 → 开发管理 → 开发设置
   - 小程序代码上传密钥 → 重置
   - 下载新的私钥文件

3. **检查 IP 白名单**：
   - 开发 → 开发设置 → IP 白名单
   - 添加当前机器的公网 IP

---

#### 错误 3.3: 版本号重复

**错误信息**：
```
Error: 版本号已存在
Error: version already exists
```

**原因**：
- 相同版本号已经上传过
- 未更新版本号

**解决方案**：

1. **更新版本号**：
```javascript
// ci.config.js
module.exports = {
  WEAPP_VERSION: "1.1.9",  // 递增版本号
  // ...
}
```

2. **使用自动版本号**：
```javascript
// ci.config.js
const pkg = require('./package.json')
const timestamp = new Date().getTime()
module.exports = {
  WEAPP_VERSION: `${pkg.version}.${timestamp}`,
  // ...
}
```

3. **在微信后台删除旧版本**（不推荐）：
   - 登录微信公众平台
   - 管理 → 版本管理
   - 删除重复的开发版本

---

### 错误类型 4: 运行时相关

#### 错误 4.1: 构建成功但小程序无法运行

**症状**：
- 上传成功
- 打开小程序白屏或报错

**可能原因**：
- 环境配置错误
- API 地址配置错误
- 依赖库未正确打包

**解决方案**：

1. **检查环境变量**：
```typescript
// config/index.ts
defineConstants: {
  __ENV_TYPE: JSON.stringify(env)  // 确认环境变量正确
}
```

2. **检查 API 配置**：
```typescript
// src/config/env.ts
const ENV_CONFIG = {
  test: {
    baseURL: 'https://test-api.example.com'
  },
  // ...
}
```

3. **在微信开发者工具中调试**：
   - 打开微信开发者工具
   - 选择对应的小程序
   - 查看控制台错误信息
   - 使用调试工具排查

4. **检查包完整性**：
```bash
# 查看打包后的文件
ls -la dist/
```

---

#### 错误 4.2: 部分页面无法访问

**症状**：
- 首页正常
- 某些页面 404 或无法跳转

**可能原因**：
- 路由配置错误
- 页面未正确打包
- 分包配置问题

**解决方案**：

1. **检查路由配置**：
```typescript
// app.config.ts
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/user/index'  // 确认所有页面都已配置
  ],
  // ...
})
```

2. **检查分包配置**：
```typescript
// app.config.ts
export default defineAppConfig({
  subPackages: [
    {
      root: 'pages/sub',
      pages: ['index/index']
    }
  ]
})
```

3. **验证页面文件存在**：
```bash
ls -la src/pages/user/index.vue
ls -la dist/pages/user/index.js
```

---

## 调试技巧

### 1. 开启详细日志

在构建时查看详细日志：

```bash
cd ainative-app
npm run ci:weapp:upload:test -- --verbose
```

### 2. 本地预览

上传前先本地预览：

```bash
# 开启开发模式
npm run dev:weapp

# 在微信开发者工具中打开 dist 目录
```

### 3. 使用预览功能

使用 Taro 的预览功能（生成二维码但不上传）：

```bash
npm run ci:weapp:preview
```

### 4. 分步骤调试

```bash
# 步骤 1: 只构建，不上传
npm run build:weapp:test

# 步骤 2: 检查构建产物
ls -la dist/

# 步骤 3: 在开发者工具中测试
# 手动打开微信开发者工具，导入 dist 目录

# 步骤 4: 确认无误后再上传
npm run ci:weapp:upload:test
```

### 5. 查看配置加载情况

添加调试日志到配置文件：

```typescript
// config/index.ts
const ciConfigPath = path.resolve(__dirname, "../ci.config.js")
console.log("加载 CI 配置:", ciConfigPath)
if (fs.existsSync(ciConfigPath)) {
  const config = require(ciConfigPath)
  console.log("CI 配置内容:", JSON.stringify(config, null, 2))
}
```

---

## 预防措施

### 1. 上传前检查清单

在执行上传命令前，确认：

```
□ 代码已通过 ESLint 检查
□ TypeScript 编译无错误
□ 本地构建成功
□ 版本号已更新
□ 版本描述已填写
□ CI 配置文件存在
□ 私钥文件存在
□ 网络连接正常
□ 确认目标环境正确
```

### 2. 创建上传脚本

创建一个包含所有检查的脚本：

```bash
#!/bin/bash
# scripts/safe-upload.sh

set -e  # 遇到错误立即退出

echo "🔍 执行上传前检查..."

# 检查 CI 配置
if [ ! -f "ci.config.js" ]; then
  echo "❌ ci.config.js 不存在"
  exit 1
fi
echo "✅ CI 配置文件存在"

# 检查私钥
PRIVATE_KEY=$(node -p "require('./ci.config.js').WEAPP_PRIVATE_KEY_PATH")
if [ ! -f "$PRIVATE_KEY" ]; then
  echo "❌ 私钥文件不存在: $PRIVATE_KEY"
  exit 1
fi
echo "✅ 私钥文件存在"

# 代码检查
echo "🔍 运行 ESLint..."
npm run lint

# 构建测试
echo "🔨 测试构建..."
npm run build:weapp:test

# 执行上传
echo "📤 开始上传..."
npm run ci:weapp:upload:test

echo "✅ 上传完成"
```

### 3. 使用版本管理工具

自动管理版本号：

```bash
# scripts/bump-version.sh
#!/bin/bash

# 读取当前版本
CURRENT=$(node -p "require('./package.json').version")
echo "当前版本: $CURRENT"

# 询问版本类型
read -p "版本类型 (major/minor/patch): " TYPE

# 更新版本号
npm version $TYPE --no-git-tag-version

# 同步到 CI 配置
NEW_VERSION=$(node -p "require('./package.json').version")
sed -i '' "s/WEAPP_VERSION: \".*\"/WEAPP_VERSION: \"$NEW_VERSION\"/" ci.config.js

echo "✅ 版本更新为: $NEW_VERSION"
```

---

## 紧急情况处理

### 情况 1: 错误版本已上传

**处理步骤**：

1. 立即在微信后台删除该版本
2. 修复代码问题
3. 更新版本号
4. 重新上传
5. 通知测试人员使用新版本

### 情况 2: 生产环境误上传测试代码

**处理步骤**：

1. **不要提交审核**
2. 在微信后台删除该版本
3. 检查配置文件，确认环境配置正确
4. 重新上传正确的代码
5. 建立环境隔离机制（使用不同 AppID）

### 情况 3: 私钥泄露

**处理步骤**：

1. 立即登录微信公众平台
2. 开发 → 开发管理 → 开发设置
3. 重置小程序代码上传密钥
4. 下载新的私钥
5. 更新本地配置
6. 删除旧私钥文件
7. 检查是否有异常版本上传

---

## 性能优化建议

### 1. 减少包体积

```javascript
// config/prod.ts
export default {
  mini: {
    optimizeMainPackage: {
      enable: true
    },
    // 启用 tree shaking
    minify: true,
    // 压缩图片
    imageUrlLoaderOption: {
      limit: 10240  // 10KB 以下的图片转 base64
    }
  }
}
```

### 2. 使用分包

```typescript
// app.config.ts
export default defineAppConfig({
  pages: [
    'pages/index/index'  // 主包只放首页
  ],
  subPackages: [
    {
      root: 'pages/sub',
      pages: [
        'user/index',
        'order/index'
      ]
    }
  ],
  preloadRule: {
    'pages/index/index': {
      network: 'all',
      packages: ['pages/sub']
    }
  }
})
```

### 3. 优化依赖

```json
// package.json
{
  "dependencies": {
    // 只安装必要的依赖
    // 避免安装体积大的库
  }
}
```

### 4. 构建缓存

使用构建缓存加快构建速度：

```javascript
// config/index.ts
export default {
  cache: {
    enable: true
  }
}
```

---

## 日志分析

### 成功上传的日志特征

```
构建环境: build 目标环境: test
✓ 构建完成
✓ 上传代码中...
✓ 上传成功
体验版二维码: https://...
```

### 失败上传的日志特征

```
构建环境: build 目标环境: test
✓ 构建完成
✗ 上传代码中...
Error: [错误信息]
```

### 关键日志位置

- Taro 构建日志：终端输出
- 微信 CI 日志：`~/.miniprogram-ci/logs/`
- 错误详情：`dist/` 目录下的 `.log` 文件

---

## 联系支持

如果以上方案都无法解决问题：

1. **检查 Taro 官方文档**：https://taro-docs.jd.com/
2. **查看微信小程序开发文档**：https://developers.weixin.qq.com/miniprogram/dev/
3. **在 Taro 社区提问**：https://taro-club.jd.com/
4. **查看 GitHub Issues**：https://github.com/NervJS/taro/issues
5. **联系项目维护者**：通过项目内部渠道反馈
