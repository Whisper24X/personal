package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_function_config/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewDynamicFunctionConfigV1DynamicFunctionConfigService(
	logger log.Logger,
	dynamicFunctionConfigV1DynamicFunctionConfigUseCase *biz.DynamicFunctionConfigV1DynamicFunctionConfigUseCase,
) *DynamicFunctionConfigV1DynamicFunctionConfigService {
	l := log.NewHelper(log.With(logger, "module", "service/dynamicFunctionConfigV1DynamicFunctionConfig"), log.WithMessageKey("message"))
	return &DynamicFunctionConfigV1DynamicFunctionConfigService{
		log: l,
		dynamicFunctionConfigV1DynamicFunctionConfigUseCase: dynamicFunctionConfigV1DynamicFunctionConfigUseCase,
	}
}

type DynamicFunctionConfigV1DynamicFunctionConfigService struct {
	pb.UnimplementedDynamicFunctionConfigServer
	log                                                 *log.Helper
	dynamicFunctionConfigV1DynamicFunctionConfigUseCase *biz.DynamicFunctionConfigV1DynamicFunctionConfigUseCase
}

// QueryDynamicFunctionConfigListApi 客户端查询动态功能配置列表
func (d *DynamicFunctionConfigV1DynamicFunctionConfigService) QueryDynamicFunctionConfigListApi(ctx context.Context, req *pb.QueryDynamicFunctionConfigListApiReq) (*pb.QueryDynamicFunctionConfigListApiResp, error) {
	return d.dynamicFunctionConfigV1DynamicFunctionConfigUseCase.QueryDynamicFunctionConfigListApi(ctx, req)
}

// StoreDynamicFunctionConfig 保存动态功能配置
func (d *DynamicFunctionConfigV1DynamicFunctionConfigService) StoreDynamicFunctionConfig(ctx context.Context, req *pb.StoreDynamicFunctionConfigReq) (*pb.StoreDynamicFunctionConfigReply, error) {
	return d.dynamicFunctionConfigV1DynamicFunctionConfigUseCase.StoreDynamicFunctionConfig(ctx, req)
}

// UpdateDynamicFunctionConfigStatus 修改动态功能配置状态
func (d *DynamicFunctionConfigV1DynamicFunctionConfigService) UpdateDynamicFunctionConfigStatus(ctx context.Context, req *pb.UpdateDynamicFunctionConfigStatusReq) (*pb.UpdateDynamicFunctionConfigStatusReply, error) {
	return d.dynamicFunctionConfigV1DynamicFunctionConfigUseCase.UpdateDynamicFunctionConfigStatus(ctx, req)
}

// QueryDynamicFunctionConfigListShadow shadow查询动态功能配置列表
func (d *DynamicFunctionConfigV1DynamicFunctionConfigService) QueryDynamicFunctionConfigListShadow(ctx context.Context, req *pb.QueryDynamicFunctionConfigListShadowReq) (*pb.QueryDynamicFunctionConfigListShadowReply, error) {
	return d.dynamicFunctionConfigV1DynamicFunctionConfigUseCase.QueryDynamicFunctionConfigListShadow(ctx, req)
}
