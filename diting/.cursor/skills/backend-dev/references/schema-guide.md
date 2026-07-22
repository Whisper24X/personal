# 数据库表设计规范

## 必需字段

每张表**必须**包含以下字段：

```sql
id uuid DEFAULT gen_random_uuid() NOT NULL,
"createdAt" timestamp with time zone NOT NULL,
"updatedAt" timestamp with time zone NOT NULL,
"deletedAt" timestamp with time zone
```

## 表名前缀

| 前缀    | 模块     |
| ------- | -------- |
| `sys_`  | 系统管理 |
| `user_` | 用户相关 |
| `ai_`   | AI 功能  |
| `mall_` | 电商     |
| `dict_` | 字典数据 |
| `file_` | 文件管理 |

关联表命名：`{表1}_{表2}`，如 `sys_admin_role`。

## 字段命名

- 多词字段使用 `camelCase`，SQL 中需加双引号（如 `"sortOrder"`、`"imageUrl"`）
- 单词字段直接小写即可（如 `id`、`name`、`status`、`remark`）
- 外键：`"xxxId"` 格式（如 `"userId"`、`"roleId"`）
- 时间字段：`xxxAt` 后缀（如 `"createdAt"`、`"expiredAt"`）
- 状态字段：`status`，类型 `integer DEFAULT 1`，含义 `-1=禁用, 1=启用`

## 常用类型

| 用途   | 类型                             |
| ------ | -------------------------------- |
| 主键   | `uuid DEFAULT gen_random_uuid()` |
| 短文本 | `varchar(N)`                     |
| 长文本 | `text`                           |
| 时间戳 | `timestamp with time zone`       |
| 金额   | `numeric(10,2)`                  |
| 布尔   | `boolean`                        |
| JSON   | `jsonb`                          |
| 整数   | `integer` / `smallint`           |

## 索引命名

| 类型     | 命名格式                        | 示例                    |
| -------- | ------------------------------- | ----------------------- |
| 主键     | `{table}_pkey`                  | `user_pkey`             |
| 普通索引 | `{table}_{column}_idx`          | `user_status_idx`       |
| 唯一索引 | `{table}_{column}_idx` (UNIQUE) | `user_ph_idx`           |
| 复合索引 | `{table}_{col1}_{col2}_idx`     | `order_user_status_idx` |

## SQL 模板

```sql
CREATE TABLE public.{table} (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    -- 业务字段
    status integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);

COMMENT ON TABLE public.{table} IS '表描述';
COMMENT ON COLUMN public.{table}.id IS 'id';
COMMENT ON COLUMN public.{table}.status IS '状态: -1=禁用, 1=启用';
COMMENT ON COLUMN public.{table}."createdAt" IS '创建时间';
COMMENT ON COLUMN public.{table}."updatedAt" IS '更新时间';
COMMENT ON COLUMN public.{table}."deletedAt" IS '删除时间';

ALTER TABLE ONLY public.{table} ADD CONSTRAINT {table}_pkey PRIMARY KEY (id);
CREATE INDEX {table}_{column}_idx ON public.{table} USING btree ("{column}");
```

## 敏感数据处理

| 字段类型 | 存储方式                               |
| -------- | -------------------------------------- |
| 手机号   | 加密存储（`cryptutil.YcPhoneEncrypt`） |
| 密码     | Bcrypt 哈希（`cryptutil.BcryptHash`）  |
| 身份证   | 自定义加密                             |

## 菜单 SQL 模板

新增菜单时使用以下模板，**必须**使用 `gen_random_uuid()` 作为 id，**禁止**硬编码 UUID。

```sql
-- {模块}菜单注入（幂等）
-- 父菜单：id 用 gen_random_uuid()，pid 为 NULL
INSERT INTO public.sys_menu (id, pid, type, name, icon, path, permission, component, sort, status, "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, 'menu_dir', '父菜单名', 'ri:xxx-line', '/parent', 'menus.xxx.title', NULL, 10, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.sys_menu WHERE path = '/parent');

-- 子菜单：id 用 gen_random_uuid()，pid 通过 path 引用父菜单（必须 id::text，因 sys_menu.pid 为 varchar）
INSERT INTO public.sys_menu (id, pid, type, name, icon, path, permission, component, sort, status, "createdAt", "updatedAt")
SELECT gen_random_uuid(), (SELECT id::text FROM public.sys_menu WHERE path = '/parent' LIMIT 1), 'menu', '子菜单名', NULL, 'child', 'menus.xxx.child', '/parent/child', 11, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.sys_menu WHERE path = 'child' AND pid = (SELECT id::text FROM public.sys_menu WHERE path = '/parent' LIMIT 1));

-- 绑定 super 和超级管理员角色（按 path 查找菜单，不依赖固定 id）
-- 子菜单需用 path + pid 精确定位，pid 比较必须 id::text（sys_menu.pid 为 varchar）
INSERT INTO public.sys_role_menu ("roleId", "menuId")
SELECT '8e94f9e3-5d22-457b-928f-7292cbe46799'::uuid, m.id
FROM public.sys_menu m
WHERE (m.path = '/parent' AND m.pid IS NULL)
   OR (m.path = 'child' AND m.pid = (SELECT id::text FROM public.sys_menu WHERE path = '/parent' LIMIT 1))
  AND NOT EXISTS (SELECT 1 FROM public.sys_role_menu rm WHERE rm."roleId" = '8e94f9e3-5d22-457b-928f-7292cbe46799'::uuid AND rm."menuId" = m.id);

INSERT INTO public.sys_role_menu ("roleId", "menuId")
SELECT 'f6481f8e-b041-484a-9b1b-1f1b768cacb8'::uuid, m.id
FROM public.sys_menu m
WHERE (m.path = '/parent' AND m.pid IS NULL)
   OR (m.path = 'child' AND m.pid = (SELECT id::text FROM public.sys_menu WHERE path = '/parent' LIMIT 1))
  AND NOT EXISTS (SELECT 1 FROM public.sys_role_menu rm WHERE rm."roleId" = 'f6481f8e-b041-484a-9b1b-1f1b768cacb8'::uuid AND rm."menuId" = m.id);
```

**pid 类型转换（强制）**：`sys_menu.pid` 为 `varchar`，而 `id` 为 `uuid`。所有 pid 的赋值和比较必须使用 `(SELECT id::text FROM sys_menu WHERE path = '/父path' LIMIT 1)`，否则会报错 `operator does not exist: character varying = uuid`。

**要点**：后续新需求若在已有父菜单下新增子菜单，子菜单的 pid 使用 `(SELECT id::text FROM sys_menu WHERE path = '/已有父path' LIMIT 1)` 即可正确关联。
