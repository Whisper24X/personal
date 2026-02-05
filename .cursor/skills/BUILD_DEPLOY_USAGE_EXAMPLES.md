# 构建部署 Skills 使用示例

本文档展示如何使用新创建的构建部署 skills。

## 📖 目录

1. [小程序构建部署示例](#1-小程序构建部署示例)
2. [后端构建部署示例](#2-后端构建部署示例)
3. [管理后台构建部署示例](#3-管理后台构建部署示例)
4. [组合使用示例](#4-组合使用示例)

---

## 1. 小程序构建部署示例

### 场景 1.1: 本地构建验证

**用户提问**:
```
帮我构建一下小程序的测试环境版本，我想在本地验证一下
```

**AI Agent 响应流程**:
1. 自动应用 `app-build-deploy` skill
2. 识别需求：本地构建 + 测试环境
3. 执行命令：
   ```bash
   cd ainative-app
   npm run build:weapp:test
   ```
4. 提示用户使用微信开发者工具打开 `dist/` 目录

---

### 场景 1.2: 生成测试环境体验版

**用户提问**:
```
小程序开发完了，帮我上传一个测试环境的体验版
```

**AI Agent 响应流程**:
1. 自动应用 `app-build-deploy` skill
2. 验证前置条件：
   - 检查 `ci.test.config.js` 是否存在
   - 检查私钥文件 `key/private.wx*.key` 是否存在
3. 如果配置正常，执行：
   ```bash
   cd ainative-app
   npm run ci:weapp:upload:test
   ```
4. 监控输出，等待体验版生成完成
5. 反馈结果给用户

---

### 场景 1.3: 处理配置缺失问题

**用户提问**:
```
小程序上传失败了，提示私钥文件不存在
```

**AI Agent 响应流程**:
1. 自动应用 `app-build-deploy` skill
2. 识别问题类型：私钥文件不存在
3. 提供解决方案：
   ```
   ❌ 私钥文件不存在
   
   解决步骤：
   1. 检查 ainative-app/key/ 目录
   2. 确认私钥文件名与 ci.config.js 中的 WEAPP_PRIVATE_KEY_PATH 一致
   3. 如需获取私钥，在微信公众平台下载并放置到 key/ 目录
   ```
4. 等待用户解决后，重新执行上传命令

---

## 2. 后端构建部署示例

### 场景 2.1: 本地构建后端

**用户提问**:
```
我想本地运行后端服务，怎么构建？
```

**AI Agent 响应流程**:
1. 自动应用 `backend-build-deploy` skill
2. 执行构建命令：
   ```bash
   cd ainative-backend
   make build
   ```
3. 提示如何运行：
   ```bash
   ./bin/yanxue -conf ./configs
   ```

---

### 场景 2.2: 部署到测试环境

**用户提问**:
```
后端代码写完了，帮我部署到测试环境
```

**AI Agent 响应流程**:
1. 自动应用 `backend-build-deploy` skill
2. 识别目标环境：测试环境
3. 提供部署步骤：
   ```bash
   # 切换到 test 分支
   git checkout test
   
   # 合并代码
   git merge feature-branch
   
   # 推送触发 CI/CD
   git push origin test
   ```
4. 说明自动化流程：
   - GitLab CI 会自动构建 Docker 镜像
   - 自动推送到 Harbor
   - 自动更新 K8s deployment
5. 提供监控方式：
   ```bash
   kubectl -n 7to12 get pods
   kubectl -n 7to12 logs -f deployment/yanxue
   ```

---

### 场景 2.3: 构建 Docker 镜像

**用户提问**:
```
我想手动构建一个后端的 Docker 镜像
```

**AI Agent 响应流程**:
1. 自动应用 `backend-build-deploy` skill
2. 提供构建命令：
   ```bash
   cd ainative-backend
   
   # 构建镜像
   docker build -t yanxue:latest .
   
   # 如果需要访问私有仓库
   docker build \
     --build-arg SSH_PRIVATE_KEY="$(cat ~/.ssh/id_rsa)" \
     -t yanxue:latest .
   ```
3. 说明镜像标签规范
4. 提供推送到 Harbor 的命令（如需要）

---

### 场景 2.4: 部署回滚

**用户提问**:
```
测试环境刚部署的版本有问题，帮我回滚到上一个版本
```

**AI Agent 响应流程**:
1. 自动应用 `backend-build-deploy` skill
2. 识别环境：测试环境
3. 提供回滚命令：
   ```bash
   kubectl config use-context testenv
   kubectl -n 7to12 rollout undo deployment yanxue
   ```
4. 验证回滚状态：
   ```bash
   kubectl -n 7to12 rollout status deployment yanxue
   ```

---

## 3. 管理后台构建部署示例

### 场景 3.1: 本地开发

**用户提问**:
```
我想启动管理后台的开发服务器
```

**AI Agent 响应流程**:
1. 自动应用 `shadow-build-deploy` skill
2. 执行开发命令：
   ```bash
   cd ainative-shadow
   npm run dev
   ```
3. 提示访问地址和特性：
   - 自动打开浏览器
   - 支持热更新
   - 实时类型检查

---

### 场景 3.2: 本地构建验证

**用户提问**:
```
帮我构建一下管理后台的生产环境版本，我想本地预览一下
```

**AI Agent 响应流程**:
1. 自动应用 `shadow-build-deploy` skill
2. 执行构建和预览：
   ```bash
   cd ainative-shadow
   npm run preview
   ```
3. 说明这个命令会：
   - 执行 `npm run build:prod` 构建
   - 使用 Python 启动本地 HTTP 服务器
4. 提示访问地址：`http://localhost:8000`

---

### 场景 3.3: 部署到测试环境

**用户提问**:
```
管理后台的新功能开发完了，部署到测试环境
```

**AI Agent 响应流程**:
1. 自动应用 `shadow-build-deploy` skill
2. 识别目标环境：测试环境
3. 提供部署步骤：
   ```bash
   # 切换到 develop 分支
   git checkout develop
   
   # 合并代码
   git merge feature-branch
   
   # 推送触发 CI/CD
   git push origin develop
   ```
4. 说明自动化流程：
   - 安装依赖
   - 执行 `npm run build:test`
   - 构建 Docker 镜像（Nginx + 静态文件）
   - 推送到 Harbor
   - 更新 K8s deployment

---

### 场景 3.4: 处理 404 问题

**用户提问**:
```
管理后台部署后，刷新页面就 404 了
```

**AI Agent 响应流程**:
1. 自动应用 `shadow-build-deploy` skill
2. 识别问题类型：SPA 路由 404
3. 提供解决方案：
   ```
   ❌ 路由 404 问题
   
   原因: Nginx 配置缺失 SPA 路由支持
   
   解决步骤：
   1. 检查 nginx.conf 配置
   2. 确保有以下配置：
      location / {
        try_files $uri $uri/ /index.html;
      }
   3. 修改后重新构建 Docker 镜像并部署
   ```

---

## 4. 组合使用示例

### 场景 4.1: 全栈部署

**用户提问**:
```
我开发了一个完整的新功能（小程序+后端+管理后台），怎么一起部署到测试环境？
```

**AI Agent 响应流程**:
1. 同时应用三个 skills：
   - `app-build-deploy`
   - `backend-build-deploy`
   - `shadow-build-deploy`
2. 提供部署顺序建议：
   ```
   建议部署顺序：
   
   1️⃣ 后端服务（优先部署，提供 API）
      cd ainative-backend
      git checkout test
      git merge feature-branch
      git push origin test
   
   2️⃣ 管理后台（Web 端）
      cd ainative-shadow
      git checkout develop
      git merge feature-branch
      git push origin develop
   
   3️⃣ 小程序（需要后端 API 稳定）
      cd ainative-app
      npm run ci:weapp:upload:test
   ```
3. 提供验证建议：
   - 等待后端 Pod 启动完成
   - 验证管理后台可访问
   - 最后上传小程序体验版

---

### 场景 4.2: 问题排查

**用户提问**:
```
部署到测试环境后，小程序打不开，显示网络错误
```

**AI Agent 响应流程**:
1. 综合应用相关 skills
2. 系统化排查问题：
   ```
   🔍 问题排查清单：
   
   1. 检查后端服务状态
      kubectl -n 7to12 get pods
      kubectl -n 7to12 logs -f deployment/yanxue
   
   2. 验证后端 API 是否正常
      curl https://test-api.example.com/health
   
   3. 检查小程序环境配置
      - 确认 .env.test 中的 API 地址正确
      - 验证 request 域名是否在白名单
   
   4. 查看小程序网络请求
      - 微信开发者工具 Console
      - 查看实际请求的 URL
   ```

---

### 场景 4.3: 生产环境发布

**用户提问**:
```
测试环境验证通过了，怎么发布到生产环境？
```

**AI Agent 响应流程**:
1. 同时应用三个 skills
2. 提供完整的生产发布流程：
   ```
   📋 生产环境发布流程：
   
   第一步：后端服务发布
   ----------------------
   1. 创建版本标签
      cd ainative-backend
      git tag v1.2.3
      git push origin v1.2.3
   
   2. GitLab CI 自动构建镜像
      docker.yc345.tv/7to12/yanxue:v1.2.3
   
   3. 手动部署到生产 K8s（需要运维权限）
   
   第二步：管理后台发布
   ----------------------
   1. 创建版本标签
      cd ainative-shadow
      git tag v1.2.3
      git push origin v1.2.3
   
   2. GitLab CI 自动构建镜像
   
   3. 手动部署到生产 K8s
   
   第三步：小程序发布
   ----------------------
   1. 更新版本号
      修改 ci.config.js:
        WEAPP_VERSION: "1.2.3"
        WEAPP_DESC: "xxx 功能上线"
   
   2. 上传体验版
      npm run ci:weapp:upload:production
   
   3. 在微信公众平台提交审核
   
   4. 审核通过后发布
   ```
3. 提供回滚预案
4. 提供监控建议

---

## 📝 使用技巧

### 技巧 1: 明确环境

在提问时明确指定环境，AI 会更准确地响应：

```
✅ 好的提问:
- "部署到测试环境"
- "构建生产版本"
- "上传预发环境体验版"

❌ 模糊的提问:
- "帮我部署"
- "构建一下"
```

### 技巧 2: 说明项目

明确指定要操作的项目：

```
✅ 好的提问:
- "小程序构建"
- "后端部署"
- "管理后台打包"

❌ 模糊的提问:
- "帮我构建"
- "怎么部署"
```

### 技巧 3: 遇到问题时提供错误信息

```
✅ 好的提问:
- "小程序上传失败，提示：privateKeyPath 文件不存在"
- "后端部署后 Pod 状态是 CrashLoopBackOff"

❌ 模糊的提问:
- "小程序上传失败了"
- "后端部署失败"
```

---

## 🎯 最佳实践

### 1. 开发环境隔离
- 本地开发使用 `development` 环境
- 测试验证使用 `test` 环境
- 预发验证使用 `stage` 环境
- 生产发布使用 `production` 环境

### 2. 部署顺序
1. 后端服务（API 提供者）
2. 管理后台（依赖后端 API）
3. 小程序（依赖后端 API）

### 3. 版本管理
- 遵循语义化版本：`v{major}.{minor}.{patch}`
- 保持前后端版本同步
- 生产发布必须打 tag

### 4. 安全检查
- 确认环境变量配置正确
- 验证 API 地址
- 检查依赖服务状态
- 测试环境充分验证

---

## 🚀 快速参考

### 小程序
```bash
# 本地构建
npm run build:weapp:test

# 上传体验版
npm run ci:weapp:upload:test
```

### 后端
```bash
# 本地构建
make build

# 部署测试环境
git push origin test

# 查看状态
kubectl -n 7to12 get pods
```

### 管理后台
```bash
# 本地开发
npm run dev

# 本地预览
npm run preview

# 部署测试环境
git push origin develop
```

---

## 📞 需要帮助？

如果 AI Agent 没有正确应用 skill，可以：

1. **手动引用 skill**:
   ```
   @app-build-deploy 帮我构建小程序
   @backend-build-deploy 后端怎么部署
   @shadow-build-deploy 管理后台打包
   ```

2. **查看 skill 文档**:
   - `.cursor/skills/app-build-deploy/SKILL.md`
   - `.cursor/skills/backend-build-deploy/SKILL.md`
   - `.cursor/skills/shadow-build-deploy/SKILL.md`

3. **查看相关文档**:
   - `docs/dev-spec/AI-GUIDE.md` - AI 开发指南
   - `docs/dev-spec/AI-WORKFLOW-GUIDE.md` - AI 工作流指南
