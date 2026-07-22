# 第三方 HTTP RPC

## 适用场景

当后端模块需要通过 HTTP 调用第三方服务、内部 HTTP 服务或基础能力服务时，按本规范新增 `internal/data/rpc/*.go` 封装。

典型参考：

- `devices-management/internal/data/rpc/sms_captcha.go`
- 当前模块的 `internal/pkg/goresty` 或 `internal/pkg/restry`

注意：Go 的 `internal` 包不能跨模块直接引用。每个模块必须优先使用本模块已有的 `internal/pkg/goresty` 或 `internal/pkg/restry` 封装，不要从其他模块导入 `internal/pkg`。

## 统一客户端

HTTP RPC 必须复用依赖注入的 `*resty.Client`，不要在 RPC 方法或业务方法中直接 `resty.New()`。

统一客户端应集中配置：

- 熔断；
- 超时；
- 重试；
- 禁止重定向；
- 链路追踪；
- 错误日志；
- 慢请求日志。

如果当前模块还没有统一客户端封装，先在当前模块 `internal/pkg/goresty` 或 `internal/pkg/restry` 按现有模块风格补齐，再接入 ProviderSet 和 Wire。

## 标准写法

```go
func NewXxxHttpRpc(logger log.Logger, cfg *conf.Bootstrap, restyClient *resty.Client) *XxxHttpRpc {
	l := log.NewHelper(log.With(logger, "module", "data/xxxHttpRpc"), log.WithMessageKey("message"))
	return &XxxHttpRpc{
		log:         l,
		cfg:         cfg,
		restyClient: restyClient,
	}
}

type XxxHttpRpc struct {
	log         *log.Helper
	cfg         *conf.Bootstrap
	restyClient *resty.Client
}

// VerifyXxx 调用第三方接口校验 xxx
func (h *XxxHttpRpc) VerifyXxx(ctx context.Context, req *VerifyXxxReq) (*VerifyXxxReply, error) {
	reply := &VerifyXxxReply{}
	resp, err := h.restyClient.R().
		SetContext(ctx).
		SetBody(req).
		EnableTrace().
		SetResult(reply).
		Post("http://service-name/path")
	if err != nil {
		return nil, err
	}
	if err := restry.CheckStatus(resp); err != nil {
		return nil, err
	}
	return reply, nil
}
```

## 请求规则

- 构造函数接收 `logger log.Logger`、按需接收 `cfg *conf.Bootstrap`，并必须接收 `restyClient *resty.Client`。
- 结构体保存 `log *log.Helper`、按需保存 `cfg`，并必须保存 `restyClient *resty.Client`。
- 请求方法必须接收 `ctx context.Context`。
- Resty 调用链必须包含 `SetContext(ctx)` 和 `EnableTrace()`。
- `POST`、`PUT` 请求使用 `SetBody(req)`。
- `GET` 请求使用 `SetQueryParams(req)`、`SetQueryParamsFromValues(req)` 或当前模块已有等价方法。
- 有结构化响应时使用 `SetResult(reply)`。
- 调用后先处理网络错误，再调用项目封装的 `CheckStatus(resp)` 或等价公共状态检查方法。
- 必填参数在进入第三方请求前校验。
- 业务错误按当前模块 `errorx` 风格包装。
- 涉及手机号、设备标识等敏感信息时，日志不得明文输出敏感字段。

## 依赖注入

新增 HTTP RPC 后必须检查：

- `internal/data/data.go` 的 ProviderSet 注册了 `NewXxxHttpRpc`。
- `cmd/*/wire_gen.go` 已通过 `make wire` 更新。
- 如果新增统一 Resty 客户端，ProviderSet 中已注册 `goresty.NewResty` 或 `restry.NewResty`。

## 脚本验证

新增或修改 HTTP RPC 后，合规脚本会检查：

```bash
rg "resty.New\\(" internal/data internal/biz internal/service -g "*.go"
rg "SetContext\\(ctx\\)" <changed-rpc-files>
rg "EnableTrace\\(\\)" <changed-rpc-files>
rg "CheckStatus\\(resp\\)" <changed-rpc-files>
rg "New.*HttpRpc" internal/data/data.go
```

命中 `resty.New(` 时，如果位置不在当前模块 `internal/pkg/goresty`、`internal/pkg/restry` 或既有统一初始化位置，必须改为依赖注入统一 client。

## 人工复核

脚本无法完全判断语义，收尾时还必须复核：

- URL 来源是否符合当前模块配置习惯，避免新增不可治理的散落硬编码。
- 错误码和错误包装是否符合调用方语义。
- 响应体解析是否匹配第三方真实返回结构。
- 请求日志是否避免泄露手机号、身份证、设备标识、验证码、token 等敏感信息。
