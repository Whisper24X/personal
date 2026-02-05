# 小程序 CI 验证指南

## 📋 概述

小程序项目与传统 Web 项目不同，**无需执行 npm run build 等构建命令**，而是通过微信小程序 CI 工具生成体验版二维码进行验证。

## 🚀 快速开始

### 前置条件检查

```bash
# 1. 检查私钥配置状态
make app-check-key
```

如果显示"私钥文件不存在"，请继续下一步配置。

### 首次配置（仅需一次）

#### 1. 获取微信小程序私钥

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入您的小程序后台
3. 点击左侧菜单：**开发** → **开发设置**
4. 找到 **小程序代码上传** 部分
5. 点击 **生成** 按钮，生成新的代码上传密钥
6. 下载密钥文件（通常命名为 `private.xxx.key`）

#### 2. 配置私钥文件

```bash
# 创建密钥目录
mkdir -p ainative-app/key

# 将下载的密钥文件复制到 key 目录
# 测试环境（AppID: wx60377e5c4f19d3be）
cp ~/Downloads/private.wx60377e5c4f19d3be.key ainative-app/key/

# 生产环境（AppID: wx003545950d54d0e3）
cp ~/Downloads/private.wx003545950d54d0e3.key ainative-app/key/
```

#### 3. 启用微信开发者工具服务端口

1. 打开 **微信开发者工具**
2. 点击 **设置** → **安全设置**
3. 开启 **服务端口**

#### 4. 验证配置

```bash
# 再次检查配置
make app-check-key

# 应该看到所有项都显示 ✓
```

## 📱 使用方式

### 方式一：生成预览二维码（推荐）

**最快速的验证方式**，无需在微信后台操作，直接生成二维码扫码预览。

```bash
# 在项目根目录执行
make app-preview
```

执行后会：
1. 自动编译小程序代码
2. 调用微信 CI 生成预览二维码
3. 二维码图片保存在本地
4. 使用微信扫描二维码即可体验

### 方式二：上传到微信后台

上传代码到微信后台，可设为体验版供多人测试。

```bash
# 测试环境
make app-upload-test

# 预发布环境
make app-upload-stage

# 生产环境
make app-upload-prod
```

上传完成后：
1. 登录微信公众平台
2. 进入 **版本管理**
3. 在 **开发版本** 中找到刚上传的版本
4. 点击 **设为体验版**
5. 生成体验版二维码供团队测试

## 🔄 完整验证流程示例

### 场景 1：日常开发测试

```bash
# 1. 进入小程序目录开发
cd ainative-app
# ... 进行代码修改 ...

# 2. 回到根目录，直接生成预览二维码
cd ..
make app-preview

# 3. 扫描二维码，立即看到效果
```

### 场景 2：提交测试版本

```bash
# 1. 提交代码
cd ainative-app
git add .
git commit -m "feat: 新增支付功能"
cd ..

# 2. 推送到远程仓库
make subtree-push-app

# 3. 上传测试版本
make app-upload-test

# 4. 通知测试人员扫码测试
```

### 场景 3：发布体验版

```bash
# 1. 拉取最新代码
make subtree-pull-app

# 2. 上传预发布版本
make app-upload-stage

# 3. 在微信后台设为体验版
# 登录 mp.weixin.qq.com -> 版本管理 -> 设为体验版
```

## 📂 配置文件说明

### 测试/开发环境配置

**文件位置**：`ainative-app/ci.test.config.js`

```javascript
module.exports = {
  WEAPP_APPID: "wx60377e5c4f19d3be",
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx60377e5c4f19d3be.key",
  WEAPP_VERSION: "1.1.8",
  WEAPP_DESC: "测试环境版本"
}
```

### 生产/预发布环境配置

**文件位置**：`ainative-app/ci.config.js`

