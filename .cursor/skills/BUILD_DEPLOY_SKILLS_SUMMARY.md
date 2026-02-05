# 构建部署 Skills 创建总结

已成功为 ainative 项目的三个子项目创建构建部署 skills。

## 📦 新创建的 Skills

### 1. app-build-deploy - 小程序构建部署

**路径**: `.cursor/skills/app-build-deploy/SKILL.md`  
**行数**: 227 行

**功能涵盖**:
- ✅ 本地构建（development/test/stage/production）
- ✅ 体验版上传（含 CI 配置验证）
- ✅ 环境配置管理
- ✅ 常见问题处理（私钥、AppID、版本冲突等）
- ✅ 版本管理建议

**适用场景**:
- 用户提到"小程序构建"、"小程序部署"、"app 打包"
- 需要上传体验版
- 本地构建验证

---

### 2. backend-build-deploy - 后端构建部署

**路径**: `.cursor/skills/backend-build-deploy/SKILL.md`  
**行数**: 338 行

**功能涵盖**:
- ✅ 本地构建（Makefile）
- ✅ Docker 镜像构建（多阶段构建）
- ✅ GitLab CI/CD 自动部署（test/stage/production）
- ✅ Kubernetes 部署管理
- ✅ 部署回滚操作
- ✅ 状态监控（Rancher/kubectl）
- ✅ 版本管理（语义化版本）

**适用场景**:
- 用户提到"后端构建"、"后端部署"、"backend 打包"
- 需要部署到 K8s 集群
- Docker 镜像构建

---

### 3. shadow-build-deploy - 管理后台构建部署

**路径**: `.cursor/skills/shadow-build-deploy/SKILL.md`  
**行数**: 425 行

**功能涵盖**:
- ✅ 本地开发（npm run dev）
- ✅ 本地构建（test/stage/prod）
- ✅ 本地预览（Python HTTP Server）
- ✅ GitLab CI/CD 自动部署
- ✅ Docker + Nginx 部署方案
- ✅ SPA 路由处理
- ✅ 环境变量管理
- ✅ 性能优化建议

**适用场景**:
- 用户提到"管理后台构建"、"shadow 部署"、"后台打包"
- 需要部署到 K8s 集群
- 静态资源部署

---

## 🎯 Skills 设计原则遵循

### ✅ 1. 简洁性（Conciseness）
- app-build-deploy: 227 行 < 500 行 ✓
- backend-build-deploy: 338 行 < 500 行 ✓
- shadow-build-deploy: 425 行 < 500 行 ✓

### ✅ 2. 描述清晰（Clear Description）
所有 skills 描述均包含：
- **WHAT**: 明确功能（编译打包部署）
- **WHEN**: 触发场景（用户提到关键词时）
- 第三人称写法 ✓

### ✅ 3. 结构化内容
每个 skill 包含：
- 快速开始（操作概览表格）
- 分步骤操作指南
- 常见问题处理
- 项目结构说明
- 相关文档链接

### ✅ 4. 渐进式信息披露
- 主体内容：核心操作流程
- 详细说明：配置示例、命令参数
- 问题排查：独立章节，按需查看

### ✅ 5. 实用性优先
提供：
- 具体命令示例
- 配置文件格式
- 错误处理方案
- 最佳实践建议

---

## 📚 Skills 关系图

```
构建部署 Skills 体系
│
├─ 小程序相关
│  ├─ app-dev (开发规范)
│  ├─ app-build-deploy (构建部署) ← 新增
│  └─ app-preview (体验版生成)
│
├─ 后端相关
│  ├─ backend-dev (开发流程)
│  ├─ backend-build-deploy (构建部署) ← 新增
│  └─ backend-quality (代码质量)
│
└─ 管理后台相关
   ├─ shadow-dev (开发规范)
   └─ shadow-build-deploy (构建部署) ← 新增
```

---

## 🔍 与现有 Skills 的差异

### app-build-deploy vs app-preview

| 维度 | app-build-deploy | app-preview |
|------|------------------|-------------|
| **范围** | 完整构建部署流程 | 专注体验版生成 |
| **包含** | 本地构建 + 体验版 + CI/CD | 仅体验版上传 |
| **详细度** | 多环境配置说明 | 深入 CI 配置验证 |
| **适用** | 全流程部署需求 | 快速生成体验版 |

**建议使用**:
- 用户说"生成体验版" → 使用 `app-preview`
- 用户说"小程序部署" → 使用 `app-build-deploy`

---

## 🚀 使用方式

### 在 AI 对话中引用

```
@.cursor/skills/app-build-deploy/SKILL.md
@.cursor/skills/backend-build-deploy/SKILL.md
@.cursor/skills/shadow-build-deploy/SKILL.md
```

### 或使用简称

```
@app-build-deploy
@backend-build-deploy
@shadow-build-deploy
```

### 自动触发场景

AI Agent 会在以下场景自动应用：

**app-build-deploy**:
- 用户提到"小程序构建"、"小程序部署"、"app 打包"

**backend-build-deploy**:
- 用户提到"后端构建"、"后端部署"、"backend 打包"

**shadow-build-deploy**:
- 用户提到"管理后台构建"、"shadow 部署"、"后台打包"

---

## ✅ 验证清单

- [x] 所有 SKILL.md 文件已创建
- [x] 行数均 < 500 行
- [x] 描述清晰且包含触发关键词
- [x] 使用第三人称描述
- [x] 包含完整操作流程
- [x] 包含常见问题处理
- [x] 更新了 README.md
- [x] 文件结构正确（在 `.cursor/skills/` 下）

---

## 📋 下一步建议

### 可选增强（如需要）

1. **创建参考文档** (optional)
   - `app-build-deploy/references.md` - CI 配置详解
   - `backend-build-deploy/references.md` - K8s 部署详解
   - `shadow-build-deploy/references.md` - Nginx 优化配置

2. **创建辅助脚本** (optional)
   - `scripts/build-all.sh` - 一键构建所有项目
   - `scripts/deploy-check.sh` - 部署前置检查

3. **添加示例文件** (optional)
   - `examples/ci-config.yml` - CI 配置模板
   - `examples/k8s-deployment.yml` - K8s 部署配置

### 测试建议

使用以下对话测试 skills 是否正常工作：

```
1. "帮我构建 ainative-app 的测试环境版本"
   → 应自动应用 app-build-deploy skill

2. "后端怎么部署到测试环境？"
   → 应自动应用 backend-build-deploy skill

3. "管理后台怎么打包？"
   → 应自动应用 shadow-build-deploy skill
```

---

## 🎉 总结

成功创建了三个高质量的构建部署 skills，覆盖了 ainative 项目的所有子项目：

- ✅ **ainative-app** (Taro 小程序)
- ✅ **ainative-backend** (Go 后端)  
- ✅ **ainative-shadow** (Vue3 管理后台)

所有 skills 均遵循最佳实践：
- 简洁明了（< 500 行）
- 结构清晰（分步骤指导）
- 实用性强（具体命令和配置）
- 问题导向（常见问题处理）

现在 AI Agent 可以智能地指导用户完成各个项目的构建和部署任务！
