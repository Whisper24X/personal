# 小程序二维码页面配置

## 设计方案

小程序项目在沙箱中提供一个静态页面来展示通过小程序 CI 生成的预览二维码。

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      用户操作流程                            │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
                  ┌────────────────────┐
                  │ make app-preview   │
                  └────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │ Taro CLI 编译    │      │ 微信 CI 生成     │
    │ 小程序代码       │      │ 预览二维码       │
    └──────────────────┘      └──────────────────┘
                │                         │
                │                         ▼
                │              ┌──────────────────────┐
                │              │ 保存到:               │
                │              │ ainative-app/qrcode/ │
                │              │ preview.png          │
                │              └──────────────────────┘
                │                         │
                └─────────────┬───────────┘
                              │
                              ▼
                  ┌─────────────────────┐
                  │ 沙箱 Nginx 服务     │
                  │ 端口 8200           │
                  └─────────────────────┘
                              │
                              ▼
                  ┌─────────────────────┐
                  │ 静态 HTML 页面      │
                  │ 展示二维码          │
                  └─────────────────────┘
                              │
                              ▼
                  ┌─────────────────────┐
                  │ 浏览器访问:         │
                  │ /app/               │
                  └─────────────────────┘
```

---

## 文件结构

```
sandbox/
├── app-qrcode.nginx.conf      # 小程序二维码页面 Nginx 配置（端口 8200）
├── app-qrcode-page.html       # 二维码展示页面（静态 HTML）
├── Dockerfile                 # 添加了页面复制逻辑
├── supervisord.conf           # app-qrcode 服务配置
└── nginx.conf                 # 主网关，/app/ 代理到 8200

ainative-app/
├── qrcode/                    # 二维码存储目录（自动创建，已忽略）
│   └── preview.png           # 预览二维码图片
├── config/
│   └── index.ts              # 添加了 qrcodeOutputDest 配置
└── .gitignore                # 添加了 qrcode/ 规则
```

---

## 配置详情

### 1. Taro CI 配置 (ainative-app/config/index.ts)

```typescript
const CIPluginOpt = {
  weapp: {
    appid: ciConfig["WEAPP_APPID"],
    privateKeyPath: ciConfig["WEAPP_PRIVATE_KEY_PATH"]
  },
  version: ciConfig["WEAPP_VERSION"],
  desc: ciConfig["WEAPP_DESC"],
  qrcodeOutputDest: path.resolve(__dirname, "../qrcode/preview.png") // 指定二维码保存路径
}
```

### 2. Supervisor 配置 (sandbox/supervisord.conf)

```ini
[program:app-qrcode]
command=/usr/sbin/nginx -c /etc/nginx/app-qrcode.conf -g "daemon off;"
autostart=true
autorestart=true
startsecs=5
startretries=3
priority=120
```

### 3. Nginx 配置 (sandbox/app-qrcode.nginx.conf)

```nginx
server {
    listen 8200;
    root /workspace/ainative-app-qrcode;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /qrcode/ {
        alias /workspace/ainative-app/qrcode/;
        autoindex on;  # 允许目录浏览
    }
}
```

### 4. 主网关配置 (sandbox/nginx.conf)

```nginx
location /app/ {
    proxy_pass http://0.0.0.0:8200/;
    # ... proxy headers
}
```

---

## 页面功能

### 二维码展示页面特性

1. **自动检测二维码**
   - 页面加载时自动检查 `/qrcode/` 目录
   - 如果存在二维码图片，自动显示
   - 如果不存在，显示占位符和使用说明

2. **自动刷新**
   - 每 30 秒自动检查一次新二维码
   - 可手动点击"刷新页面"按钮

3. **状态提示**
   - 二维码已生成（绿色）
   - 等待生成二维码（黄色）
   - 显示最后检查时间

4. **使用说明**
   - 完整的操作步骤
   - 命令示例
   - 有效期提示

---

## 使用流程

### 步骤 1: 生成二维码

在项目根目录执行：
```bash
make app-preview
```

这会：
1. 编译小程序代码
2. 调用微信 CI 生成预览二维码
3. 保存到 `ainative-app/qrcode/preview.png`

### 步骤 2: 在沙箱中查看

访问沙箱地址：
```bash
http://localhost:8070/app/
```

或从沙箱首页点击 "App" 链接。

### 步骤 3: 扫码预览

使用微信扫描页面上显示的二维码，即可预览小程序。

---

## 访问路径

| 路径 | 说明 | 端口 |
|------|------|------|
| http://localhost:8070/ | 沙箱首页（3 个服务链接） | 8070 |
| http://localhost:8070/app/ | 小程序二维码页面 | 8070 → 8200 |
| http://localhost:8070/api/ | 后端 API | 8070 → 8000 |
| http://localhost:8070/shadow/ | 管理后台 | 8070 → 8100 |

---

## 与 CI 集成

### make app-preview 命令流程

```bash
make app-preview
    ↓
cd ainative-app && pnpm ci:weapp:preview
    ↓
taro build --type weapp --preview
    ↓
读取 config/index.ts 中的 qrcodeOutputDest 配置
    ↓
调用微信 CI 生成二维码
    ↓
保存到 ainative-app/qrcode/preview.png
    ↓
沙箱页面自动检测并显示
```

---

## 故障排查

### 问题 1: 页面无法访问

**检查**:
```bash
make sandbox-status | grep app-qrcode
```

**解决**:
```bash
make sandbox-shell
supervisorctl restart app-qrcode
```

### 问题 2: 二维码不显示

**检查**:
```bash
ls -la ainative-app/qrcode/
```

**解决**:
- 确认已执行 `make app-preview`
- 检查 CI 配置是否正确
- 查看 Taro 构建日志

### 问题 3: 二维码路径错误

**检查 Nginx 配置**:
```bash
make sandbox-shell
cat /etc/nginx/app-qrcode.conf
```

**验证文件挂载**:
```bash
make sandbox-shell
ls -la /workspace/ainative-app/qrcode/
```

---

## 相关文档

- [CI 快速参考](ci-quick-reference.md)
- [CI 验证指南](ci-guide.md)
- [Taro CI 插件文档](https://taro-docs.jd.com/docs/next/taro-mini-ci)
