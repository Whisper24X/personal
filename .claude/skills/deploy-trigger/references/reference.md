# deploy-trigger 参考手册

## 部署接口配置

| 子项目  | 触发方式                                                |
| ------- | ------------------------------------------------------- |
| shadow  | Jarvis API（`https://jarvis-api.yc345.tv/v2/pipeline`） |
| backend | `<BACKEND_WEBHOOK_URL>`（待替换）                       |
| app     | `<APP_WEBHOOK_URL>`（待替换）                           |

---

## 步骤 4 — 触发部署命令

### shadow — Jarvis API

```bash
# 读取 token（优先环境变量，其次配置文件）
TOKEN="${JARVIS_TOKEN:-$(grep 'token' ~/.config/jarvis-cli/config.toml 2>/dev/null | sed 's/.*= *"\(.*\)"/\1/')}"

# 读取 jarvisProjectName
PROJECT_NAME=$(node -e "console.log(require('./ainative-shadow/package.json').jarvisProjectName)")

curl -X POST "https://jarvis-api.yc345.tv/v2/pipeline" \
  -H "accept: application/json" \
  -H "content-type: application/json" \
  -H "origin: https://jarvis.yc345.tv" \
  -H "referer: https://jarvis.yc345.tv/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"tag_type\":\"bug\",\"package_manager\":\"pnpm\",\"branch\":\"develop\",\"project_name\":\"${PROJECT_NAME}\"}"
```

HTTP 非 2xx：输出响应体，提示检查 token 或 project_name。

### backend

```bash
curl -X POST "<BACKEND_WEBHOOK_URL>" \
  -H "Content-Type: application/json" \
  -d '{"ref": "develop"}'
```

### app

```bash
curl -X POST "<APP_WEBHOOK_URL>" \
  -H "Content-Type: application/json" \
  -d '{"ref": "develop"}'
```
