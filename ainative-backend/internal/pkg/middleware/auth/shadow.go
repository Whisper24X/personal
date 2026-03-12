package auth

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/go-kratos/kratos/v2/errors"
	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/middleware/selector"
	"github.com/go-kratos/kratos/v2/transport/http"
	"github.com/gogf/gf/v2/util/gconv"
	shadowV1 "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/iputil"
	"gitlab.yc345.tv/backend/yanxue/internal/service"
)

var shadowPrefixPathToWhiteList = map[string][]string{
	"/shadow.": {
		shadowV1.OperationSysAuthSysAuthLogin,
		shadowV1.OperationOrderDouYinOrderInfoCallback,
	},
}

// ShadowAuthSelectorMiddleware 创建路由中间件
func ShadowAuthSelectorMiddleware(shadowV1SysAuthService *service.ShadowV1SysAuthService, shadowV1SysOperationLogService *service.ShadowV1SysOperationLogService) middleware.Middleware {
	return selector.Server(
		ShadowAuth(shadowV1SysAuthService, shadowV1SysOperationLogService),
	).Match(whiteListMatcher(shadowPrefixPathToWhiteList)).Build()
}

// ShadowAuth 权限校验
func ShadowAuth(
	shadowV1SysAuthService *service.ShadowV1SysAuthService,
	shadowV1SysOperationLogService *service.ShadowV1SysOperationLogService,
) middleware.Middleware {
	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
			if tr, ok := http.RequestFromServerContext(ctx); ok {
				// Do something on entering
				// 获取header头部中的Authorization的值
				authorization := tr.Header.Get("Authorization")
				// 不存在则报错
				if authorization == "" {
					return nil, errorx.TokenNotRequest.Err()
				}
				// token截取
				var token string
				_, err = fmt.Sscanf(authorization, "Bearer %s", &token)
				if err != nil {
					return nil, errorx.TokenFormatErr.WithError(err).Err()
				}
				// token解析
				jwtData, err3 := shadowV1SysAuthService.SysAuthCheckToken(ctx, &shadowV1.SysAuthCheckTokenReq{
					Token: token,
				})
				if err3 != nil {
					return nil, err3
				}
				adminId := gconv.String(jwtData.AdminId)
				// 将JwtUID参数写进context中
				ctx = meta.SetMetadata(ctx, constant.XMdAdminId, adminId)
				// 获取真实IP
				ip := iputil.GetRealIP(tr)
				defer func() {
					// Do something on exiting
					if tr.Method != "GET" {
						var replyJson []byte
						if err != nil {
							replyJson, _ = json.Marshal(errors.FromError(err))
						} else {
							replyJson, _ = json.Marshal(reply)
						}
						headerJson, _ := json.Marshal(tr.Header)
						reqJson, _ := json.Marshal(req)
						_, _ = shadowV1SysOperationLogService.SysOperationLogStore(ctx, &shadowV1.SysOperationLogStoreReq{
							AdminId:   adminId,
							Ip:        ip,
							Method:    tr.Method,
							Uri:       tr.RequestURI,
							Useragent: tr.UserAgent(),
							Header:    string(headerJson),
							Req:       string(reqJson),
							Resp:      string(replyJson),
						})
					}
				}()
			}
			return handler(ctx, req)
		}
	}
}
