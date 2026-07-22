# Database

## 适用场景

- 新建业务表
- 修改表结构
- 新增菜单 SQL
- 需要将 SQL 立即导入本地/容器数据库

## SQL 规范

- 每张表必须包含必要基础字段：`id`、`createdAt`、`updatedAt`、`deletedAt`，除非现有表规范另有约定。
- 多词字段使用 camelCase，SQL 中需要按项目现有规范处理大小写。
- 表、字段、索引必须包含必要注释。
- 数据库变更脚本必须幂等，优先使用 `IF NOT EXISTS`、`ADD COLUMN IF NOT EXISTS` 等写法。
- SQL 文件目录以当前后端模块实际规范为准，优先复用已有 `doc/sql/**` 目录；不存在时按业务域新建目录。
- 完整字段、索引、敏感数据和菜单 SQL 模板见 [schema-guide.md](schema-guide.md)。

## 导入 SQL

需要立即生效时必须执行：

```bash
cd <backend-dir> && make sqlimport <sql-file>
```

SQL 内容错误导致失败时必须修复 SQL 并重试，不允许把导入留给用户。
如果数据库连接、权限或本地环境不可用导致阻塞，按 Quality Gate 的 Blocked Result 模板说明阻塞命令、错误摘要、已完成工件、未验证项和下一步。

## 验证

- 检查 `make sqlimport` 输出无错误。
- 必要时通过 `make sqldump TABLES={table}` 或数据库查询确认表结构。
- 如果 SQL 影响菜单，导入后还要确认菜单可见并处理相关缓存。

## 菜单 SQL

涉及新增管理端菜单时：

- 生成 `{module}_menu.sql`。
- `sys_menu.id` 使用 `gen_random_uuid()`，禁止硬编码 UUID。
- 子菜单 `pid` 通过父菜单 `path` 查询，并使用 `id::text` 赋值。
- 角色绑定通过 path 查询菜单 ID，保证幂等。
- 菜单 SQL 必须执行 `make sqlimport`。
- 完整菜单 SQL 模板见 [schema-guide.md#菜单-sql-模板](schema-guide.md#菜单-sql-模板)。

## 输出模板

```markdown
## Database Result
- SQL file:
- Imported: yes/no
- Tables changed:
- Verification:
```
