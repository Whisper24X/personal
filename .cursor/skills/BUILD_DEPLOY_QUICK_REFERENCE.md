# 构建部署 Skills 快速对照表

快速查找如何使用构建部署相关的 skills。

## 🎯 按需求查找

### 我想做什么？

| 需求 | 使用的 Skill | 关键命令 |
|------|-------------|---------|
| 本地运行小程序开发版本 | app-build-deploy | `npm run dev:weapp` |
| 构建小程序测试版本 | app-build-deploy | `npm run build:weapp:test` |
| 上传小程序体验版 | app-build-deploy | `npm run ci:weapp:upload:test` |
| 本地运行后端服务 | backend-build-deploy | `make build && ./bin/yanxue -conf ./configs` |
| 部署后端到测试环境 | backend-build-deploy | `git push origin test` |
| 回滚后端部署 | backend-build-deploy | `kubectl -n 7to12 rollout undo deployment yanxue` |
| 本地开发管理后台 | shadow-build-deploy | `npm run dev` |
| 构建管理后台生产版本 | shadow-build-deploy | `npm run build:prod` |
| 部署管理后台到测试环境 | shadow-build-deploy | `git push origin develop` |

---

## 🔧 按项目查找

### ainative-app (小程序)

| 操作 | 环境 | 命令 | Skill |
|------|------|------|-------|
| 开发 | development | `npm run dev:weapp` | app-build-deploy |
| 构建 | test | `npm run build:weapp:test` | app-build-deploy |
| 构建 | stage | `npm run build:weapp:stage` | app-build-deploy |
| 构建 | production | `npm run build:weapp:production` | app-build-deploy |
| 体验版 | test | `npm run ci:weapp:upload:test` | app-build-deploy |
| 体验版 | stage | `npm run ci:weapp:upload:stage` | app-build-deploy |
| 体验版 | production | `npm run ci:weapp:upload:production` | app-build-deploy |

**相关文件**:
- 配置：`config/index.ts`
- CI 配置：`ci.config.js`, `ci.test.config.js`
- 私钥：`key/private.wx*.key`
- 产物：`dist/`

---

### ainative-backend (后端)

| 操作 | 环境 | 命令/方式 | Skill |
|------|------|---------|-------|
| 本地构建 | - | `make build` | backend-build-deploy |
| 本地运行 | - | `./bin/yanxue -conf ./configs` | backend-build-deploy |
| CI/CD 部署 | test | `git push origin test` | backend-build-deploy |
| CI/CD 部署 | stage | `git push origin stage` | backend-build-deploy |
| CI/CD 部署 | production | `git tag v1.2.3 && git push origin v1.2.3` | backend-build-deploy |
| Docker 构建 | - | `docker build -t yanxue:latest .` | backend-build-deploy |
| 查看状态 | test/stage | `kubectl -n 7to12 get pods` | backend-build-deploy |
| 回滚部署 | test | `kubectl -n 7to12 rollout undo deployment yanxue` | backend-build-deploy |

**相关文件**:
- 构建：`Makefile`
- Docker：`Dockerfile`
- CI/CD：`.gitlab-ci.yml`
- 配置：`configs/`
- 产物：`bin/yanxue`

---

### ainative-shadow (管理后台)

| 操作 | 环境 | 命令/方式 | Skill |
|------|------|---------|-------|
| 本地开发 | development | `npm run dev` | shadow-build-deploy |
| 构建 | test | `npm run build:test` | shadow-build-deploy |
| 构建 | stage | `npm run build:stage` | shadow-build-deploy |
| 构建 | production | `npm run build:prod` | shadow-build-deploy |
| 本地预览 | - | `npm run preview` | shadow-build-deploy |
| CI/CD 部署 | test | `git push origin develop` | shadow-build-deploy |
| CI/CD 部署 | stage | `git push origin xxx_stage` | shadow-build-deploy |
| CI/CD 部署 | production | `git tag v1.2.3 && git push origin v1.2.3` | shadow-build-deploy |
| Docker 构建 | - | `docker build -t trip-shadow:latest .` | shadow-build-deploy |

