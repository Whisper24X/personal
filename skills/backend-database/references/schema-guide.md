# 数据库表设计规范

## 必需字段

每张表**必须**包含以下字段：

```sql
id uuid DEFAULT gen_random_uuid() NOT NULL,
created_at timestamp with time zone NOT NULL,
updated_at timestamp with time zone NOT NULL,
deleted_at timestamp with time zone
```

## 表名前缀

| 前缀 | 模块 |
|------|------|
| `sys_` | 系统管理 |
| `user_` | 用户相关 |
| `ai_` | AI 功能 |
| `mall_` | 电商 |
| `dict_` | 字典数据 |
| `file_` | 文件管理 |

关联表命名：`{表1}_{表2}`，如 `sys_admin_role`。

## 字段命名

- 使用 `snake_case`
- 外键：`{table}_id`
- 时间字段：`_at` 后缀（如 `created_at`、`expired_at`）
- 状态字段：`status`，类型 `integer DEFAULT 1`，含义 `-1=禁用, 1=启用`

## 常用类型

| 用途 | 类型 |
|------|------|
| 主键 | `uuid DEFAULT gen_random_uuid()` |
| 短文本 | `varchar(N)` |
| 长文本 | `text` |
| 时间戳 | `timestamp with time zone` |
| 金额 | `numeric(10,2)` |
| 布尔 | `boolean` |
| JSON | `jsonb` |
| 整数 | `integer` / `smallint` |

## 索引命名

| 类型 | 命名格式 | 示例 |
|------|---------|------|
| 主键 | `{table}_pkey` | `user_pkey` |
| 普通索引 | `{table}_{column}_idx` | `user_status_idx` |
| 唯一索引 | `{table}_{column}_idx` (UNIQUE) | `user_ph_idx` |
| 复合索引 | `{table}_{col1}_{col2}_idx` | `order_user_status_idx` |

## SQL 模板

```sql
CREATE TABLE public.{table} (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    -- 业务字段
    status integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);

COMMENT ON TABLE public.{table} IS '表描述';
COMMENT ON COLUMN public.{table}.id IS 'id';
COMMENT ON COLUMN public.{table}.status IS '状态: -1=禁用, 1=启用';
COMMENT ON COLUMN public.{table}.created_at IS '创建时间';
COMMENT ON COLUMN public.{table}.updated_at IS '更新时间';
COMMENT ON COLUMN public.{table}.deleted_at IS '删除时间';

ALTER TABLE ONLY public.{table} ADD CONSTRAINT {table}_pkey PRIMARY KEY (id);
CREATE INDEX {table}_{column}_idx ON public.{table} USING btree ({column});
```

## 敏感数据处理

| 字段类型 | 存储方式 |
|---------|---------|
| 手机号 | 加密存储（`cryptutil.YcPhoneEncrypt`） |
| 密码 | Bcrypt 哈希（`cryptutil.BcryptHash`） |
| 身份证 | 自定义加密 |