```javascript
module.exports = {
  WEAPP_APPID: "wx003545950d54d0e3",
  WEAPP_PRIVATE_KEY_PATH: "key/private.wx003545950d54d0e3.key",
  WEAPP_VERSION: "1.1.8",
  WEAPP_DESC: "生产环境版本"
}
```

### 修改版本号和描述

直接编辑对应的配置文件：

```bash
# 编辑测试环境配置
vim ainative-app/ci.test.config.js

# 修改版本号和描述
WEAPP_VERSION: "1.2.0",
WEAPP_DESC: "新增支付功能、优化用户体验"
```

## ❓ 常见问题

### 1. 私钥文件格式错误

**错误信息**：
```
generate local signature fail. Usually this happens the content or encoding of private key file is incorrect
```

**解决方法**：
1. 重新从微信公众平台下载私钥
2. 确保私钥文件内容格式正确（以 `-----BEGIN PRIVATE KEY-----` 开头）
3. 检查文件编码为 UTF-8
4. 在 macOS/Linux 上设置权限：`chmod 600 ainative-app/key/private.*.key`

### 2. 微信开发者工具未启动

**错误信息**：
```
connect ECONNREFUSED 127.0.0.1:xxxxx
```

**解决方法**：
1. 打开微信开发者工具
2. 确保已开启"设置 → 安全设置 → 服务端口"

### 3. 没有上传权限

**错误信息**：
```
errcode: 85064, errmsg: no permission
```

**解决方法**：
1. 确认您的微信账号是该小程序的开发者或管理员
2. 在微信公众平台"成员管理"中检查权限

### 4. AppID 不匹配

**错误信息**：
```
invalid appid
```

**解决方法**：
1. 检查 `ci.test.config.js` 或 `ci.config.js` 中的 APPID
2. 确认私钥文件对应的 APPID 正确
3. 使用 `make app-check-key` 检查配置

## 🔐 安全注意事项

1. **私钥文件安全**
   - ✅ 私钥文件已在 `.gitignore` 中，不会被提交到 Git
   - ⚠️ 不要将私钥文件分享给他人
   - ⚠️ 不要上传到公共仓库或聊天工具

2. **权限管理**
   - 仅给需要上传代码的成员配置私钥
   - 定期更换私钥（在微信公众平台重新生成）

## 📊 与传统 Web 项目的区别

| 特性 | 传统 Web 项目 | 小程序项目 |
|-----|-------------|----------|
| 构建命令 | `npm run build` | 无需（CI 自动处理） |
| 部署方式 | 上传到服务器 | 上传到微信后台 |
| 验证方式 | 访问 URL | 扫描二维码 |
| 审核流程 | 无 | 需要微信审核（正式版） |
| 热更新 | 支持 | 不支持（需重新上传） |

## 🛠️ 原理说明

### CI 命令执行流程

```
make app-preview
    ↓
进入 ainative-app 目录
    ↓
执行 pnpm ci:weapp:preview
    ↓
Taro CLI 编译代码（根据环境变量）
    ↓
调用 @tarojs/plugin-mini-ci 插件
    ↓
使用 miniprogram-ci SDK
    ↓
微信 CI 服务器生成二维码
    ↓
保存二维码图片到本地
```

### 环境配置流程

```
Taro CLI 读取 --mode 参数
    ↓
根据 mode 加载对应的 ci 配置
    ↓
test/development → ci.test.config.js
stage/production → ci.config.js
    ↓
获取 APPID、私钥路径、版本号等
    ↓
调用微信 CI 接口
```

## 📚 相关文档

- [微信小程序 CI 文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)
- [Taro CI 插件文档](https://taro-docs.jd.com/docs/next/taro-mini-ci)
- [ainative-app 开发指南](../ainative-app/README.md)

## 💡 提示

- ✅ 使用 `make app-preview` 是最快的验证方式
- ✅ 预览二维码有效期为 30 分钟
- ✅ 体验版可以分享给最多 100 人
- ✅ 多个环境可以使用不同的 APPID
- ✅ 版本号建议使用语义化版本（如 1.2.0）
