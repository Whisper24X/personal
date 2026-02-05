# 小程序 CI 快速参考

## 🎯 一句话总结

小程序验证**不需要 npm run build**，直接使用 `make app-preview` 生成二维码扫码预览。

---

## ⚡ 快速命令

```bash
# 最常用：生成预览二维码（扫码立即看效果）
make app-preview

# 检查配置（首次使用必看）
make app-check-key

# 上传到微信后台
make app-upload-test    # 测试环境
make app-upload-stage   # 预发布环境
make app-upload-prod    # 生产环境
```

---

## 📋 首次配置清单

- [ ] 1. 从微信公众平台下载私钥文件
- [ ] 2. 创建目录：`mkdir -p ainative-app/key`
- [ ] 3. 复制私钥到：`ainative-app/key/`
- [ ] 4. 打开微信开发者工具，开启"服务端口"
- [ ] 5. 验证配置：`make app-check-key`

> 详细步骤见：[完整配置指南](./小程序CI验证指南.md)

---

## 🔄 典型工作流

### 日常开发
```bash
cd ainative-app        # 进入小程序目录
# ... 修改代码 ...
cd ..                  # 回到根目录
make app-preview       # 生成二维码验证
```

### 提交测试
```bash
cd ainative-app
git add .
git commit -m "feat: 新功能"
cd ..
make subtree-push-app  # 推送代码
make app-upload-test   # 上传测试版
```

---

## 🆚 与 Web 项目对比

| 操作 | Web 项目 | 小程序项目 |
|------|---------|----------|
| 验证 | `npm run build` → 部署 → 访问URL | `make app-preview` → 扫码 |
| 时间 | 5-10分钟 | 1-2分钟 |
| 需要服务器 | ✓ | ✗ |

---

## ❗ 常见错误

| 错误 | 原因 | 解决 |
|-----|------|------|
| 私钥文件不存在 | 未配置私钥 | 从微信后台下载私钥 |
| ECONNREFUSED | 开发者工具未开 | 打开开发者工具并开启服务端口 |
| no permission | 无上传权限 | 联系管理员添加开发者权限 |

---

## 📞 获取帮助

```bash
make help              # 查看所有命令
make app-check-key     # 诊断配置问题
```

📖 [查看完整指南](./小程序CI验证指南.md)
