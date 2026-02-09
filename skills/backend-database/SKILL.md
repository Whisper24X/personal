---
name: backend-database
description: 设计并创建 PostgreSQL 数据库表，生成建表 SQL 并通过 make sqlimport 导入容器内数据库。当用户需要新建表、修改表结构、查询现有表、设计表关系，或提到数据库、建表、字段设计时使用此技能。
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

1. 每张表必须包含 `id`、`created_at`、`updated_at`、`deleted_at` 四个基础字段
2. 表名使用正确的模块前缀（`sys_`、`user_`、`ai_`、`mall_` 等）
3. 字段使用 `snake_case` 命名
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

## 参考资料

- 完整建表规范与 SQL 模板：[references/schema-guide.md](references/schema-guide.md)
