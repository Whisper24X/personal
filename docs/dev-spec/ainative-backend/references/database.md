# 数据库设计规范

## 技术栈

| 组件 | 技术 |
|-----|------|
| 数据库 | PostgreSQL |
| ORM | GORM (gen) |
| 缓存 | Redis + RocksCache |

## 表命名规范

| 规范 | 说明 | 示例 |
|-----|------|------|
| 小写字母 | 使用小写 | `user`, `product` |
| 下划线分隔 | 多词用下划线 | `sys_admin`, `order_item` |
| 系统表前缀 | 系统表以 `sys_` 开头 | `sys_role`, `sys_dept` |
| 关联表命名 | `{表1}_{表2}` | `sys_admin_role` |

## 字段命名规范

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 主键 |
| {table}Id | VARCHAR(64) | | 外键,如 `userId`, `roleId` |
| status | SMALLINT | NOT NULL, DEFAULT 1 | 状态: -1=禁用, 1=启用 |
| createdAt | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 更新时间 |

## 数据类型规范

| 场景 | 类型 | 说明 |
|-----|------|------|
| 主键 | UUID | 使用 uuid_generate_v4() |
| 短文本 | VARCHAR(n) | 指定合适长度 |
| 长文本 | TEXT | 无长度限制 |
| 整数 | INTEGER / SMALLINT | 状态用 SMALLINT |
| 金额 | INTEGER | 存储分,避免浮点精度问题 |
| 时间 | TIMESTAMPTZ | 带时区时间戳 |
| 布尔 | BOOLEAN | true/false |
| JSON | JSONB | 结构化数据 |

## 敏感数据处理

| 字段类型 | 存储方式 | 工具 |
|---------|---------|------|
| 手机号 | 加密存储 | `cryptutil.YcPhoneEncrypt` |
| 密码 | Bcrypt 哈希 | `cryptutil.BcryptHash` |
| 身份证 | 加密存储 | 自定义加密 |

## 索引规范

| 类型 | 命名格式 | 示例 |
|-----|---------|------|
| 主键 | `{table}_pkey` | `user_pkey` |
| 唯一索引 | `idx_{table}_{field}` | `idx_user_ph` |
| 普通索引 | `idx_{table}_{field}` | `idx_user_status` |
| 复合索引 | `idx_{table}_{field1}_{field2}` | `idx_order_user_status` |

## 缓存 Key 规范

格式: `DBCache:{项目}:{表}By{字段}:{值}`

示例:
- `DBCache:devices_demo:UserByID:xxx-uuid`
- `DBCache:devices_demo:UserByCondition:hash`

## 代码生成

```bash
# 生成指定表的 GORM 代码
make gorm TABLES=table_name

# 生成多个表
make gorm TABLES=table1,table2
```

生成位置:
- Model: `internal/data/gorm/ainative_backend_model/`
- DAO: `internal/data/gorm/ainative_backend_dao/`
- Repo: `internal/data/gorm/ainative_backend_repo/`

## 建表模板

```sql
CREATE TABLE table_name (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE table_name IS '表说明';
COMMENT ON COLUMN table_name.id IS '主键';
COMMENT ON COLUMN table_name.name IS '名称';
COMMENT ON COLUMN table_name.status IS '状态: -1=禁用, 1=启用';
```

## 初始化数据管理

开发新功能时涉及菜单、权限、角色等数据，需要同步到 `doc/sql/` 目录。

详细规范参考: [SQL 导入规范](./sql-import.md)

## 现有表列表

| 表名 | 说明 |
|-----|------|
| sys_admin | 系统管理员 |
| sys_role | 系统角色 |
| sys_dept | 系统部门 |
| sys_menu | 系统菜单权限 |
| sys_admin_role | 管理员-角色关联 |
| sys_admin_dept | 管理员-部门关联 |
| sys_role_menu | 角色-菜单权限关联 |
| sys_operation_log | 操作日志 |
| sys_data_log | 数据变更日志 |
| user | 用户 |
| user_wx | 用户微信信息 |
