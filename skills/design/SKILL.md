---
name: design
description: 将 PRD 转换为系统设计文档（DESIGN.md），完善技术实现细节。当用户提供 PRD 并要求生成系统设计、技术方案、或提到 Design/DESIGN 时使用此 skill。
---

# PRD 转系统设计

将 PRD（产品需求文档）转换为完整的系统设计文档（DESIGN.md），完善技术实现细节。

## 角色定位

- **角色**：架构师（Architect）
- **职责**：将产品需求转化为可执行的技术方案
- **输出**：系统设计文档（DESIGN.md），用于指导后续开发任务规划

## 执行流程

### Step 1: 读取输入文档

1. **读取 PRD 文档**：
   - 路径：`docs/prd/PRD.md`
   - 提取功能需求、用户场景、业务规则

2. **读取开发规范**（必须参考）：
   - `docs/dev-spec/ainative-app/` - 移动端开发规范
   - `docs/dev-spec/ainative-shadow/` - 管理后台开发规范
   - `docs/dev-spec/ainative-backend/` - 后端开发规范

3. **读取模板**：
   - [design-template.md](references/design-template.md)（8 个章节）

### Step 2: 检测菜单变更需求

**目标**：如果涉及 `ainative-shadow` 管理后台，检测菜单变更需求并在 Design 中规划。

#### 2.1 检测逻辑

检查 PRD 文档中是否包含以下内容：

- `ainative-shadow`、`shadow-dev`、`shadow` 相关关键词
- 管理后台页面/功能相关描述
- 前端路由/菜单相关需求
- 权限管理相关需求

#### 2.2 菜单规划要求

如果检测到涉及 `ainative-shadow` 菜单变更，必须在 Design 文档中：

1. **第 4 章 "前端技术方案设计"** 中添加：
   - **4.5 路由与菜单配置**（新增子章节）
     - 列出所有新增菜单的路由配置
     - 说明菜单的路径、名称、标题、图标
     - 说明菜单的权限要求（permissions）
     - 说明菜单的层级关系（如果有嵌套菜单）
     - 明确标识：**需要执行菜单数据库注入任务**

2. **第 6 章 "数据模型设计"** 中添加：
   - 如果涉及菜单权限表，添加 `menus` 表设计说明
   - 参考：`skills/backend-codeing/references/menu-permission-injection.md`

#### 2.3 菜单配置格式示例

在 Design 文档第 4.5 章节中，使用以下格式：

````markdown
### 4.5 路由与菜单配置

#### 新增菜单列表

| 路径         | 名称       | 标题     | 图标 | 权限      | 父菜单  | 说明                 |
| ------------ | ---------- | -------- | ---- | --------- | ------- | -------------------- |
| /user        | User       | 用户管理 | user | user:view | -       | 用户列表页面         |
| /system/user | SystemUser | 用户管理 | user | user:view | /system | 系统管理下的用户管理 |

#### 路由配置示例

```typescript
// src/router/routes/staticRoutes.ts
export const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/user',
    name: 'User',
    component: () => import('@/views/user/index.vue'),
    meta: {
      title: '用户管理',
      icon: 'user',
      permissions: ['user:view'],
      requiresAuth: true,
    },
  },
];
```
````

#### 菜单数据库注入任务

**重要**：新增菜单需要同步到数据库，执行菜单权限数据库注入任务。

- 任务位置：将在 openspec 任务规划阶段自动添加
- 执行时机：前端路由配置完成后
- 参考文档：`skills/backend-codeing/references/menu-permission-injection.md`

````

### Step 3: 生成 DESIGN.md

严格按照模板 8 个章节填充内容：

1. **系统概述** - 背景、目标、架构原则
2. **系统总体架构设计** - 架构图、组件说明
3. **技术选型总览** - 前后端技术栈（必须与开发规范一致）
4. **前端技术方案设计** - 架构模式、目录结构、文件清单、**路由与菜单配置**（如涉及）
5. **后端技术方案设计** - Kratos 架构、目录结构、文件清单、API 设计
6. **数据模型设计** - ER 图、数据表设计、**菜单权限表**（如涉及）
7. **安全性设计** - 认证授权、数据安全、接口安全
8. **部署与 DevOps** - 环境划分、CI/CD、监控告警

### Step 4: 完善技术实现细节

确保 Design 文档包含以下可执行的技术细节：

#### 4.1 前端实现细节

- **文件清单**：列出所有需要创建的页面组件、业务组件、API 调用、类型定义
- **目录结构**：严格按照开发规范的组织方式
- **路由配置**：如果涉及菜单，明确路由配置
- **状态管理**：Pinia store 设计
- **API 调用**：API 接口定义和调用方式

#### 4.2 后端实现细节

