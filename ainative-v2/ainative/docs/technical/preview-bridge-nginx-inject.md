# 任务预览：Runner nginx 自动注入 `preview-iframe-bridge.js`

在 **preview-web** 等走 Runner 内 **nginx 反向代理** 的任务环境里，由 `runner/render-runner-config.mjs` 在 `proxy_pass` 的 HTML 响应上插入

`<script src="<AINATIVE 前端上的 bridge 地址>" defer></script>`

使预览页在**无需改业务仓库 `index.html`** 的情况下，仍能通过 [preview-iframe-bridge.js](../../frontend/public/preview-iframe-bridge.js) 与任务详情 [TaskPreviewPanel](../../frontend/src/features/tasks/detail/TaskPreviewPanel.vue) 的 `postMessage` 协议协作，在应用内多标签中打开链接。

## 工作方式

1. 控制面在启动任务 Runner 容器时，若配置了解析结果非空，则注入环境变量 **`AINATIVE_PREVIEW_BRIDGE_SCRIPT_URL`**（与浏览器可访问的 AINative 前端静态资源 URL 一致，一般为 `{FRONTEND_ORIGIN}[{BASE}]preview-iframe-bridge.js`）。
2. 容器内 `ainative-render-runner-config` 读该环境变量，在 **非 WebSocket** 的 `location` 中追加：
   - `proxy_set_header Accept-Encoding ""`：避免上游 gzip，使 `sub_filter` 能处理 HTML。
   - `sub_filter`：在 `</head>` / `</HEAD>` 前插入 script 标签。
3. 内置的 `/` 首页（`homepage`）若存在，改为在返回的 HTML 中直接带同一 script。

容器外仅 **直连应用端口、不经 Runner nginx** 的预览地址**不会**被注入；需依赖业务自行引入脚本或改用经 Runner 的入口。

## 后端与运维配置

| 环境变量 | 说明 |
| -------- | ---- |
| `AINATIVE_PREVIEW_BRIDGE_SCRIPT_URL` | （可选）显式指定 **完整** bridge 脚本 URL；优先级最高。 |
| `FRONTEND_DOMAIN`（`app.frontendDomain`） | 未设 `..._SCRIPT_URL` 时，用于与 `AINATIVE_FRONTEND_BASE_PATH` 拼出默认脚本地址。 |
| `AINATIVE_FRONTEND_BASE_PATH` | 与前端 Vite `base` 一致（如 `/` 或 `/app/`），默认可省略。 |
| `AINATIVE_PREVIEW_BRIDGE_NGINX_INJECT` | 设为 `0` / `false` 时，不向容器注入 `AINATIVE_PREVIEW_BRIDGE_SCRIPT_URL`，**Runner 内也不做** `sub_filter`（`render-runner-config` 也会在读到的 URL 为空时跳过）。 |

实现见 [container-execution-config.service.ts](../../backend/src/containers/container-execution-config.service.ts) 的 `getPreviewBridgeScriptUrl` 与 [container-orchestration.service.ts](../../backend/src/containers/container-orchestration.service.ts) 在 `containerEnv` 中的合并。

## 限制

- 仅对 **Content-Type: text/html** 且正文中含 `</head>` 的响应有效；无闭合 `head` 的极简页面可能无法插入。
- 经 **压缩** 的 HTML 已通过对上游 `Accept-Encoding` 置空在代理层规避；若仍遇异常，可检查上游是否强制 `Content-Encoding`。
- 仅 **同源** 链接由 bridge 改走 `postMessage`；与 [TaskPreviewPanel](../../frontend/src/features/tasks/detail/TaskPreviewPanel.vue) 的 origin 校验一致。
