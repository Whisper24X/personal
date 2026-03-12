package logger

import (
	"github.com/go-kratos/kratos/v2/middleware"
	logMiddleware "gitlab.yc345.tv/backend/go-logger/logger/middleware"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
)

// HTTPLogger 打印出入参数日志
func HTTPLogger(config *conf.Bootstrap) middleware.Middleware {
	options := &logMiddleware.LogOption{
		HeaderWhiteList:   nil,
		EnableResWithCode: int(config.Logger.EnableResWithCode),
		EnableReqWithCode: int(config.Logger.EnableReqWithCode),
	}
	if len(config.Logger.HeaderWhites) > 0 {
		options.HeaderWhiteList = &config.Logger.HeaderWhites
	}
	return logMiddleware.KratosMiddleware(options)
}

// GrpcLogger 打印出入参数日志
func GrpcLogger(config *conf.Bootstrap) middleware.Middleware {
	options := &logMiddleware.LogOption{
		HeaderWhiteList:   nil,
		EnableResWithCode: int(config.Logger.EnableResWithCode),
		EnableReqWithCode: int(config.Logger.EnableReqWithCode),
	}
	if len(config.Logger.HeaderWhites) > 0 {
		options.HeaderWhiteList = &config.Logger.HeaderWhites
	}
	return logMiddleware.KratosGRPCMiddleware(options)
}