- **API 定义**：Protobuf 接口定义（路径、参数、响应）
- **文件清单**：列出所有需要创建的 Service、Biz、Data 层文件
- **数据模型**：数据库表结构、字段定义、索引设计
- **业务逻辑**：核心业务流程设计

#### 4.3 数据模型细节

- **ER 图**：使用 Mermaid 绘制实体关系图
- **表设计**：表名、字段、类型、约束、索引
- **菜单权限表**：如果涉及菜单，设计 menus 表结构

## 技术栈速查

| 端       | 技术栈                                  | 规范路径                          |
| -------- | --------------------------------------- | --------------------------------- |
| 移动端   | Taro 3.6.23 + Vue3 + Webpack5           | `docs/dev-spec/ainative-app/`     |
| 管理后台 | Vue3 + Element Plus + TailwindCSS       | `docs/dev-spec/ainative-shadow/`  |
| 后端     | Go + Kratos + GORM + PostgreSQL + Redis | `docs/dev-spec/ainative-backend/` |

## 输出要求

### 文件规范

- **文件名**：`DESIGN.md`（必须使用此文件名）
- **文件位置**：`docs/design/DESIGN.md`
- **章节数量**：严格 8 个章节（禁止增删）
- **字数要求**：≥ 4000 字
- **图表要求**：≥ 3 个 Mermaid 图表（架构图/ER图/流程图）
- 目录结构：与开发规范一致

### 内容要求

- ✅ 技术选型必须与 `docs/dev-spec/` 开发规范一致
- ✅ 目录结构必须参考开发规范
- ✅ 文件清单必须完整列出所有需要创建的文件
- ✅ API 设计必须明确路径、参数、响应格式
- ✅ 数据模型设计必须包含 ER 图和表结构
- ✅ 如果涉及菜单，必须明确规划菜单配置和数据库注入任务
- ❌ 禁止添加模板外的章节
- ❌ 禁止使用规范外的技术栈
- ❌ 禁止占位符或空泛描述
- ❌ 禁止技术实现细节缺失

## 菜单规划检查清单

如果涉及 `ainative-shadow` 菜单变更，确保：

- [ ] 在第 4 章添加了 "4.5 路由与菜单配置" 子章节
- [ ] 列出了所有新增菜单的路由配置
- [ ] 说明了菜单的权限要求
- [ ] 明确了需要执行菜单数据库注入任务
- [ ] 在第 6 章添加了菜单权限表设计（如需要）
- [ ] 参考了 `menu-permission-injection.md` 文档

## 与后续流程的衔接

### 1. 用于 OpenSpec 任务规划

Design 文档将作为 `project-management` skill 的输入：

- **project-management** 读取 Design 文档
- 检测菜单变更规划（第 4.5 章节）
- 自动在 `tasks.md` 中添加菜单注入任务

### 2. 用于代码生成

Design 文档将作为代码生成的输入：

- **code-task-apply** 读取 Design 文档
- 根据文件清单生成代码
- 根据 API 设计生成接口
- 根据数据模型生成数据库迁移

## 常见问题处理

| 情况 | 处理方式 |
|------|----------|
| PRD 中功能描述不清晰 | 基于工程经验做出合理假设，在 Design 中明确技术方案 |
| 技术选型不确定 | 参考开发规范，选择规范中定义的技术栈 |
| 菜单信息不完整 | 在 Design 中说明需要在执行阶段从路由文件提取 |
| 数据模型不明确 | 根据业务需求设计合理的表结构，标注需要评审 |

## 禁止事项

以下行为是禁止的，违反将导致输出无效：

1. ❌ 使用非 `DESIGN.md` 的文件名
2. ❌ 添加模板外的章节（必须严格 8 章节）
3. ❌ 使用开发规范外的技术栈
4. ❌ 输出占位符或空泛描述
5. ❌ 缺少文件清单或 API 设计
6. ❌ 涉及菜单变更但未规划菜单配置

## 参考文档

- [设计模板](references/design-template.md) - 完整的 8 章节模板
- [菜单权限注入指南](../backend-codeing/references/menu-permission-injection.md) - 菜单数据库注入详细说明
- [菜单检测示例](../backend-codeing/references/menu-detector-example.ts) - 菜单检测代码示例
- [开发规范](../../../docs/dev-spec/) - 前后端开发规范

## 输出示例

完成后的 Design 文档应包含：

```markdown
# 系统设计文档

## 1. 系统概述
...

## 4. 前端技术方案设计
...
### 4.5 路由与菜单配置
[如果涉及菜单，这里列出菜单配置]
...

## 6. 数据模型设计
...
### 6.3 菜单权限表设计
[如果涉及菜单，这里设计 menus 表]
...
````

---

> **重要提示**：Design 文档是后续 openspec 任务规划的基础，必须确保技术实现细节完整、可执行。
