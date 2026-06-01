package restry

import (
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	"github.com/dubonzi/otelresty"
	"github.com/go-kratos/kratos/v2/errors"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-resty/resty/v2"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
)

// NewResty  http 客户端
func NewResty(cfg *conf.Bootstrap, logger log.Logger) *resty.Client {
	l := log.NewHelper(log.With(logger, "module", "resty"), log.WithMessageKey("message"))
	client := resty.New()
	// 设置请求头
	client.SetHeader("app-from", cfg.Name)
	// 设置超时时间
	client.SetTimeout(5 * time.Second)
	// 禁止重定向
	client.SetRedirectPolicy(resty.NoRedirectPolicy())
	// 设置最大重试次数
	client.SetRetryCount(2)
	// 设置重试等待时间  默认100 milliseconds
	client.SetRetryWaitTime(100 * time.Microsecond)
	// 设置重试最大等待时间 默认2s
	client.SetRetryMaxWaitTime(2 * time.Second)
	// 链路追踪
	opts := []otelresty.Option{otelresty.WithTracerName(cfg.Name)}
	otelresty.TraceClient(client, opts...)
	// 设置错误时触发
	client.OnError(func(r *resty.Request, err error) {
		if err != nil {
			l.WithContext(r.Context()).Warnw("message", RequestMessage(r, err), "msg", "restyErr")
		}
	})
	// 设置结束后执行
	client.OnAfterResponse(func(c *resty.Client, r *resty.Response) error {
		// 非200状态码日志
		if r.RawResponse.StatusCode != http.StatusOK {
			l.WithContext(r.Request.Context()).Warnw("message", ResponseMessage(r), "msg", "restyNotOK")
		}
		// 慢日志
		if r.Time() > time.Millisecond*500 {
			l.WithContext(r.Request.Context()).Warnw("message", ResponseMessage(r), "msg", "restySlow")
		}
		return nil
	})
	return client
}

type Message struct {
	Path    string            `json:"path"`
	Method  string            `json:"method"`
	Header  map[string]string `json:"headers"`
	Query   url.Values        `json:"query"`
	ReqBody interface{}       `json:"req_body"`
	ResBody interface{}       `json:"res_body"`
	Status  int               `json:"status"`
	Latency int64             `json:"latency"`
	Err     string            `json:"err"`
}

// RequestMessage 请求日志
func RequestMessage(r *resty.Request, err error) *Message {
	return &Message{
		Path:    r.URL,
		Method:  r.Method,
		Header:  headerToMap(r.Header),
		Query:   r.QueryParam,
		ReqBody: r.Body,
		ResBody: "",
		Status:  0,
		Latency: 0,
		Err:     err.Error(),
	}
}

// ResponseMessage 响应日志
func ResponseMessage(r *resty.Response) *Message {
	return &Message{
		Path:    r.Request.URL,
		Method:  r.Request.Method,
		Header:  headerToMap(r.Request.Header),
		Query:   r.Request.QueryParam,
		ReqBody: r.Request.Body,
		ResBody: r.String(),
		Status:  r.StatusCode(),
		Latency: r.Time().Milliseconds(),
		Err:     "",
	}
}

// headerToMap 转换header
func headerToMap(header http.Header) map[string]string {
	result := make(map[string]string)
	for key, values := range header {
		if len(values) > 0 {
			result[key] = values[0]
		}
	}
	return result
}

// CheckStatus 检查状态
func CheckStatus(resp *resty.Response) error {
	if resp.StatusCode() == http.StatusOK {
		return nil
	}
	status := &errors.Status{}
	_ = json.Unmarshal([]byte(resp.String()), status)
	if status.GetCode() == 0 && status.GetReason() == "" && status.GetMessage() == "" {
		return errors.New(resp.StatusCode(), "NotStatusOK", "Not StatusOK")
	}
	return errors.New(resp.StatusCode(), status.GetReason(), status.GetMessage())
}
