# 错误码定义和使用规范

## 概述

项目使用统一的错误码管理机制，支持国际化、错误追踪和自动导出文档。

**位置**: `internal/data/errorx/`

## 错误码结构

每个错误码包含三个要素：

| 字段 | 说明 | 示例 |
|-----|------|------|
| HTTP Code | HTTP 状态码 | `400`, `401`, `409`, `500` |
| Reason | 错误标识（唯一） | `AccountNotExist` |
| Message | 中文错误消息 | `帐户不存在` |

```go
Manager.New(http.StatusConflict, "AccountNotExist", "帐户不存在")
//          ↑ HTTP Code          ↑ Reason          ↑ Message
```

## HTTP 状态码规范

| 状态码 | 含义 | 使用场景 |
|-------|------|---------|
| `400 Bad Request` | 参数错误 | 参数绑定、校验失败 |
| `401 Unauthorized` | 认证失败 | Token 无效、过期 |
| `409 Conflict` | 业务冲突 | 数据不存在、重复、状态异常 |
| `500 Internal Server Error` | 服务器错误 | 数据库、Redis、内部异常 |
| `504 Gateway Timeout` | 请求超时 | 接口超时 |

## 错误码分类

### 参数相关 (400)

```go
var (
    ParamBindErr             = Manager.New(http.StatusBadRequest, "ParamBindErr", "参数绑定错误")
    ParamErr                 = Manager.New(http.StatusBadRequest, "ParamErr", "参数错误")
    ParamValidationErr       = Manager.New(http.StatusBadRequest, "ParamValidationErr", "参数验证错误")
    ParamPhoneInvalid        = Manager.New(http.StatusBadRequest, "ParamPhoneInvalid", "手机号格式错误")
    ParamIdentityCardInvalid = Manager.New(http.StatusBadRequest, "ParamIdentityCardInvalid", "身份证号格式错误")
)
```

### Token 相关 (401)

```go
var (
    TokenNotRequest        = Manager.New(http.StatusUnauthorized, "TokenNotRequest", "未携带令牌")
    TokenInvalid           = Manager.New(http.StatusUnauthorized, "TokenInvalid", "令牌无效")
    TokenExpired           = Manager.New(http.StatusUnauthorized, "TokenExpired", "令牌过期")
    TokenPermissionChanged = Manager.New(http.StatusUnauthorized, "TokenPermissionChanged", "令牌失效：管理员权限发生变更，请重新登录")
    TokenOtherDeviceLogin  = Manager.New(http.StatusUnauthorized, "TokenOtherDeviceLogin", "令牌失效：其他设备已登录，请重新登录")
)
```

### 数据相关 (409/500)

```go
var (
    // 服务器内部错误 (500)
    DataSQLErr          = Manager.New(http.StatusInternalServerError, "DataSQLErr", "数据处理异常(S),请稍后再试")
    DataRedisErr        = Manager.New(http.StatusInternalServerError, "DataRedisErr", "数据处理异常(R),请稍后再试")
    DataMQErr           = Manager.New(http.StatusInternalServerError, "DataMQErr", "数据处理异常(M),请稍后再试")
    
    // 业务冲突 (409)
    DataRecordNotFound   = Manager.New(http.StatusConflict, "DataRecordNotFound", "数据记录未找到")
    DataDuplicateRecords = Manager.New(http.StatusConflict, "DataDuplicateRecords", "数据重复记录")
)
```

### 账号相关 (409)

```go
var (
    AccountNotExist          = Manager.New(http.StatusConflict, "AccountNotExist", "帐户不存在")
    AccountExist             = Manager.New(http.StatusConflict, "AccountExist", "帐户已存在")
    AccountIsLocked          = Manager.New(http.StatusConflict, "AccountIsLocked", "帐号被锁定")
    AccountWrongPassword     = Manager.New(http.StatusConflict, "AccountWrongPassword", "帐号密码错误")
    AccountPhoneAlreadyRegister = Manager.New(http.StatusConflict, "AccountPhoneAlreadyRegister", "手机号已注册")
)
```

## 使用方式

### 基本使用

```go
import "gitlab.yc345.tv/ainative/ainative-backend/internal/data/errorx"

// 直接返回错误
return nil, errorx.AccountNotExist.Err()

// 包装原始错误（保留错误链）
result, err := db.Query(...)
if err != nil {
    return nil, errorx.DataSQLErr.WithError(err).Err()
}
```

### 添加格式化消息

```go
// 使用 WithFmtMsg 添加动态消息
// 注意：Message 中需要包含 %s 占位符
var UserLimitExceeded = Manager.New(http.StatusConflict, "UserLimitExceeded", "用户数量超过限制: %s")

return nil, errorx.UserLimitExceeded.WithFmtMsg("最多100个").Err()
// 输出: "用户数量超过限制: 最多100个"
```

### 错误检查

```go
import "github.com/go-kratos/kratos/v2/errors"

// 检查是否为特定错误
if errors.Is(err, errorx.AccountNotExist.Err()) {
    // 处理账户不存在的情况
}

// 获取错误码信息
se := errors.FromError(err)
if se != nil {
    fmt.Println(se.Code)    // HTTP 状态码
    fmt.Println(se.Reason)  // 错误标识
    fmt.Println(se.Message) // 错误消息
}
```

## 新增错误码

### 步骤

1. 在 `internal/data/errorx/code.go` 中添加错误码
2. 如需国际化，在 `i18n_enus.go` 中添加英文翻译

### 示例

