---
name: shadow-build-deploy
description: ainative-shadow 管理后台编译打包部署。支持本地构建、Docker 镜像构建、Kubernetes 部署（test/stage/production）。当用户提到"管理后台构建"、"shadow 部署"、"后台打包"或需要部署管理系统时使用。
---

# ainative-shadow 管理后台构建部署

ainative-shadow 是基于 Vue3 + Element Plus + Rsbuild 的管理后台系统。

## 快速开始

根据用户需求选择对应操作：

| 操作 | 使用场景 |
|------|---------|
| 本地开发 | 开发调试、实时预览 |
| 本地构建 | 验证构建产物 |
| 本地预览 | 验证生产环境效果 |
| CI/CD 部署 | 自动化部署到集群 |

## 操作 1: 本地开发

启动开发服务器，支持热更新。

### 开发命令

```bash
cd ainative-shadow

# 启动开发服务器（development 环境）
npm run dev
```

### 开发服务器特性

- 自动打开浏览器：`--open`
- 热模块替换（HMR）
- 实时 TypeScript 类型检查
- 开发环境 API 代理

### 访问地址

```
http://localhost:{PORT}
```

端口由 Rsbuild 配置决定。

## 操作 2: 本地构建

生成生产环境静态文件，用于验证构建。

### 构建命令

```bash
cd ainative-shadow

# 测试环境构建
npm run build:test

# 预发环境构建
npm run build:stage

# 生产环境构建
npm run build:prod
```

### 构建产物

构建完成后，静态文件输出到 `ainative-shadow/dist/` 目录。

### 产物结构

```
dist/
├── index.html              # 入口 HTML
├── static/                 # 静态资源
│   ├── js/                # JavaScript 文件
│   ├── css/               # CSS 文件
│   └── assets/            # 图片等资源
└── ...
```

### 环境配置文件

| 环境 | 配置文件 | API 地址 |
|------|---------|---------|
| development | `.env.development` | 开发环境 API |
| test | `.env.test` | 测试环境 API |
| stage | `.env.stage` | 预发环境 API |
| production | `.env.production` | 生产环境 API |

## 操作 3: 本地预览

构建后本地预览生产环境效果。

### 预览命令

```bash
cd ainative-shadow

# 构建并启动预览服务器
npm run preview

# 或者先构建再预览
npm run build:prod
npm run serve
```

### 预览服务器

使用 Python HTTP 服务器：

```bash
python3 scripts/serve.py
```

访问：`http://localhost:8000`

## 操作 4: GitLab CI/CD 自动部署

项目已配置完整的 CI/CD 流程，推送代码即可自动部署。

### 部署流程

#### 测试环境（develop 分支）

```yaml
触发条件: 推送到 develop 分支
流程:
  1. 安装依赖 - npm install
  2. 构建 - npm run build:test
  3. Docker 镜像构建
  4. 推送镜像到 Harbor
  5. 更新 K8s deployment
  6. 状态检查
```

部署命令：

```bash
# 切换到 develop 分支
git checkout develop

# 合并代码并推送
git merge feature-branch
git push origin develop
```

#### 预发环境（*_stage* 分支）

```yaml
触发条件: 推送到 xxx_stage 或 xxx_stage1 等分支
流程:
  1. 安装依赖
  2. 构建 - npm run build:stage
  3. Docker 镜像构建
  4. 推送镜像
  5. 部署到火山云集群
```

部署命令：

```bash
# 创建预发分支
git checkout -b feature_stage1 develop

# 推送触发部署
git push origin feature_stage1
```

#### 生产环境（版本标签）

```yaml
触发条件: 推送版本标签（v1.2.3）
流程:
  1. 安装依赖
  2. 构建 - npm run build:prod
  3. Docker 镜像构建
  4. 推送镜像
注意: 不自动部署，需手动更新 K8s
```

部署命令：

```bash
# 创建版本标签
git tag v1.2.3
git push origin v1.2.3

# 手动部署到生产环境
kubectl -n backsys set image deployment trip-shadow \
  trip-shadow=docker.yc345.tv/backsys/trip-shadow:v1.2.3
```

### CI/CD 配置说明

#### 环境变量

| 变量 | 说明 |
|------|------|
| `DOCKER_REGISTRY` | `docker.yc345.tv` |
| `NAMESPACE` | `backsys` |
| `DOCKER_USERNAME` | Docker 登录用户 |
| `DOCKER_PASSWORD` | Docker 登录密码 |
| `KUBE_TOKEN_TEST` | 测试环境 K8s 令牌 |
| `KUBE_TOKEN_STAGE_VOLCENGINE` | 预发环境 K8s 令牌 |

#### 构建缓存

CI 使用 `node_modules/` 缓存加速构建：

```yaml
cache:
  paths:
    - node_modules/
```

## 操作 5: Docker 镜像构建

### Dockerfile 说明

使用 Nginx 部署静态文件：

```dockerfile
FROM docker.yc345.tv/mirror/nginx:latest
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY ./dist /usr/share/nginx/html/trip-shadow
EXPOSE 80
```

