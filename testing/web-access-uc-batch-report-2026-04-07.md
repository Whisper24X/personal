# 无 PRD 核心用例 — web-access 批量执行报告

- **生成时间**: 2026-04-08T02:41:23.509710+00:00
- **源数据**: `无-PRD-核心用例与测试策略-xmind.json` → `openclaw-batch-20260407/manifest.json`
- **执行方式**: 脚本 `testing/scripts/run_web_access_uc_report.py` 对每条 UC 发起 HTTP 层冒烟；与 **web-access** skill 对齐的浏览器/CDP 深度步骤见各 `results/*.md` 说明。

## 汇总

| UC | 标题 | 自动化判定 | 备注摘要 |
|----|------|------------|----------|
| UC-01 | [P0] UC-01 用户注册 | pass | 登录页可加载（HTTP 200）；注册/登录/错误凭据需 CDP 填表验证；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-02 | [P0] UC-02 用户登录 | pass | 登录页可加载（HTTP 200）；注册/登录/错误凭据需 CDP 填表验证；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-03 | [P0] UC-03 登录失败（错误凭据） | pass | 登录页可加载（HTTP 200）；注册/登录/错误凭据需 CDP 填表验证；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-04 | [P0] UC-04 刷新会话 | pass | 登录页可加载（HTTP 200）；注册/登录/错误凭据需 CDP 填表验证；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-05 | [P0] UC-05 获取当前用户 | pass | 登录页可加载（HTTP 200）；注册/登录/错误凭据需 CDP 填表验证；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-06 | [P0] UC-06 未登录访问控制 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-07 | [P0] UC-07 主导航冒烟（已登录） | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-08 | [P0] UC-08 后端健康检查 | pass | 响应体疑似 JSON（HomeController 风格） |
| UC-10 | [P1] UC-10 业务线管理 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-11 | [P1] UC-11 项目与工作流 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-12 | [P1] UC-12 任务列表与任务详情 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-13 | [P1] UC-13 目标（需求）链路 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-14 | [P1] UC-14 修改个人资料或密码 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-15 | [P1] UC-15 登出 | pass | 登录页可加载（HTTP 200）；注册/登录/错误凭据需 CDP 填表验证；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-16 | [P1] UC-16 接受业务线邀请 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-17 | [P1] UC-17 业务线管理页：成员与权限 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-18 | [P1] UC-18 新建项目 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-19 | [P1] UC-19 新建任务 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-20 | [P1] UC-20 首页与工作台 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-21 | [P1] UC-21 看板 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-22 | [P1] UC-22 知识库 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-23 | [P1] UC-23 技能 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-24 | [P1] UC-24 MCP | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-26 | [P1] UC-26 Git 集成页 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |
| UC-27 | [P1] UC-27 通用设置页 | pass | HTTP 200，页面片段长度 543（未做业务断言；可能为 SPA 壳）；完整交互（注册/登录/错误提示/刷新 token）需 CDP 或 Bruno。 |

## 逐条结果文件

目录：`testing/openclaw-batch-20260407/results/`

## 说明

- **pass**：仅表示 HTTP 层或后端根路径在当前环境下符合最小预期，**不替代**完整用例验收。
- **inconclusive / error**：需检查本地 8000/9000 是否启动，或用 CDP 复核。
- 登录、注册、错误凭据、刷新 token、已登录导航等需 **web-access（CDP）** 或手工按 `cases/UC-xx.md` 执行。