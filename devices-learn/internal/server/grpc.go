package server

import (
	"github.com/go-kratos/kratos/v2/middleware/metadata"
	"github.com/go-kratos/kratos/v2/middleware/ratelimit"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
	"github.com/go-kratos/kratos/v2/transport/grpc"
	"gitlab.yc345.tv/backend/devices-learn/internal/conf"
	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/middleware/logger"
	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/middleware/recovery"
	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/middleware/validate"
	"gitlab.yc345.tv/backend/utils/v2/metrics"
	requestCancel "gitlab.yc345.tv/backend/utils/v2/requestCancelHandle/middleware"
)

// NewGRPCServer new a gRPC server.
func NewGRPCServer(
	config *conf.Bootstrap,
) *grpc.Server {
	var opts = []grpc.ServerOption{
		// tracing,logger, recovery的顺序不能变
		grpc.Middleware(
			tracing.Server(),
			metrics.KratosMiddleware(),
			logger.GrpcLogger(config),
			recovery.Recovery(),
			metadata.Server(),
			validate.Validator(),
			ratelimit.Server(),
			requestCancel.KratosMiddleware(&requestCancel.Option{
				Timeout: config.GetServer().GetGrpc().GetTimeout().AsDuration(),
			}),
		),
	}
	if config.Server.Grpc.Network != "" {
		opts = append(opts, grpc.Network(config.Server.Grpc.Network))
	}
	if config.Server.Grpc.Addr != "" {
		opts = append(opts, grpc.Address(config.Server.Grpc.Addr))
	}
	if config.Server.Grpc.Timeout != nil {
		opts = append(opts, grpc.Timeout(config.Server.Grpc.Timeout.AsDuration()))
	}
	srv := grpc.NewServer(opts...)

	return srv
}
