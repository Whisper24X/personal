package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_dock_config/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewDynamicDockConfigV1DynamicDockConfigService(
	logger log.Logger,
	dynamicDockConfigV1DynamicDockConfigUseCase *biz.DynamicDockConfigV1DynamicDockConfigUseCase,
) *DynamicDockConfigV1DynamicDockConfigService {
	l := log.NewHelper(log.With(logger, "module", "service/dynamicDockConfigV1DynamicDockConfig"), log.WithMessageKey("message"))
	return &DynamicDockConfigV1DynamicDockConfigService{
		log: l,
		dynamicDockConfigV1DynamicDockConfigUseCase: dynamicDockConfigV1DynamicDockConfigUseCase,
	}
}

type DynamicDockConfigV1DynamicDockConfigService struct {
	pb.UnimplementedDynamicDockConfigServer
	log                                         *log.Helper
	dynamicDockConfigV1DynamicDockConfigUseCase *biz.DynamicDockConfigV1DynamicDockConfigUseCase
}

// QueryDynamicDockConfigListShadow 查询动态dock配置列表
func (d *DynamicDockConfigV1DynamicDockConfigService) QueryDynamicDockConfigListShadow(ctx context.Context, req *pb.QueryDynamicDockConfigListShadowReq) (*pb.QueryDynamicDockConfigListShadowReply, error) {
	return d.dynamicDockConfigV1DynamicDockConfigUseCase.QueryDynamicDockConfigListShadow(ctx, req)
}

// StoreDynamicDockConfig 保存动态dock配置
func (d *DynamicDockConfigV1DynamicDockConfigService) StoreDynamicDockConfig(ctx context.Context, req *pb.StoreDynamicDockConfigReq) (*pb.StoreDynamicDockConfigReply, error) {
	return d.dynamicDockConfigV1DynamicDockConfigUseCase.StoreDynamicDockConfig(ctx, req)
}

// UpdateDynamicDockConfigStatus 修改动态dock配置状态
func (d *DynamicDockConfigV1DynamicDockConfigService) UpdateDynamicDockConfigStatus(ctx context.Context, req *pb.UpdateDynamicDockConfigStatusReq) (*pb.UpdateDynamicDockConfigStatusReply, error) {
	return d.dynamicDockConfigV1DynamicDockConfigUseCase.UpdateDynamicDockConfigStatus(ctx, req)
}

// QueryDynamicDockConfigListApi 客户端查询动态dock配置列表
func (d *DynamicDockConfigV1DynamicDockConfigService) QueryDynamicDockConfigListApi(ctx context.Context, req *pb.QueryDynamicDockConfigListApiReq) (*pb.QueryDynamicDockConfigListApiReply, error) {
	return d.dynamicDockConfigV1DynamicDockConfigUseCase.QueryDynamicDockConfigListApi(ctx, req)
}

// QueryDynamicDockConfigListShadowV2 查询动态dock配置列表(v2)
func (d *DynamicDockConfigV1DynamicDockConfigService) QueryDynamicDockConfigListShadowV2(ctx context.Context, req *pb.QueryDynamicDockConfigListShadowReq) (*pb.QueryDynamicDockConfigListShadowReply, error) {
	return d.dynamicDockConfigV1DynamicDockConfigUseCase.QueryDynamicDockConfigListShadowV2(ctx, req)
}

// StoreDynamicDockConfigV2 保存动态dock配置(v2)
func (d *DynamicDockConfigV1DynamicDockConfigService) StoreDynamicDockConfigV2(ctx context.Context, req *pb.StoreDynamicDockConfigReq) (*pb.StoreDynamicDockConfigReply, error) {
	return d.dynamicDockConfigV1DynamicDockConfigUseCase.StoreDynamicDockConfigV2(ctx, req)
}

// UpdateDynamicDockConfigStatusV2 修改动态dock配置状态(v2)
func (d *DynamicDockConfigV1DynamicDockConfigService) UpdateDynamicDockConfigStatusV2(ctx context.Context, req *pb.UpdateDynamicDockConfigStatusReq) (*pb.UpdateDynamicDockConfigStatusReply, error) {
	return d.dynamicDockConfigV1DynamicDockConfigUseCase.UpdateDynamicDockConfigStatusV2(ctx, req)
}

// QueryDynamicDockConfigListApiV2 客户端查询动态dock配置列表(v2)
func (d *DynamicDockConfigV1DynamicDockConfigService) QueryDynamicDockConfigListApiV2(ctx context.Context, req *pb.QueryDynamicDockConfigListApiReq) (*pb.QueryDynamicDockConfigListApiReply, error) {
	return d.dynamicDockConfigV1DynamicDockConfigUseCase.QueryDynamicDockConfigListApiV2(ctx, req)
}
