---
name: design
description: 将 PRD 转换为系统设计文档（DESIGN.md）
---

# PRD 转系统设计

## 执行流程

1. **读取模板** → [design-template.md](references/design-template.md)（8 个章节）
2. **读取开发规范** → `docs/dev-spec/{端类型}/` 确保技术选型正确
3. **生成 DESIGN.md** → 严格按模板 8 章节填充

## 技术栈速查

| 端       | 技术栈                                  | 规范路径                          |
| -------- | --------------------------------------- | --------------------------------- |
| 移动端   | Taro 3.6.23 + Vue3 + Webpack5           | `docs/dev-spec/ainative-app/`     |
| 管理后台 | Vue3 + Element Plus + TailwindCSS       | `docs/dev-spec/ainative-shadow/`  |
| 后端     | Go + Kratos + GORM + PostgreSQL + Redis | `docs/dev-spec/ainative-backend/` |

## 输出要求

- 文件名：`DESIGN.md`
- 章节：严格 8 章节（禁止增删）
- 字数：≥ 4000 字
- 图表：≥ 3 个 Mermaid（架构/ER/流程）
- 目录结构：与开发规范一致

## 禁止

- ❌ 添加模板外的章节
- ❌ 使用规范外的技术栈
- ❌ 占位符或空泛描述
