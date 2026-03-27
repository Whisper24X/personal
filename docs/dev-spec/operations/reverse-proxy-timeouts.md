# 反向代理与长耗时 HTTP（Goal PRD / 拆解计划）

Goal 的 `POST /api/v1/goals/:id/generate-prd` 与 `POST /api/v1/goals/:id/generate-plan` 在服务端会同步等待 Agent CLI 完成（常见数十秒至数分钟）。若 Nginx、Ingress、ALB、Cloudflare 等前置层的 **读超时** 短于实际耗时，浏览器会收到 502/504，而服务端日志可能仍显示 `agent_runner_completed`。

部署时请将面向上述路径（或全局 API）的 **proxy_read_timeout**（Nginx）、**upstream timeout**（Envoy 等）调到不低于峰值生成耗时（建议 **120s 及以上**，按环境压测调整）。

前端 `fetch` 未设短超时；问题多出现在网关而非浏览器。
