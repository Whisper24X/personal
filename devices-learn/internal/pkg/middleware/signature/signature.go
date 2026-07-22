package signature

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/middleware/selector"
	"github.com/go-kratos/kratos/v2/transport"
	httpTransport "github.com/go-kratos/kratos/v2/transport/http"
	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/signature"
)

const TTL = 5 * time.Minute

var AppKeyToSecret = map[string]string{
	"RuXiao":   "fceb6dabb07826785198b33a1dbcaa66",
	"Business": "4f1c3d5ebac5436eb87752e7e2036c3b",
}

// Signature 签名中间件
func Signature() middleware.Middleware {
	return selector.Server(
		Middleware(),
	).Match(WhiteListMatcher()).Build()
}

// WhiteListMatcher 创建路由白名单
func WhiteListMatcher() selector.MatchFunc {
	whiteList := make(map[string]bool)
	return func(ctx context.Context, operation string) bool {
		if _, ok := whiteList[operation]; !ok {
			return false
		}
		return true
	}
}

// Middleware 用于处理请求取消的情况
func Middleware() middleware.Middleware {
	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
			tr, ok := transport.FromServerContext(ctx)
			if !ok {
				return false, errors.New(http.StatusBadRequest, "-1", "请求类型错误")
			}
			ht, ok := tr.(*httpTransport.Transport)
			if !ok {
				return false, errors.New(http.StatusBadRequest, "-1", "请求类型错误")
			}
			headers := map[string]string{}
			keys := ht.RequestHeader().Keys()
			for _, k := range keys {
				headers[strings.ToLower(k)] = tr.RequestHeader().Get(k)
			}
			appKey := headers["appkey"]
			authorization := headers["authorization"]
			authorizationDate := headers["authorizationdate"]
			method := ht.Request().Method
			uri := ht.Request().RequestURI
			if authorization == "" || authorizationDate == "" || appKey == "" {
				return false, errors.New(http.StatusBadRequest, "-1", "缺少必要header参数，Authorization/AuthorizationDate/AppKey")
			}
			// 校验AppKey
			secret, ok := AppKeyToSecret[appKey]
			if !ok {
				return reply, errors.New(http.StatusBadRequest, "-1", "AppKey不正确，请检查AppKey参数")
			}
			// 校验签名
			reqRawMessage, _ := json.Marshal(req)
			checkErr := signature.New(appKey, secret, TTL).Verify(uri, method, reqRawMessage, authorization, authorizationDate)
			if checkErr != nil {
				return reply, errors.New(http.StatusBadRequest, "-1", "签名校验失败，签名过期或签名错误")
			}
			return handler(ctx, req)
		}
	}
}
