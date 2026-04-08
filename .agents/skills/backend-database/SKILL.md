---
name: backend-database
description: 设计并创建 PostgreSQL 数据库表，生成建表 SQL 并通过 make sqlimport 导入容器内数据库。支持菜单 SQL（*_menu.sql）注入，编码环节必须执行 sqlimport 使菜单即时生效。当用户需要新建表、修改表结构、查询现有表、设计表关系、菜单注入，或提到数据库、建表、字段设计时使用此技能。
allowed-tools: Read, Write, Glob, Shell
---

# 数据库表设计（Step 1）

## 建表工作流

复制以下清单跟踪进度：

```
建表进度：
- [ ] Step 1: 需求收集与现有表审计
- [ ] Step 2: 设计表结构
- [ ] Step 3: 编写并保存 SQL 文件
- [ ] Step 4: 导入 SQL 到数据库
- [ ] Step 5: 验证表创建结果
```

**Step 1: 需求收集与现有表审计**

明确业务需求：需要存储哪些实体？表之间有什么关联关系？

查看已有表结构，避免命名冲突：

```bash
# 查看现有 SQL 文件
ls ainative-backend/doc/sql/ainative-backend/

# 查看 init.sql 中已有的表
grep 'CREATE TABLE' ainative-backend/doc/sql/init.sql
```

阅读 [references/schema-guide.md](references/schema-guide.md) 了解完整命名规范和类型约定。

**Step 2: 设计表结构**

基于需求设计表，**必须遵守以下规则**：

1. 每张表必须包含 `id`、`"createdAt"`、`"updatedAt"`、`"deletedAt"` 四个基础字段
2. 表名使用正确的模块前缀（`sys_`、`user_`、`ai_`、`mall_` 等）
3. 多词字段使用 `camelCase` 命名，SQL 中需加双引号（如 `"sortOrder"`）；单词字段直接小写（如 `name`、`status`）
4. 每个字段和表都需要 `COMMENT`

完整的字段类型、索引命名、SQL 模板见 [references/schema-guide.md](references/schema-guide.md)。

**Step 3: 编写并保存 SQL 文件**

将完整 SQL（含 CREATE TABLE、COMMENT、PRIMARY KEY、INDEX）保存到：

```
ainative-backend/doc/sql/ainative-backend/{table}.sql
```

**Step 4: 导入 SQL 到数据库**

数据库运行在容器内，使用 `make sqlimport` 导入（在 `ainative-backend/` 目录下执行）：

```bash
cd ainative-backend && make sqlimport ./doc/sql/ainative-backend/{table}.sql
```

导入失败时，检查终端错误信息，修正 SQL 文件后重新执行。

**Step 5: 验证表创建结果**

检查 `make sqlimport` 的终端输出，确认无报错。

如需进一步确认，可用 `make sqldump` 导出表结构进行比对：

```bash
cd ainative-backend && make sqldump TABLES={table}
```

## 输出格式

完成后输出：

```
## Step 1: 数据库表
- 表名: {table}
- 状态: ✅ 已创建
- 字段数: {count}
- 索引: {list}
```

## 菜单 SQL 注入（\*\_menu.sql）

当任务涉及**新增菜单**（如轮播图管理、内容管理等）时，需生成菜单 SQL 并导入。

**工作流**：

1. 在 `ainative-backend/doc/sql/ainative_backend/` 下创建 `{module}_menu.sql`（如 `carousel_menu.sql`）
2. SQL 内容：向 `sys_menu` 插入菜单项，向 `sys_role_menu` 绑定 super 角色，使用 `INSERT...SELECT...WHERE NOT EXISTS` 保证幂等
3. **必须执行导入**（SQL 目录以 `ainative-backend/doc/sql/` 下实际目录为准，当前仓库为 `yanxue`）：
   ```bash
   cd ainative-backend && make sqlimport ./doc/sql/yanxue/{module}_menu.sql
   ```
4. 验证：检查输出无报错，登录 Shadow 确认菜单已显示

### 菜单 SQL 规范（强制，避免 UUID 冲突）

**禁止硬编码 UUID**：`sys_menu` 的 `id` 必须使用 `gen_random_uuid()`，禁止使用 `'xxx-xxx-xxx'::uuid` 等硬编码值，否则会与 `init.sql` 或已有菜单冲突导致 `sys_menu_pkey` 重复键错误。

**id 与 pid 关联规则**：

| 菜单类型           | id                  | pid                                                              |
| ------------------ | ------------------- | ---------------------------------------------------------------- |
| 父菜单（顶层目录） | `gen_random_uuid()` | `NULL`                                                           |
| 子菜单             | `gen_random_uuid()` | `(SELECT id::text FROM sys_menu WHERE path = '/父path' LIMIT 1)` |

**pid 类型转换（强制）**：`sys_menu.pid` 为 `varchar`，`id` 为 `uuid`。pid 的赋值和比较必须用 `id::text`，否则会报 `operator does not exist: character varying = uuid`。

**path 作为稳定引用键**：子菜单的 pid、角色绑定的 menuId 均通过 **path** 引用，执行时从数据库查询。这样后续新需求的菜单 SQL 可正确引用已存在的父菜单，无需关心父菜单的 id 具体值。

完整模板见 [references/schema-guide.md#菜单-sql-模板](references/schema-guide.md#菜单-sql-模板)。

> **重要**：`init.sql` 仅首次启动时执行，菜单 SQL 不会自动纳入。**编码环节必须执行 sqlimport**，否则 Shadow 界面不会显示新菜单。

## 参考资料

- 完整建表规范与 SQL 模板：[references/schema-guide.md](references/schema-guide.md)
