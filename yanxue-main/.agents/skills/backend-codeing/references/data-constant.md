# Data 常量定义参考

> 何时阅读: 需要新增/调整业务常量时。

## 文件位置

- `ainative-backend/internal/data/constant/constant.go`

## 现有常量分类

- Header 元数据 Key：如 `XMdAdminId` / `XMdUserId`
- 状态值：如 `SysStatusEnable` / `SysStatusDisable`
- 角色数据权限：如 `SysRoleDataPermissionTypeAll` / `SysRoleDataPermissionTypeDept`
- 部门类型：如 `SysDeptTypeRoot` / `SysDeptTypeChild` / `SysDeptTypeLeaf`

## 新增规范

- 只放跨模块共用的常量，避免在业务文件内硬编码字符串/数值
- 按业务域分组，使用 `const (...)` 块
- 保持命名风格：
  - 类型前缀：`SysRoleDataPermissionTypeXxx`
  - 状态：`SysStatusXxx`
  - Header：`XMdXxx`
- 变更后检查所有引用点，避免旧值残留

## 示例

```go
const (
    SysStatusDisable int16 = -1
    SysStatusEnable  int16 = 1
)
```
