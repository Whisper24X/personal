package auth

import (
	"context"
	"fmt"

	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/middleware/selector"
	"github.com/go-kratos/kratos/v2/transport/http"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/service"
)

var wechatPrefixPathToWhiteList = map[string][]string{
	"/wechat.": {
		pb.OperationUserAuthLogin,
		pb.OperationUserAuthLoginXcx,
		pb.OperationUserAuthSendPhoneSmsCode,
		pb.OperationUserAuthPhoneLogin,
		pb.OperationEvaluationCreateEvaluation,
		pb.OperationGoodRecommendationCategoryGetGoodRecommendationCategoryList,
		pb.OperationGoodGetGoodInfo, // 在白名单中，但会被可选认证中间件处理
		pb.OperationCouponGetCouponList,
		pb.OperationWxXcxQrcodeGetWxXcxQrcodeScene,
	},
}

// 可选登录的接口列表（不强制要求登录，但如果有token会解析）
var wechatOptionalAuthList = []string{
	pb.OperationGoodGetGoodInfo, // 商品详情支持可选登录
}

// XcxAuthSelectorMiddleware 创建路由中间件
func WechatAuthSelectorMiddleware(wechatV1UserService *service.WechatV1UserService) middleware.Middleware {
	return selector.Server(
		WechatAuth(wechatV1UserService),
	).Match(whiteListMatcher(wechatPrefixPathToWhiteList)).Build()
}

// WechatOptionalAuthSelectorMiddleware 可选登录中间件（有token就解析，没有就跳过）
func WechatOptionalAuthSelectorMiddleware(wechatV1UserService *service.WechatV1UserService) middleware.Middleware {
	return selector.Server(
		WechatOptionalAuth(wechatV1UserService),
	).Match(optionalAuthMatcher()).Build()
}

// optionalAuthMatcher 可选登录接口匹配器
func optionalAuthMatcher() selector.MatchFunc {
	return func(ctx context.Context, operation string) bool {
		for _, op := range wechatOptionalAuthList {
			if operation == op {
				return true
			}
		}
		return false
	}
}

// XcxAuth 权限校验
func WechatAuth(
	wechatV1UserService *service.WechatV1UserService,
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
				jwtData, err := wechatV1UserService.AuthCheckToken(ctx, &pb.AuthCheckTokenReq{
					Token: token,
				})
				if err != nil {
					return nil, err
				}
				// 将JwtUID参数写进context中
				ctx = meta.SetMetadata(ctx, constant.XMdUserId, jwtData.UserId)
			}
			return handler(ctx, req)
		}
	}
}

// WechatOptionalAuth 可选权限校验（有token就验证，没有就跳过）
func WechatOptionalAuth(
	wechatV1UserService *service.WechatV1UserService,
) middleware.Middleware {
	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
			if tr, ok := http.RequestFromServerContext(ctx); ok {
				// 获取header头部中的Authorization的值
				authorization := tr.Header.Get("Authorization")

				// 如果没有token，直接放行（不设置userId）
				if authorization == "" {
					return handler(ctx, req)
				}

				// token截取
				var token string
				_, err := fmt.Sscanf(authorization, "Bearer %s", &token)
				if err != nil {
					// token格式错误，也放行（不设置userId）
					return handler(ctx, req)
				}

				// token解析
				jwtData, err := wechatV1UserService.AuthCheckToken(ctx, &pb.AuthCheckTokenReq{
					Token: token,
				})
				if err != nil {
					// token验证失败，也放行（不设置userId）
					return handler(ctx, req)
				}

				// 将JwtUID参数写进context中
				ctx = meta.SetMetadata(ctx, constant.XMdUserId, jwtData.UserId)
			}
			return handler(ctx, req)
		}
	}
}