**相关文件**:
- 构建：`rsbuild.config.ts`
- Docker：`Dockerfile`, `nginx.conf`
- CI/CD：`.gitlab-ci.yml`
- 环境配置：`.env.*`
- 产物：`dist/`

---

## 🌍 按环境查找

### 测试环境 (test)

| 项目 | 触发方式 | Skill |
|------|---------|-------|
| ainative-app | `npm run ci:weapp:upload:test` | app-build-deploy |
| ainative-backend | `git push origin test` | backend-build-deploy |
| ainative-shadow | `git push origin develop` | shadow-build-deploy |

**K8s 集群**: 测试集群  
**命名空间**: 
- ainative-backend: `7to12`
- ainative-shadow: `backsys`

---

### 预发环境 (stage)

| 项目 | 触发方式 | Skill |
|------|---------|-------|
| ainative-app | `npm run ci:weapp:upload:stage` | app-build-deploy |
| ainative-backend | `git push origin stage` | backend-build-deploy |
| ainative-shadow | `git push origin xxx_stage` | shadow-build-deploy |

**K8s 集群**: 火山云集群  
**命名空间**: 
- ainative-backend: `7to12`
- ainative-shadow: `backsys`

---

### 生产环境 (production)

| 项目 | 触发方式 | Skill |
|------|---------|-------|
| ainative-app | `npm run ci:weapp:upload:production` + 微信平台审核 | app-build-deploy |
| ainative-backend | `git tag v1.2.3 && git push origin v1.2.3` + 手动部署 | backend-build-deploy |
| ainative-shadow | `git tag v1.2.3 && git push origin v1.2.3` + 手动部署 | shadow-build-deploy |

**注意**: 生产环境通常需要：
1. 创建版本标签
2. 构建镜像
3. 手动部署（或审核流程）

---

## 🛠️ 按工具查找

### Make 命令 (ainative-backend)

| 命令 | 说明 | Skill |
|------|------|-------|
| `make build` | 编译后端二进制 | backend-build-deploy |
| `make api` | 生成 Proto 代码 | backend-build-deploy |
| `make wire` | 生成依赖注入 | backend-build-deploy |
| `make lint` | 代码检查 | backend-build-deploy |
| `make gorm TABLES=xxx` | 生成 GORM 代码 | backend-build-deploy |

---

### npm 命令 (ainative-app / ainative-shadow)

#### ainative-app

| 命令 | 说明 | Skill |
|------|------|-------|
| `npm run dev:weapp` | 开发模式 | app-build-deploy |
| `npm run build:weapp:test` | 构建测试版本 | app-build-deploy |
| `npm run ci:weapp:upload:test` | 上传测试体验版 | app-build-deploy |

#### ainative-shadow

| 命令 | 说明 | Skill |
|------|------|-------|
| `npm run dev` | 开发模式 | shadow-build-deploy |
| `npm run build:test` | 构建测试版本 | shadow-build-deploy |
| `npm run preview` | 本地预览 | shadow-build-deploy |

---

### kubectl 命令

| 命令 | 说明 | Skill |
|------|------|-------|
| `kubectl -n 7to12 get pods` | 查看 Pod 状态 | backend-build-deploy |
| `kubectl -n 7to12 logs -f deployment/yanxue` | 查看日志 | backend-build-deploy |
| `kubectl -n 7to12 rollout undo deployment/yanxue` | 回滚部署 | backend-build-deploy |
| `kubectl -n backsys get pods` | 查看管理后台 Pod | shadow-build-deploy |

---

### Docker 命令

| 命令 | 说明 | Skill |
|------|------|-------|
| `docker build -t yanxue:latest .` | 构建后端镜像 | backend-build-deploy |
| `docker build -t trip-shadow:latest .` | 构建管理后台镜像 | shadow-build-deploy |
| `docker push docker.yc345.tv/...` | 推送镜像到 Harbor | backend/shadow-build-deploy |

---

## 🐛 按问题查找

### 小程序问题

