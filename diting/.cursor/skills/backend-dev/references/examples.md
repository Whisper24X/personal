# Examples

## 表驱动 CRUD

用户需求：开发课程包管理 CRUD。

路径：

```text
Audit -> Database -> GORM -> Proto -> API Generation -> Code -> Quality
```

关键点：

- 先设计 SQL 并 `make sqlimport`。
- 再 `make gorm`。
- 表驱动 proto 优先 `make sqltopb shadow {table}`。
- proto 修改后依次执行 `make api` 和 `make protocode`。
- 基于生成后的 Biz/Data/Service 文件继续实现业务逻辑。
- 实现 Biz/Data/Service/Server 后执行 `make wire` 和质量检查。

## 已有表业务 RPC

用户需求：给已有课程资源增加“手动同步”接口。

路径：

```text
Audit -> Proto -> API Generation -> Code -> Quality
```

关键点：

- 选择已有 proto 或确认新 proto 归属。
- 新增 RPC 和 message 后依次执行 `make api` 和 `make protocode`。
- 基于生成后的 Biz/Data/Service 文件继续实现业务逻辑。
- Service 只透传，业务逻辑写在 Biz。
- HTTP 注册和 ProviderSet 必须补齐。

## 无表测试接口

用户需求：写一个后端测试接口触发同步。

路径：

```text
Audit -> Resolve Proto Plan -> Proto -> API Generation -> Code -> Quality
```

关键点：

- 先说明该接口无表结构来源，不能通过 `sqltopb` 生成。
- 优先挂到已有业务域、服务职责、路由前缀匹配的 proto。
- 没有合适已有 proto 时，新建语义明确的测试/调试/任务/同步 proto。
- 只有多个方案都合理或模块边界不明确时才询问用户。
- 新增或编辑 proto 后依次执行 `make api` 和 `make protocode`。
- 接口注释必须标明测试或手动触发用途。

## 只改业务逻辑

用户需求：调整同步逻辑，不改接口。

路径：

```text
Audit -> Code -> Quality
```

关键点：

- 不需要 proto/API 生成。
- 优先复用生成 Repo 方法。
- 常量放 `internal/data/constant`。
- 每个新增方法写中文注释。

## 只重新生成 API

用户需求：proto 已改，重新生成接口代码。

路径：

```text
Audit -> API Generation -> Quality
```

关键点：

- 执行 `make api`。
- 执行 `make protocode`。
- 不使用历史错误脚手架命令。

## 反例库

反例库用于 Review Gate 识别 AI 生成代码中“脚本可能通过，但人类标准不接受”的写法。

每个反例必须包含稳定 `ID`，供审查结果引用。`Detect` 取值：

- `script`：当前脚本可检测。
- `review`：需要 Review Gate 语义审查。
- `future-ast`：当前脚本不覆盖，后续可用 AST 或静态分析检测。
- `manual`：需要人工结合业务背景判断。

### Service 层写业务逻辑

ID: `AP-SERVICE-LOGIC`

#### Bad

Service 方法中直接查库、拼查询条件、判断状态、组装业务返回，或在 Service 中调用 Data Repo。

#### Good

Service 只透传到 Biz UseCase：

```go
// ProductList 商品列表
func (s *ShadowV1ProductService) ProductList(ctx context.Context, req *pb.ProductListReq) (*pb.ProductListReply, error) {
	return s.productUseCase.ProductList(ctx, req)
}
```

#### Why

Service 是传输层适配，业务编排必须放在 Biz。Service 写业务逻辑会破坏 Biz/Data/Service 分层，导致逻辑分散且难以复用。

#### Detect

`future-ast`。当前脚本不可靠判断 Service 是否只透传，Review Gate 必须复核；后续可用 AST 检查 Service 方法体是否只返回 UseCase 调用。

### Data 层无意义封装生成 Repo

ID: `AP-DATA-REPO-WRAP`

#### Bad

生成 Repo 已经提供同等查询或更新能力时，又在 `internal/data` 新增一层只转发参数的方法。

#### Good

Biz 或 Data 自定义逻辑优先直接复用当前模块生成 Repo。只有生成 Repo 无法表达查询、需要 DTO 转换、事务、缓存或跨表聚合时，才新增 Data 自定义方法。

#### Why

无意义封装会增加维护成本，掩盖生成 Repo 的真实能力，并让调用链变长但没有新增业务价值。

#### Detect

`review`。需要 Review Gate 对照生成 Repo 能力和新增 Data 方法判断。

### 第三方 HTTP 请求绕过统一 Resty client

ID: `AP-HTTP-RPC-RESTY`

#### Bad

在 `internal/data/rpc`、Biz 或 Service 方法内直接 `resty.New()`，或绕过当前模块 `goresty/restry` 封装。

#### Good

HTTP RPC 构造函数接收统一注入的 `restyClient *resty.Client`，请求链路包含 `SetContext(ctx)`、`EnableTrace()`，并使用 `CheckStatus(resp)` 或等价公共方法检查响应状态。

#### Why

统一 Resty client 集中了熔断、超时、重试、链路追踪和错误日志。绕过统一 client 会造成观测、稳定性和错误处理能力缺失。

#### Detect

`script`。`compliance-verify.sh` 会检查业务代码中的 `resty.New()`、HTTP RPC 的 `SetContext(ctx)`、`EnableTrace()`、`CheckStatus(resp)` 以及 ProviderSet/Wire 注入。

### Biz 层新增业务常量

ID: `AP-BIZ-CONSTANT`

#### Bad

在 `internal/biz` 中新增场景、状态、类型、规则版本等业务常量，或在 Biz 中为 `constant.*` 再定义同义别名。

#### Good

业务常量统一放到 `internal/data/constant`，Biz 层直接引用 `constant.*`。

#### Why

业务常量跨 Biz/Data/Service/Test 复用时应统一归属，避免同义常量分散、命名漂移和规则不一致。

#### Detect

`script`。`compliance-verify.sh` 和 Quality Gate 会扫描 `internal/biz` 中新增的 `const (` 块；同义别名仍需 Review Gate 复核。

## 新反例回灌模板

Review Gate 发现新类型偏移但没有命中现有反例时，在最终报告中给出以下草案。默认不直接写入本文件，除非用户明确要求更新反例库。

```markdown
### <反例标题>

ID: `AP-<DOMAIN>-<NAME>`

#### Bad

<不符合团队标准的写法>

#### Good

<推荐写法>

#### Why

<为什么 Bad 不符合标准>

#### Detect

script / review / future-ast / manual
```
