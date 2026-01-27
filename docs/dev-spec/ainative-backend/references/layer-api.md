# API 层编写指南

## 概述

API 层通过 Protobuf 定义接口,自动生成 HTTP/gRPC 代码。

**位置**: `api/`

## 目录结构

```
api/
├── app/                 # App 端接口
│   └── v1/
│       ├── auth.proto
│       └── user.proto
└── shadow/              # 管理后台接口
    └── v1/
        ├── sys_admin.proto
        ├── sys_role.proto
        └── ...
```

## 端命名规范

| 端 | 目录 | 说明 |
|---|------|------|
| app | `api/app/` | App 端 (用户侧) |
| shadow | `api/shadow/` | 管理后台 (管理员侧) |

如需新增端,创建对应目录并保持一致的结构。

## Proto 文件模板

```protobuf
syntax = "proto3";

package shadow.v1;

import "google/api/annotations.proto";
import "protoc-gen-openapiv2/options/annotations.proto";
import "validate/validate.proto";

option go_package = "gitlab.yc345.tv/ainative/ainative-backend/api/shadow/v1;v1";

// 变量的命名一律使用小驼峰命名法，例如：firstName、lastName等。
// 后缀定义:请求req,响应reply

// 模块名称
service ModuleName {
  // 方法描述
  rpc MethodName(MethodNameReq) returns (MethodNameReply) {
    option (google.api.http) = {get: "/shadow/v1/methodName"};
    option (grpc.gateway.protoc_gen_openapiv2.options.openapiv2_operation) = {
      parameters: {
        headers: {
          name: "Authorization"
          description: "TOKEN"
          type: STRING
          required: true
        }
      }
    };
  }
}
```

## HTTP 方法映射

### GET 请求

```protobuf
rpc GetList(GetListReq) returns (GetListReply) {
  option (google.api.http) = {get: "/shadow/v1/getList"};
}
```

### POST 请求

```protobuf
rpc CreateItem(CreateItemReq) returns (CreateItemReply) {
  option (google.api.http) = {
    post: "/shadow/v1/createItem"
    body: "*"
  };
}
```

### 带路径参数

```protobuf
rpc GetItem(GetItemReq) returns (GetItemReply) {
  option (google.api.http) = {get: "/shadow/v1/item/{id}"};
}

message GetItemReq {
  string id = 1;
}
```

## 参数校验

使用 `validate.proto` 进行参数校验:

### 字符串校验

```protobuf
// 必填,长度限制
string name = 1 [(validate.rules).string = {min_len: 1, max_len: 100}];

// UUID 格式
string id = 1 [(validate.rules).string = {uuid: true}];

// 可选 UUID
string id = 1 [(validate.rules).string = {ignore_empty: true, uuid: true}];

// 正则表达式
string phone = 1 [(validate.rules).string = {pattern: "^1[3-9]\\d{9}$"}];

// 邮箱
string email = 1 [(validate.rules).string = {email: true}];
```

### 数字校验

```protobuf
// 范围
int32 page = 1 [(validate.rules).int32 = {gte: 1}];
int32 pageSize = 2 [(validate.rules).int32 = {gte: 1, lte: 100}];

// 枚举值
int32 status = 1 [(validate.rules).int32 = {in: [-1, 1]}];

// 非负数
int32 price = 1 [(validate.rules).int32 = {gte: 0}];
```

### 数组校验

```protobuf
// 非空数组
repeated string ids = 1 [(validate.rules).repeated = {min_items: 1}];

// 元素校验
repeated string ids = 1 [(validate.rules).repeated = {
  min_items: 1,
  items: {string: {uuid: true}}
}];
```

## Message 定义规范

### 通用 Info 结构

用于列表和详情响应:

```protobuf
message ProductInfo {
  string id = 1;           // 主键
  string name = 2;         // 名称
  int32 price = 3;         // 价格
  int32 status = 4;        // 状态
  string createdAt = 5;    // 创建时间 (RFC3339 格式)
  string updatedAt = 6;    // 更新时间
}
```

### 列表请求/响应

```protobuf
message ProductListReq {
  int32 page = 1 [(validate.rules).int32 = {gte: 1}];
  int32 pageSize = 2 [(validate.rules).int32 = {gte: 1, lte: 100}];
  // 过滤条件
  string name = 3;
  int32 status = 4;
}

message ProductListReply {
  int32 total = 1;
  repeated ProductInfo list = 2;
}
```

### 保存请求/响应

```protobuf
message ProductStoreReq {
  string id = 1 [(validate.rules).string = {ignore_empty: true, uuid: true}]; // 空=新增,有值=更新
  string name = 2 [(validate.rules).string = {min_len: 1, max_len: 100}];
  int32 price = 3 [(validate.rules).int32 = {gte: 0}];
  int32 status = 4 [(validate.rules).int32 = {in: [-1, 1]}];
}

message ProductStoreReply {
  string id = 1;
}
```

### 删除请求/响应

```protobuf
message ProductDelReq {
  string id = 1 [(validate.rules).string = {uuid: true}];
}

message ProductDelReply {}
```

## 认证配置

需要认证的接口添加 Authorization header:

```protobuf
option (grpc.gateway.protoc_gen_openapiv2.options.openapiv2_operation) = {
  parameters: {
    headers: {
      name: "Authorization"
      description: "TOKEN"
      type: STRING
      required: true
    }
  }
};
```

## 引用其他 Proto

```protobuf
import "shadow/v1/sys_dept.proto";
import "shadow/v1/sys_permission.proto";

message SysAdminInfo {
  // ...
  repeated SysDeptInfo deptList = 10;
}
```

## 代码生成

```bash
# 生成所有 API 代码
make api

# 仅格式化 Proto 文件
make buf
```

## 生成的文件

| 文件 | 说明 |
|-----|------|
| `*.pb.go` | Protobuf 消息结构体 |
| `*_http.pb.go` | HTTP 路由和处理函数 |
| `*_grpc.pb.go` | gRPC 服务接口 |
| `*.pb.validate.go` | 参数校验函数 |
| `*.swagger.json` | OpenAPI 文档 |

## 注意事项

1. **命名规范**: 字段使用小驼峰 (camelCase)
2. **注释**: 每个字段添加注释,会生成到文档
3. **版本**: 使用 v1, v2 等版本号,便于接口升级
4. **后缀**: 请求用 `Req`,响应用 `Reply`
