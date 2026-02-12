---
name: app-ci
description: 小程序 CI 验证与部署：预览二维码生成、体验版上传、私钥配置、多环境支持、沙箱二维码页面。当用户提到"小程序验证"、"小程序CI"、"app-preview"、"二维码"、"私钥配置"、"小程序上传"或需要验证小程序代码时使用。
---

# 小程序 CI 验证与部署

小程序项目**无需 npm run build**，通过微信 CI 一键生成预览二维码或上传体验版。Taro CLI 在执行 CI 命令时自动编译代码。

## 核心命令

在项目根目录（yanxue-main/）执行：

```bash
make app-preview          # ⭐ 最常用：生成预览二维码，扫码立即验证
make app-check-key        # 检查私钥配置（首次/排错用）
make app-check            # 全面环境检查（20+ 检查项）
make app-upload-test      # 上传测试环境体验版
make app-upload-stage     # 上传预发布环境体验版
make app-upload-prod      # 上传生产环境体验版
```

## 工作原理

```
make app-preview
    ↓
cd ainative-app && pnpm ci:weapp:preview
    ↓
taro build --type weapp --preview
    ↓
读取 config/index.ts → 根据 mode 加载 CI 配置
    ↓
调用 @tarojs/plugin-mini-ci → miniprogram-ci SDK
    ↓
微信 CI 服务器生成二维码 → 保存到 ainative-app/qrcode/preview.png
    ↓
沙箱二维码页面自动检测并显示（http://localhost:8070/app/）
```

## 环境与配置映射

| Make 命令 | Taro Mode | CI 配置文件 | AppID |
|-----------|-----------|------------|-------|
| app-preview | development | ci.test.config.js | wx60377e5c4f19d3be |
| app-upload-test | test | ci.test.config.js | wx60377e5c4f19d3be |
| app-upload-stage | stage | ci.config.js | wx003545950d54d0e3 |
| app-upload-prod | production | ci.config.js | wx003545950d54d0e3 |

### CI 配置文件格式

`ainative-app/ci.test.config.js`（测试/开发）：

```javascript
module.exports = {
  WEAPP_APPID: "wx60377e5c4f19d3be",
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx60377e5c4f19d3be.key",
  WEAPP_VERSION: "1.1.8",
  WEAPP_DESC: "测试环境版本"
}
```

`ainative-app/ci.config.js`（生产/预发）：

```javascript
module.exports = {
  WEAPP_APPID: "wx003545950d54d0e3",
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key",
  WEAPP_VERSION: "1.1.8",
  WEAPP_DESC: "生产环境版本"
}
```

## 首次配置（仅需一次）

### 1. 获取私钥

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入小程序后台 → 开发 → 开发设置
3. 找到"小程序代码上传" → 点击"生成" → 下载密钥

### 2. 放置私钥

```bash
mkdir -p ainative-app/key
cp ~/Downloads/private.wx60377e5c4f19d3be.key ainative-app/key/   # 测试环境
cp ~/Downloads/private.wx003545950d54d0e3.key ainative-app/key/   # 生产环境
```

### 3. 启用开发者工具服务端口

打开微信开发者工具 → 设置 → 安全设置 → 开启"服务端口"

### 4. 验证

```bash
make app-check-key   # 所有项显示 ✓ 即配置成功
```

## 典型工作流

### 日常开发验证

```bash
cd ainative-app        # 修改代码
cd ..
make app-preview       # 生成二维码扫码验证
```

### 提交测试

```bash
cd ainative-app && git add . && git commit -m "feat: 新功能" && cd ..
make subtree-push-app  # 推送代码
make app-upload-test   # 上传测试版
```

### 发布体验版

```bash
make app-upload-stage  # 上传预发布版
# 登录 mp.weixin.qq.com → 版本管理 → 设为体验版
```

## 沙箱二维码页面

沙箱中 App 服务使用轻量级静态 Nginx 页面，展示 CI 生成的预览二维码。

### 架构

