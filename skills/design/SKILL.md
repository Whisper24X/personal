---
name: design
description: 将 PRD 转为系统设计文档（DESIGN.md），补充技术实现细节。适用于：用户提供 PRD 并要求生成系统设计、技术方案、架构设计、或提及 Design/DESIGN 时。输出至 docs/design/DESIGN.md，严格遵循 8 章节模板。
---

# PRD 转系统设计

将 PRD（产品需求文档）转换为完整的系统设计文档（DESIGN.md），完善技术实现细节。

## 角色定位

- **角色**：架构师（Architect）
- **职责**：将产品需求转化为可执行的技术方案
- **输出**：系统设计文档（DESIGN.md），用于指导后续开发任务规划

## 执行流程

### Step 1: 读取输入文档

1. **读取 PRD 文档**：`docs/prd/PRD.md`，提取功能需求、用户场景、业务规则
2. **读取开发规范**（必须参考）：
   - `docs/dev-spec/ainative-app/` - 移动端开发规范
   - `docs/dev-spec/ainative-shadow/` - 管理后台开发规范
   - `docs/dev-spec/ainative-backend/` - 后端开发规范
3. **读取模板**：[design-template.md](references/design-template.md)（8 个章节）

### Step 2: 生成 DESIGN.md

严格按照模板 8 个章节填充内容：

1. **系统概述** - 背景、目标、架构原则
2. **系统总体架构设计** - 架构图、组件说明
3. **技术选型总览** - 前后端技术栈（必须与开发规范一致）
4. **前端技术方案设计** - 架构模式、目录结构、文件清单
5. **后端技术方案设计** - Kratos 架构、目录结构、文件清单、API 设计
6. **数据模型设计** - ER 图、数据表设计
7. **安全性设计** - 认证授权、数据安全、接口安全
8. **部署与 DevOps** - 环境划分、CI/CD、监控告警

### Step 3: 检测 ainative-shadow 路由新增或修改并补充

**目标**：在 DESIGN.md 生成后，若项目存在 `ainative-shadow`，检测第 4 章是否包含 routers 新增或修改；若涉及则补充相应章节。

**检测逻辑**：

1. 确认项目存在 `ainative-shadow` 目录
2. 检查 DESIGN.md 第 4 章（前端技术方案）中的文件清单、路由配置是否包含 routers 新增或修改

**若检测到 routers 新增或修改**：按 [menu-planning.md](references/menu-planning.md) 补充 DESIGN.md：

- 在第 4 章添加 **4.5 路由与菜单配置** 子章节
- 在第 6 章添加菜单权限表设计（如需要）
- 明确标识需要执行菜单数据库注入任务

### Step 4: 完善技术实现细节

确保 Design 文档包含以下可执行的技术细节：

- **前端**：文件清单、目录结构（按开发规范）、路由配置、Pinia store、API 调用
- **后端**：Protobuf 接口定义、Service/Biz/Data 层文件清单、数据模型、核心业务流程
- **数据模型**：Mermaid ER 图、表设计（表名/字段/类型/约束/索引）、菜单权限表（如涉及）

## 技术栈速查

| 端       | 技术栈                                  | 规范路径                          |
| -------- | --------------------------------------- | --------------------------------- |
| 移动端   | Taro 3.6.23 + Vue3 + Webpack5           | `docs/dev-spec/ainative-app/`     |
| 管理后台 | Vue3 + Element Plus + TailwindCSS       | `docs/dev-spec/ainative-shadow/`  |
| 后端     | Go + Kratos + GORM + PostgreSQL + Redis | `docs/dev-spec/ainative-backend/` |

## 输出要求

### 文件规范

- **文件名**：`DESIGN.md`（必须）
- **位置**：`docs/design/DESIGN.md`
- **章节**：严格 8 个（禁止增删）
- **字数**：≥ 4000 字
- **图表**：≥ 3 个 Mermaid 图表（架构图/ER图/流程图）

### 内容要求

- ✅ 技术选型与 `docs/dev-spec/` 一致
- ✅ 目录结构参考开发规范
- ✅ 文件清单完整
- ✅ API 设计明确路径、参数、响应格式
- ✅ 数据模型包含 ER 图和表结构
- ✅ ainative-shadow 存在且第 4 章有 router 新增或修改时，必须包含 4.5 路由与菜单配置及数据库注入任务
- ❌ 禁止模板外章节、规范外技术栈、占位符、技术细节缺失

## 与后续流程衔接

- **project-management**：读取 Design，检测第 4.5 章节，在 `tasks.md` 中添加菜单注入任务
- **code-task-apply**：根据文件清单、API 设计、数据模型生成代码和迁移

## 常见问题处理

| 情况               | 处理方式                                       |
| ------------------ | ---------------------------------------------- |
| PRD 功能描述不清晰 | 基于工程经验合理假设，在 Design 中明确技术方案 |
| 技术选型不确定     | 参考开发规范                                   |
| router 信息不完整  | 在 Design 中说明需在执行阶段从路由文件提取     |
| 数据模型不明确     | 根据业务设计表结构，标注需评审                 |

## 附加资源

| 资源                                                | 说明                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| [design-template.md](references/design-template.md) | 8 章节模板                                                                     |
| [menu-planning.md](references/menu-planning.md)     | ainative-shadow 存在且 router 新增/修改时，补充 4.5/菜单表、配置格式、检查清单 |
| `docs/dev-spec/`                                    | 前后端开发规范                                                                 |

---

## 生成完成检查清单

输出 DESIGN.md 前必须确认：

- [ ] Step 1-4 均已执行
- [ ] Step 3 已执行：若存在 ainative-shadow，已检查第 4 章是否有 router 新增或修改
- [ ] 若检测到 router 新增或修改：已按 menu-planning.md 补充 4.5 和菜单表
- [ ] 若判断不涉及：已确认第 4 章无 ainative-shadow router 新增或修改

> **重要**：Design 文档是后续 openspec 任务规划的基础，必须确保技术实现细节完整、可执行。