| 问题 | 解决方案 | Skill |
|------|---------|-------|
| 私钥文件不存在 | 检查 `key/private.wx*.key` 文件 | app-build-deploy |
| AppID 不匹配 | 对比 `ci.config.js` 和 `project.config.json` | app-build-deploy |
| 构建失败 | 执行 `npm install` 和 TypeScript 检查 | app-build-deploy |
| 版本冲突 | 更新 `ci.config.js` 中的 `WEAPP_VERSION` | app-build-deploy |

---

### 后端问题

| 问题 | 解决方案 | Skill |
|------|---------|-------|
| 编译失败 | `go mod tidy` 同步依赖 | backend-build-deploy |
| Docker 构建失败 | 检查 SSH 私钥配置 | backend-build-deploy |
| K8s 部署失败 | 检查 deployment 和权限 | backend-build-deploy |
| Pod 启动失败 | 查看日志和配置文件 | backend-build-deploy |

---

### 管理后台问题

| 问题 | 解决方案 | Skill |
|------|---------|-------|
| 构建失败 | `npm install` 和 TypeScript 检查 | shadow-build-deploy |
| 路由 404 | 检查 `nginx.conf` SPA 配置 | shadow-build-deploy |
| API 跨域 | 检查 `.env.*` API 地址和后端 CORS | shadow-build-deploy |
| 静态资源 404 | 检查 `publicPath` 和 Nginx 配置 | shadow-build-deploy |

---

## 📚 相关文档快速链接

### Skills 文档

| Skill | 路径 |
|-------|------|
| app-build-deploy | `.cursor/skills/app-build-deploy/SKILL.md` |
| backend-build-deploy | `.cursor/skills/backend-build-deploy/SKILL.md` |
| shadow-build-deploy | `.cursor/skills/shadow-build-deploy/SKILL.md` |
| app-preview | `.cursor/skills/app-preview/SKILL.md` |

### 项目开发规范

| 文档 | 路径 |
|------|------|
| AI 开发指南 | `docs/dev-spec/AI-GUIDE.md` |
| AI 工作流指南 | `docs/dev-spec/AI-WORKFLOW-GUIDE.md` |
| app 开发规范 | `docs/dev-spec/ainative-app/README.md` |
| backend 开发规范 | `docs/dev-spec/ainative-backend/README.md` |
| shadow 开发规范 | `docs/dev-spec/ainative-shadow/README.md` |

---

## 💡 使用提示

### 如何让 AI 自动应用 skill？

在提问时包含关键词：

- **小程序**: "小程序构建"、"小程序部署"、"app 打包"
- **后端**: "后端构建"、"后端部署"、"backend 打包"
- **管理后台**: "管理后台构建"、"shadow 部署"、"后台打包"

### 如何手动引用 skill？

```
@app-build-deploy 帮我构建小程序
@backend-build-deploy 后端怎么部署
@shadow-build-deploy 管理后台打包
```

---

## 🎯 常用操作速查

### 快速构建所有项目

```bash
# 小程序（测试环境）
cd ainative-app && npm run build:weapp:test

# 后端
cd ainative-backend && make build

# 管理后台（测试环境）
cd ainative-shadow && npm run build:test
```

### 快速部署到测试环境

```bash
# 后端
cd ainative-backend
git checkout test
git merge feature-branch
git push origin test

# 管理后台
cd ainative-shadow
git checkout develop
git merge feature-branch
git push origin develop

# 小程序
cd ainative-app
npm run ci:weapp:upload:test
```

### 快速查看部署状态

```bash
# 后端
kubectl -n 7to12 get pods
kubectl -n 7to12 logs -f deployment/yanxue

# 管理后台
kubectl -n backsys get pods
kubectl -n backsys logs -f deployment/trip-shadow
```

---

## 🔗 相关资源

- [Harbor 镜像仓库](https://docker.yc345.tv/)
- [Rancher 管理界面](https://rancher.yc345.tv/)
- [GitLab CI/CD 配置文档](https://guanghe.feishu.cn/docs/doccn7x1etOkjKfKZL9mwQjtpzf)
- [Taro 文档](https://taro-docs.jd.com/)
- [Kratos 框架文档](https://go-kratos.dev/)
- [Rsbuild 文档](https://rsbuild.dev/)