```
http://localhost:8070/app/ → Nginx :8200
    ├─ /           → index.html（二维码展示页面）
    └─ /qrcode/    → ainative-app/qrcode/（二维码图片）
```

### 页面特性

- 自动检测二维码是否存在
- 每 30 秒自动刷新
- 状态提示（✅ 已生成 / ⏳ 等待生成）
- 完整使用说明

### 资源占用

- 启动时间：<1 秒
- 内存占用：~10MB
- CPU 占用：<1%

### 相关配置文件

| 文件 | 作用 |
|------|------|
| `sandbox/app-qrcode.nginx.conf` | 二维码页面 Nginx 配置 |
| `sandbox/app-qrcode-page.html` | 二维码展示页面 HTML |
| `sandbox/supervisord.conf` | app-qrcode 服务配置 |
| `sandbox/nginx.conf` | 主网关 /app/ 代理到 8200 |
| `ainative-app/config/index.ts` | qrcodeOutputDest 配置 |

## 项目文件结构

```
ainative-app/
├── config/index.ts           # Taro 配置（含 CI 插件和 qrcodeOutputDest）
├── ci.test.config.js         # 测试环境 CI 配置
├── ci.config.js              # 生产环境 CI 配置
├── key/                      # 私钥目录（.gitignore）
│   ├── private.wx60377e5c4f19d3be.key  # 测试环境
│   └── private.wx003545950d54d0e3.key  # 生产环境
├── qrcode/                   # 二维码存储（.gitignore）
│   └── preview.png
└── package.json              # CI 脚本定义
```

## 故障排查

### 私钥文件不存在

```
错误: privateKeyPath 文件不存在
```

解决：从微信公众平台下载私钥放到 `ainative-app/key/` 目录。

### 连接失败 (ECONNREFUSED)

```
错误: connect ECONNREFUSED 127.0.0.1:xxxxx
```

解决：打开微信开发者工具 → 设置 → 安全设置 → 开启"服务端口"。

### 没有权限 (no permission)

```
错误: errcode: 85064, errmsg: no permission
```

解决：在微信公众平台"成员管理"中添加开发者权限。

### AppID 不匹配

```
错误: invalid appid
```

解决：检查 `ci.config.js` 中的 APPID 与私钥文件是否对应。使用 `make app-check-key` 诊断。

### 私钥格式错误

```
错误: generate local signature fail
```

解决：
1. 重新从微信公众平台下载私钥
2. 确保文件以 `-----BEGIN PRIVATE KEY-----` 开头
3. 检查文件编码为 UTF-8
4. 设置权限：`chmod 600 ainative-app/key/private.*.key`

### 沙箱二维码不显示

```bash
# 检查二维码文件
ls -la ainative-app/qrcode/

# 检查沙箱内服务
make sandbox-shell
supervisorctl status app-qrcode
ls -la /workspace/ainative-app/qrcode/
```

解决：确认已执行 `make app-preview`，页面会自动刷新检测。

## 安全注意事项

1. **私钥文件**已在 `.gitignore`，不会提交到 Git
2. **不要分享**私钥文件给他人或上传到公共平台
3. **多环境隔离**：测试和生产使用不同 AppID 和私钥
4. 定期在微信公众平台重新生成私钥

## 版本管理

每次上传体验版前建议更新版本号和描述：

```bash
vim ainative-app/ci.test.config.js   # 或 ci.config.js
# 修改 WEAPP_VERSION: "1.2.0"
# 修改 WEAPP_DESC: "新增支付功能"
```

遵循语义化版本：`major.minor.patch`

## 与传统 Web 项目对比

| 特性 | 传统 Web | 小程序 CI |
|------|---------|----------|
| 构建 | npm run build | Taro 自动处理 |
| 部署 | 上传服务器 + Nginx | 直接微信 CI |
| 验证 | 访问 URL | 扫描二维码 |
| 时间 | 5-10 分钟 | 1-2 分钟 |
| 服务器 | 需要 | 不需要 |
