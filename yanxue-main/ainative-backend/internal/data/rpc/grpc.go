package rpc

import (
	"context"
	"fmt"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/circuitbreaker"
	"github.com/go-kratos/kratos/v2/middleware/metadata"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
	"github.com/go-kratos/kratos/v2/registry"
	kGrpc "github.com/go-kratos/kratos/v2/transport/grpc"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/durationpb"
)

// NewGrpcClient 创建GRPC客户端
func NewGrpcClient(ctx context.Context, r registry.Discovery, serviceName string, timeoutDuration *durationpb.Duration) *grpc.ClientConn {
	timeout := 30 * time.Second
	if timeoutDuration != nil {
		timeout = timeoutDuration.AsDuration()
	}
	endpoint := fmt.Sprintf("discovery:///%s.grpc", serviceName)
	conn, err := kGrpc.DialInsecure(
		ctx,
		kGrpc.WithEndpoint(endpoint),
		kGrpc.WithDiscovery(r),
		kGrpc.WithTimeout(timeout),
		kGrpc.WithMiddleware(
			recovery.Recovery(),
			metadata.Client(),
			tracing.Client(),
			circuitbreaker.Client(),
		),
	)
	if err != nil {
		log.Fatalf("dial grpc client [%s] failed: %s", serviceName, err.Error())
	}
	return conn
}
