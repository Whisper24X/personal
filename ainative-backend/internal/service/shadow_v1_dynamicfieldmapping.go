package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1DynamicFieldMappingService(
	logger log.Logger,
	shadowV1DynamicFieldMappingUseCase *biz.ShadowV1DynamicFieldMappingUseCase,
) *ShadowV1DynamicFieldMappingService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1DynamicFieldMapping"), log.WithMessageKey("message"))
	return &ShadowV1DynamicFieldMappingService{
		log:                                l,
		shadowV1DynamicFieldMappingUseCase: shadowV1DynamicFieldMappingUseCase,
	}
}

type ShadowV1DynamicFieldMappingService struct {
	pb.UnimplementedDynamicFieldMappingServer
	log                                *log.Helper
	shadowV1DynamicFieldMappingUseCase *biz.ShadowV1DynamicFieldMappingUseCase
}

// UpsertDynamicFieldMapping 动态字段映射关系表-创建/更新一条数据
func (s *ShadowV1DynamicFieldMappingService) UpsertDynamicFieldMapping(ctx context.Context, req *pb.UpsertDynamicFieldMappingReq) (*pb.UpsertDynamicFieldMappingReply, error) {
	return s.shadowV1DynamicFieldMappingUseCase.UpsertDynamicFieldMapping(ctx, req)
}

// GetDynamicFieldMappingList 动态字段映射关系表-列表数据查询
func (s *ShadowV1DynamicFieldMappingService) GetDynamicFieldMappingList(ctx context.Context, req *pb.GetDynamicFieldMappingListReq) (*pb.GetDynamicFieldMappingListReply, error) {
	return s.shadowV1DynamicFieldMappingUseCase.GetDynamicFieldMappingList(ctx, req)
}