### 手动构建镜像

```bash
cd ainative-shadow

# 先构建前端代码
npm run build:prod

# 构建 Docker 镜像
docker build -t trip-shadow:latest .
```

### 镜像标签规范

- 测试环境：`docker.yc345.tv/backsys/trip-shadow:{SHORT_SHA}`
- 预发环境：`docker.yc345.tv/backsys/trip-shadow:{SHORT_SHA}`
- 生产环境：`docker.yc345.tv/backsys/trip-shadow:{VERSION_TAG}`

### Nginx 配置

项目包含 `nginx.conf` 用于：

- SPA 路由支持（history mode）
- Gzip 压缩
- 缓存策略
- API 代理（如需要）

## 查看部署状态

### 方式 1: Rancher UI

访问 https://rancher.yc345.tv/

1. 选择对应集群（测试/预发）
2. 进入 `backsys` 命名空间
3. 查看 `trip-shadow` deployment

### 方式 2: kubectl 命令

```bash
# 查看 Pod 状态
kubectl -n backsys get pods

# 查看 deployment
kubectl -n backsys get deployment trip-shadow

# 查看部署历史
kubectl -n backsys rollout history deployment trip-shadow

# 查看实时日志
kubectl -n backsys logs -f deployment/trip-shadow
```

## 部署回滚

### 测试环境回滚

```bash
kubectl config use-context testenv
kubectl -n backsys rollout undo deployment trip-shadow
```

### 预发环境回滚

```bash
kubectl config use-context stagenv
kubectl -n backsys rollout undo deployment trip-shadow
```

## 常见问题处理

### 问题 1: 构建失败

```
错误: Build failed
```

**解决**：
1. 检查代码是否有 TypeScript 错误
2. 执行 `npm install` 确保依赖完整
3. 清理缓存：`rm -rf node_modules dist`

### 问题 2: 依赖安装失败

```
错误: npm ERR! code ECONNREFUSED
```

**解决**：
1. 检查 npm 镜像源：`.npmrc` 配置
2. 使用淘宝镜像：`--registry=https://registry.npm.taobao.org`
3. 清理 npm 缓存：`npm cache clean --force`

### 问题 3: 路由 404

部署后页面刷新 404

**解决**：
1. 检查 `nginx.conf` 配置
2. 确保有 `try_files $uri $uri/ /index.html;`
3. 验证 Vue Router 使用 history 模式

### 问题 4: API 请求跨域

```
错误: CORS policy blocked
```

**解决**：
1. 检查 `.env.*` 中的 API 地址配置
2. 确认后端 CORS 配置
3. 使用 Nginx 反向代理

### 问题 5: 静态资源 404

```
错误: GET /static/js/xxx.js 404
```

**解决**：
1. 检查 `rsbuild.config.ts` 中的 `publicPath`
2. 确认 Nginx 配置中的静态资源路径
3. 验证 Dockerfile 中的 COPY 路径

## 性能优化

### 构建优化

- 启用代码分割（已配置）
- 压缩图片资源
- 使用 CDN 加速（Element Plus）
- 按需导入组件

### 运行时优化

- Nginx Gzip 压缩
- 静态资源缓存
- HTTP/2 支持
- 懒加载路由

## 环境变量示例

### .env.test

```env
NODE_ENV=test
VITE_API_BASE_URL=https://test-api.example.com
```

### .env.production

```env
NODE_ENV=production
VITE_API_BASE_URL=https://api.example.com
```

## 项目结构

```
ainative-shadow/
├── src/                    # 源码目录
│   ├── views/             # 页面组件
│   ├── components/        # 公共组件
│   ├── api/               # API 封装
│   ├── store/             # Pinia 状态管理
│   └── router/            # 路由配置
├── public/                 # 静态资源
├── dist/                   # 构建产物
├── scripts/                # 辅助脚本
│   └── serve.py           # 本地预览服务器
├── .env.*                  # 环境配置
├── nginx.conf              # Nginx 配置
├── Dockerfile              # Docker 构建文件
├── rsbuild.config.ts       # Rsbuild 配置
├── package.json            # 依赖和脚本
└── .gitlab-ci.yml         # CI/CD 配置
```

## 相关文档

- [Rsbuild 文档](https://rsbuild.dev/)
- [Vue 3 文档](https://cn.vuejs.org/)
- [Element Plus 文档](https://element-plus.org/)
- shadow-dev skill: 管理后台开发规范
- [GitLab CI 配置](https://docs.gitlab.com/ee/ci/)

## 注意事项

1. **环境变量**：确认 `.env.*` 文件配置正确
2. **API 地址**：不同环境使用不同的 API 端点
3. **版本标签**：生产环境使用语义化版本号
4. **构建缓存**：CI 使用缓存加速，本地可删除 `node_modules` 重新安装
5. **Nginx 配置**：修改 `nginx.conf` 需要重新构建镜像
6. **静态资源**：大文件建议使用 OSS 存储
