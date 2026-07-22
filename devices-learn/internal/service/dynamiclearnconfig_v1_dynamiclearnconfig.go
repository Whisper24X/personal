package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_learn_config/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewDynamicLearnConfigV1DynamicLearnConfigService(
	logger log.Logger,
	dynamicLearnConfigV1DynamicLearnConfigUseCase *biz.DynamicLearnConfigV1DynamicLearnConfigUseCase,
) *DynamicLearnConfigV1DynamicLearnConfigService {
	l := log.NewHelper(log.With(logger, "module", "service/dynamicLearnConfigV1DynamicLearnConfig"), log.WithMessageKey("message"))
	return &DynamicLearnConfigV1DynamicLearnConfigService{
		log: l,
		dynamicLearnConfigV1DynamicLearnConfigUseCase: dynamicLearnConfigV1DynamicLearnConfigUseCase,
	}
}

type DynamicLearnConfigV1DynamicLearnConfigService struct {
	pb.UnimplementedDynamicLearnConfigServer
	log                                           *log.Helper
	dynamicLearnConfigV1DynamicLearnConfigUseCase *biz.DynamicLearnConfigV1DynamicLearnConfigUseCase
}

// QueryDynamicLearnConfigShadowList 查询动态学习配置列表
func (d *DynamicLearnConfigV1DynamicLearnConfigService) QueryDynamicLearnConfigShadowList(ctx context.Context, req *pb.QueryDynamicLearnConfigListShadowReq) (*pb.QueryDynamicLearnConfigListShadowReply, error) {
	return d.dynamicLearnConfigV1DynamicLearnConfigUseCase.QueryDynamicLearnConfigShadowList(ctx, req)
}

// StoreDynamicLearnConfig 保存动态学习配置
func (d *DynamicLearnConfigV1DynamicLearnConfigService) StoreDynamicLearnConfig(ctx context.Context, req *pb.StoreDynamicLearnConfigReq) (*pb.StoreDynamicLearnConfigReply, error) {
	return d.dynamicLearnConfigV1DynamicLearnConfigUseCase.StoreDynamicLearnConfig(ctx, req)
}

// UpdateDynamicLearnConfigStatus 修改动态学习配置状态
func (d *DynamicLearnConfigV1DynamicLearnConfigService) UpdateDynamicLearnConfigStatus(ctx context.Context, req *pb.UpdateDynamicLearnConfigStatusReq) (*pb.UpdateDynamicLearnConfigStatusReply, error) {
	return d.dynamicLearnConfigV1DynamicLearnConfigUseCase.UpdateDynamicLearnConfigStatus(ctx, req)
}

// QueryDynamicLearnConfigListApi 客户端查询动态配置列表
func (d *DynamicLearnConfigV1DynamicLearnConfigService) QueryDynamicLearnConfigListApi(ctx context.Context, req *pb.QueryDynamicLearnConfigListApiReq) (*pb.QueryDynamicLearnConfigListApiReply, error) {
	return d.dynamicLearnConfigV1DynamicLearnConfigUseCase.QueryDynamicLearnConfigListApi(ctx, req)
}

// BatchCreateDynamicLearnConfig 批量复制动态学习配置
func (d *DynamicLearnConfigV1DynamicLearnConfigService) BatchCreateDynamicLearnConfig(ctx context.Context, req *pb.BatchCreateDynamicLearnConfigReq) (*pb.BatchCreateDynamicLearnConfigReply, error) {
	return d.dynamicLearnConfigV1DynamicLearnConfigUseCase.BatchCreateDynamicLearnConfig(ctx, req)
}