```go
// 1. code.go - 添加错误码
// 商品相关
var (
    ProductNotFound    = Manager.New(http.StatusConflict, "ProductNotFound", "商品不存在")
    ProductOutOfStock  = Manager.New(http.StatusConflict, "ProductOutOfStock", "商品库存不足")
    ProductOffShelves  = Manager.New(http.StatusConflict, "ProductOffShelves", "商品已下架")
)

// 2. i18n_enus.go - 添加英文翻译（可选）
var EnUSMap = map[string]string{
    // ... 现有翻译
    "ProductNotFound":   "Product not found",
    "ProductOutOfStock": "Product out of stock",
    "ProductOffShelves": "Product is off shelves",
}
```

### 命名规范

| 规范 | 说明 | 示例 |
|-----|------|------|
| 大驼峰命名 | Reason 使用 PascalCase | `AccountNotExist` |
| 模块前缀 | 按业务模块分组 | `Account*`, `Token*`, `Product*` |
| 动作描述 | 描述具体问题 | `NotExist`, `Duplicate`, `Invalid` |

### Reason 命名参考

| 后缀 | 含义 | 示例 |
|-----|------|------|
| `NotExist` | 不存在 | `AccountNotExist` |
| `Exist` | 已存在 | `AccountExist` |
| `Duplicate` | 重复 | `DataDuplicateRecords` |
| `Invalid` | 无效 | `TokenInvalid` |
| `Expired` | 过期 | `TokenExpired` |
| `Err` | 错误 | `DataSQLErr` |
| `Failed` | 失败 | `TokenGenerationFailed` |
| `Limit` | 限制 | `SmsFrequencyLimit` |

## 国际化

### 配置

错误管理器初始化时配置国际化：

```go
var Manager = errx.NewErrorManager(errx.WithI18n(errx.EnUS, EnUSMap))
```

### 翻译文件

```go
// internal/data/errorx/i18n_enus.go
package errorx

var EnUSMap = map[string]string{
    "ParamBindErr":    "parameter binding error",
    "ParamErr":        "parameter error",
    "DataSQLErr":      "db data exception",
    "AccountNotExist": "account not exist",
    // ... 其他翻译
}
```

### 语言切换

客户端通过请求头 `lang` 指定语言：

```
GET /api/xxx
lang: en-US
```

支持的语言：
- `zh-CN` - 简体中文（默认）
- `en-US` - 英文

## 错误响应格式

API 返回的错误格式：

```json
{
    "code": 409,
    "reason": "AccountNotExist",
    "message": "帐户不存在",
    "metadata": {
        "line": "internal/biz/auth_login.go:45",
        "cause": "record not found"
    }
}
```

| 字段 | 说明 |
|-----|------|
| `code` | HTTP 状态码 |
| `reason` | 错误标识 |
| `message` | 错误消息（根据语言返回） |
| `metadata.line` | 错误发生位置 |
| `metadata.cause` | 原始错误信息 |

## 导出错误码文档

```bash
make errcode
```

输出文件: `doc/errcode/code.md`

生成的 Markdown 表格包含所有错误码及其翻译。

## 最佳实践

### 1. 选择正确的 HTTP 状态码

```go
// ✓ 正确：参数错误用 400
ParamErr = Manager.New(http.StatusBadRequest, ...)

// ✓ 正确：认证失败用 401
TokenExpired = Manager.New(http.StatusUnauthorized, ...)

// ✓ 正确：业务冲突用 409
AccountNotExist = Manager.New(http.StatusConflict, ...)

// ✓ 正确：服务器内部错误用 500
DataSQLErr = Manager.New(http.StatusInternalServerError, ...)
```

### 2. 保留原始错误

```go
// ✓ 正确：使用 WithError 保留原始错误
if err != nil {
    return nil, errorx.DataSQLErr.WithError(err).Err()
}

// ✗ 错误：丢失原始错误信息
if err != nil {
    return nil, errorx.DataSQLErr.Err()
}
```

### 3. 用户友好的消息

```go
// ✓ 正确：用户友好的消息
DataSQLErr = Manager.New(..., "数据处理异常,请稍后再试")

// ✗ 错误：暴露技术细节
DataSQLErr = Manager.New(..., "PostgreSQL connection failed")
```

### 4. 错误码唯一性

```go
// ✓ 正确：每个错误码 Reason 唯一
AccountNotExist = Manager.New(..., "AccountNotExist", ...)
UserNotExists   = Manager.New(..., "UserNotExists", ...)

// ✗ 错误：Reason 重复会 panic
AccountNotExist = Manager.New(..., "NotExist", ...)
UserNotExists   = Manager.New(..., "NotExist", ...)  // panic!
```

## 现有错误码分类

| 分类 | 前缀 | 示例 |
|-----|------|------|
| 参数错误 | `Param*` | `ParamErr`, `ParamValidationErr` |
| 数据错误 | `Data*` | `DataSQLErr`, `DataRecordNotFound` |
| 请求错误 | `Request*`, `API*` | `RequestTimeoutErr`, `APIThirdErr` |
| Token 错误 | `Token*` | `TokenExpired`, `TokenInvalid` |
| 账号错误 | `Account*` | `AccountNotExist`, `AccountIsLocked` |
| 微信错误 | `Wx*` | `WxServiceErr`, `WxUserNotExist` |
| 用户错误 | `User*` | `UserNoPermission`, `UserNotExists` |
| 短信错误 | `Sms*`, `ImgCode*` | `SmsCodeInvalid`, `SmsSendErr` |
| 角色错误 | `Role*` | `RoleNotExists` |
| 部门错误 | `Dept*` | `DeptHasAdminCanNotDel` |
| 权限错误 | `Permission*` | `PermissionPathDuplicate` |
