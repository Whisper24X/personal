# Proto 模板资产

> 供 `backend-dev` 的 Proto 步骤按需读取。

## 删除 RPC 模板

# 删除不需要的 RPC 方法

sqltopb 默认生成 5 个标准 CRUD 方法，根据业务需求删除不需要的。

## 常见删除场景

| 方法             | 常见删除场景                            |
| ---------------- | --------------------------------------- |
| `Create{Table}`  | 有自定义创建逻辑（如订单用 PlaceOrder） |
| `Update{Table}`  | 数据不可修改（如订单、日志）            |
| `Delete{Table}`  | 数据不可删除（如订单、审计记录）        |
| `Get{Table}Info` | 不需要单条查询                          |
| `Get{Table}List` | 不需要列表查询                          |

## 删除步骤

1. 删除 service 中的 rpc 定义
2. 删除对应的 Request Message（如 `Delete{Table}Req`）
3. 删除对应的 Reply Message（如 `Delete{Table}Reply`）

## 示例 - 删除 Update 和 Delete

**删除前：**

```protobuf
service MallOrder {
  rpc CreateMallOrder(CreateMallOrderReq) returns (CreateMallOrderReply) {...}
  rpc UpdateMallOrder(UpdateMallOrderReq) returns (UpdateMallOrderReply) {...}  // 删除
  rpc DeleteMallOrder(DeleteMallOrderReq) returns (DeleteMallOrderReply) {...}  // 删除
  rpc GetMallOrderInfo(GetMallOrderInfoReq) returns (GetMallOrderInfoReply) {...}
  rpc GetMallOrderList(GetMallOrderListReq) returns (GetMallOrderListReply) {...}
}

// 以下 Message 也需要删除
message UpdateMallOrderReq {...}
message UpdateMallOrderReply {...}
message DeleteMallOrderReq {...}
message DeleteMallOrderReply {...}
```

**删除后：**

```protobuf
service MallOrder {
  rpc CreateMallOrder(CreateMallOrderReq) returns (CreateMallOrderReply) {...}
  rpc GetMallOrderInfo(GetMallOrderInfoReq) returns (GetMallOrderInfoReply) {...}
  rpc GetMallOrderList(GetMallOrderListReq) returns (GetMallOrderListReply) {...}
}
```

## 典型业务场景

### 订单表（只保留查询）

```protobuf
service MallOrder {
  // 保留
  rpc GetMallOrderInfo(...) returns (...) {...}
  rpc GetMallOrderList(...) returns (...) {...}

  // 删除 Create/Update/Delete，使用自定义业务方法替代
  // rpc PlaceOrder(...) returns (...) {...}  // 自定义下单
}
```

### 日志/审计表（只保留列表查询）

```protobuf
service OperationLog {
  // 只保留列表查询
  rpc GetOperationLogList(...) returns (...) {...}

  // 删除 Create/Update/Delete/GetInfo
}
```

### 配置表（只保留单条查询和更新）

```protobuf
service SystemConfig {
  // 保留查询和更新
  rpc GetSystemConfigInfo(...) returns (...) {...}
  rpc UpdateSystemConfig(...) returns (...) {...}

  // 删除 Create/Delete/GetList
}
```

---

## Proto 编辑示例

# Proto 编辑示例

基于 `api/shadow/v1/user.proto` 风格。

## 1. Service 定义

```protobuf
//用户表
service User {
  //用户表-创建一条数据
  rpc CreateUser(CreateUserReq) returns (CreateUserReply) {
    option (google.api.http) = {
      post: "/shadow/v1/user/create"
      body: "*"
    };
    option (grpc.gateway.protoc_gen_openapiv2.options.openapiv2_operation) = {
      parameters: {
        headers: {
          name: "Authorization"
          description: "Bearer Token"
          type: STRING
          required: true
        }
      }
    };
  }
}
```

## 2. Info 消息

```protobuf
//用户表信息
message UserInfo {
  string id = 1; // id
  string phone = 2; // 手机
  string nickname = 3; // 昵称
  int32 gender = 4; // 性别（0未知 1男 2女）
  int32 status = 9; // 状态
  string createdAt = 10; // 创建时间
  string updatedAt = 11; // 更新时间
  UserMembershipInfo userMembershipInfo = 12; // 关联信息
}
```

## 3. Create 请求

```protobuf
//请求-用户表-创建一条数据
message CreateUserReq {
  option (grpc.gateway.protoc_gen_openapiv2.options.openapiv2_schema) = {
    json_schema: {
      required: [
        "phone",
        "status"
      ]
    }
  };
  string phone = 1 [(buf.validate.field).string = {min_len: 1}]; // 手机
  string nickname = 2 [
    (buf.validate.field).ignore = IGNORE_IF_UNPOPULATED,
    (buf.validate.field).string = {min_len: 1}
  ]; // 昵称
  int32 gender = 3 [(buf.validate.field).ignore = IGNORE_IF_UNPOPULATED]; // 性别
  int32 status = 6; // 状态
}

//响应-用户表-创建一条数据
message CreateUserReply {
  string id = 1; // id
}
```

## 4. Update 请求

```protobuf
//请求-用户表-更新一条数据
message UpdateUserReq {
  option (grpc.gateway.protoc_gen_openapiv2.options.openapiv2_schema) = {
    json_schema: {
      required: ["id"]
    }
  };
  string id = 1 [(buf.validate.field).string = {
    min_len: 1
    max_len: 128
  }]; // id
  string nickname = 2 [
    (buf.validate.field).ignore = IGNORE_IF_UNPOPULATED,
    (buf.validate.field).string = {min_len: 1}
  ]; // 昵称
  int32 status = 6; // 状态
}

//响应-用户表-更新一条数据
message UpdateUserReply {}
```

## 5. List 请求（带过滤）

```protobuf
//请求-用户表-列表数据查询
message GetUserListReq {
  option (grpc.gateway.protoc_gen_openapiv2.options.openapiv2_schema) = {
    json_schema: {
      required: ["page", "pageSize"]
    }
  };
  int32 page = 1 [(buf.validate.field).int32 = {gte: 1}]; //页码
  int32 pageSize = 2 [(buf.validate.field).int32 = {gte: 1, lte: 1000}]; //页数
  string nickname = 3; // 昵称
  string phone = 4; // 手机
  int32 status = 5; // 状态
  repeated string createdAt = 6; // 创建时间
}

//响应-用户表-列表数据查询
message GetUserListReply {
  int32 total = 1; //总数
  repeated UserInfo list = 2; // 列表数据
}
```

---
