# SQL 导入规范

## 概述

本规范用于管理数据库初始化数据和增量数据的导入流程，确保开发的功能（如菜单、权限、字典等）能正确同步到各环境。

## SQL 文件组织

### 目录结构

```
ainative-backend/doc/sql/
├── init.sql              # 完整初始化脚本（表结构 + 初始数据）
├── migrations/           # 增量迁移脚本目录
│   ├── 20260129_add_xxx_menu.sql
│   └── 20260130_add_yyy_feature.sql
└── seeds/                # 种子数据目录
    ├── sys_menu.sql      # 菜单数据
    ├── sys_role.sql      # 角色数据
    └── sys_dept.sql      # 部门数据
```

### 文件命名规范

| 类型 | 格式 | 示例 |
|-----|------|------|
| 完整初始化 | `init.sql` | `init.sql` |
| 增量迁移 | `YYYYMMDD_描述.sql` | `20260129_add_user_menu.sql` |
| 种子数据 | `表名.sql` | `sys_menu.sql` |

## 使用方法

### 导入 SQL 文件

```bash
# 导入单个文件
make sqlimport ./doc/sql/init.sql

# 导入增量迁移
make sqlimport ./doc/sql/migrations/20260129_add_xxx_menu.sql

# 导入目录下所有文件
make sqlimport ./doc/sql/migrations/
```

### 导出表数据

```bash
# 导出指定表数据
make sqldump TABLES=sys_menu

# 导出多个表
make sqldump TABLES=sys_menu,sys_role,sys_role_menu
```

## 开发规范

### 必须同步初始化数据的场景

| 场景 | 涉及表 | 说明 |
|-----|--------|------|
| 新增菜单/页面 | `sys_menu` | 菜单目录、菜单项、按钮权限 |
| 新增权限点 | `sys_menu` | type=button 的权限按钮 |
| 新增角色 | `sys_role`, `sys_role_menu` | 角色及其权限绑定 |
| 新增部门 | `sys_dept` | 部门层级结构 |
| 新增字典 | 字典相关表 | 系统字典数据 |

### 开发流程 Checklist

开发新功能时，请按以下步骤操作：

#### 1. 功能开发阶段

- [ ] 在开发环境数据库创建所需数据（菜单、权限等）
- [ ] 功能开发完成并测试通过

#### 2. 数据同步阶段

- [ ] 导出新增的数据记录
  ```bash
  make sqldump TABLES=sys_menu
  ```
- [ ] 创建增量迁移文件
  ```bash
  touch doc/sql/migrations/$(date +%Y%m%d)_add_xxx_feature.sql
  ```
- [ ] 将新增数据的 INSERT 语句写入迁移文件
- [ ] 更新 `init.sql` 中的完整初始化数据

#### 3. 代码提交阶段

- [ ] SQL 文件与功能代码一起提交
- [ ] 在 Merge Request 描述中注明需要执行的 SQL

### 菜单数据示例

新增功能菜单时，需要添加以下数据：

```sql
-- 1. 菜单目录（一级菜单）
INSERT INTO "public"."sys_menu" 
("id", "pid", "type", "name", "icon", "path", "permission", "component", "sort", "status", "createdAt", "updatedAt") 
VALUES
('新UUID', NULL, 'menu_dir', '功能名称', 'ri:icon-name', '/feature', 'menus.feature.title', NULL, 30, 1, NOW(), NOW());

-- 2. 菜单项（二级菜单）
INSERT INTO "public"."sys_menu" 
("id", "pid", "type", "name", "icon", "path", "permission", "component", "sort", "status", "createdAt", "updatedAt") 
VALUES
('新UUID', '父菜单ID', 'menu', '子菜单名', NULL, 'sub-path', 'menus.feature.sub', '/feature/sub', 31, 1, NOW(), NOW());

-- 3. 按钮权限
INSERT INTO "public"."sys_menu" 
("id", "pid", "type", "name", "icon", "path", "permission", "component", "sort", "status", "createdAt", "updatedAt") 
VALUES
('新UUID', '菜单ID', 'button', '新增', NULL, 'feature:add', 'menus.feature.add', NULL, 311, 1, NOW(), NOW()),
('新UUID', '菜单ID', 'button', '编辑', NULL, 'feature:edit', 'menus.feature.edit', NULL, 312, 1, NOW(), NOW()),
('新UUID', '菜单ID', 'button', '删除', NULL, 'feature:delete', 'menus.feature.delete', NULL, 313, 1, NOW(), NOW());

-- 4. 角色权限绑定（给超级管理员分配权限）
INSERT INTO "public"."sys_role_menu" ("roleId", "menuId") 
VALUES
('8e94f9e3-5d22-457b-928f-7292cbe46799', '菜单ID'),  -- super 角色
('f6481f8e-b041-484a-9b1b-1f1b768cacb8', '菜单ID');  -- 超级管理员角色
```

### sys_menu 字段说明

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | UUID | 主键，使用 `uuid_generate_v4()` 生成 |
| pid | VARCHAR | 父级菜单 ID，顶级菜单为 NULL |
| type | VARCHAR | 类型：`menu_dir`=目录，`menu`=菜单，`button`=按钮 |
| name | VARCHAR | 菜单名称（显示用） |
| icon | VARCHAR | 图标，使用 Remix Icon 格式如 `ri:xxx-line` |
| path | VARCHAR | 路由路径（唯一） |
| permission | VARCHAR | 权限标识，用于国际化 key |
| component | VARCHAR | 组件路径，如 `/system/admin` |
| sort | INTEGER | 排序值，数值越小越靠前 |
| status | SMALLINT | 状态：1=启用，-1=禁用 |

## 常见问题

### Q: 开发环境有菜单，测试环境没有？

**原因**: 数据库数据未同步

**解决方法**:
1. 从开发环境导出菜单数据
2. 创建迁移 SQL 文件
3. 在测试环境执行导入

```bash
# 开发环境导出
make sqldump TABLES=sys_menu

# 测试环境导入
make sqlimport ./doc/sql/migrations/xxx.sql
```

### Q: 如何生成 UUID？

```sql
-- PostgreSQL 中生成 UUID
SELECT uuid_generate_v4();

-- 或在 INSERT 时使用 DEFAULT
INSERT INTO sys_menu (id, ...) VALUES (DEFAULT, ...);
```

### Q: 权限不生效？

检查以下内容：
1. `sys_menu` 中是否有对应记录
2. `sys_role_menu` 中是否绑定了角色
3. 用户是否分配了对应角色

## 注意事项

1. **UUID 一致性**: 同一功能在不同环境使用相同的 UUID，避免关联数据错乱
2. **幂等性**: 迁移脚本应支持重复执行，使用 `ON CONFLICT DO NOTHING` 或先判断存在
3. **顺序依赖**: 先插入父级数据（如目录），再插入子级数据（如菜单、按钮）
4. **代码同步**: SQL 文件必须与功能代码同时提交，不可遗漏

## 环境同步流程

```
开发环境 (dev)
    ↓ 功能开发 + 数据创建
    ↓ 导出 SQL
    ↓ 提交代码 + SQL
测试环境 (test)
    ↓ make sqlimport
    ↓ 验证通过
预发布环境 (stage)
    ↓ make sqlimport
    ↓ 验证通过
生产环境 (prod)
    ↓ make sqlimport
    ↓ 上线完成
```
