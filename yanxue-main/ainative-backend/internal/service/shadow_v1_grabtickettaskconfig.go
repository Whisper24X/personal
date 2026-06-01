package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1GrabTicketTaskConfigService(
	logger log.Logger,
	shadowV1GrabTicketTaskConfigUseCase *biz.ShadowV1GrabTicketTaskConfigUseCase,
) *ShadowV1GrabTicketTaskConfigService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1GrabTicketTaskConfig"), log.WithMessageKey("message"))
	return &ShadowV1GrabTicketTaskConfigService{
		log:                                 l,
		shadowV1GrabTicketTaskConfigUseCase: shadowV1GrabTicketTaskConfigUseCase,
	}
}

type ShadowV1GrabTicketTaskConfigService struct {
	pb.UnimplementedGrabTicketTaskConfigServer
	log                                 *log.Helper
	shadowV1GrabTicketTaskConfigUseCase *biz.ShadowV1GrabTicketTaskConfigUseCase
}

// CreateGrabTicketTaskConfig 研学抢票任务配置表-创建一条数据
func (s *ShadowV1GrabTicketTaskConfigService) CreateGrabTicketTaskConfig(ctx context.Context, req *pb.CreateGrabTicketTaskConfigReq) (*pb.CreateGrabTicketTaskConfigReply, error) {
	return s.shadowV1GrabTicketTaskConfigUseCase.CreateGrabTicketTaskConfig(ctx, req)
}

// UpdateGrabTicketTaskConfig 研学抢票任务配置表-更新一条数据
func (s *ShadowV1GrabTicketTaskConfigService) UpdateGrabTicketTaskConfig(ctx context.Context, req *pb.UpdateGrabTicketTaskConfigReq) (*pb.UpdateGrabTicketTaskConfigReply, error) {
	return s.shadowV1GrabTicketTaskConfigUseCase.UpdateGrabTicketTaskConfig(ctx, req)
}

// DeleteGrabTicketTaskConfig 研学抢票任务配置表-删除单条数据
func (s *ShadowV1GrabTicketTaskConfigService) DeleteGrabTicketTaskConfig(ctx context.Context, req *pb.DeleteGrabTicketTaskConfigReq) (*pb.DeleteGrabTicketTaskConfigReply, error) {
	return s.shadowV1GrabTicketTaskConfigUseCase.DeleteGrabTicketTaskConfig(ctx, req)
}

// GetGrabTicketTaskConfigInfo 研学抢票任务配置表-单条数据查询
func (s *ShadowV1GrabTicketTaskConfigService) GetGrabTicketTaskConfigInfo(ctx context.Context, req *pb.GetGrabTicketTaskConfigInfoReq) (*pb.GetGrabTicketTaskConfigInfoReply, error) {
	return s.shadowV1GrabTicketTaskConfigUseCase.GetGrabTicketTaskConfigInfo(ctx, req)
}

// GetGrabTicketTaskConfigList 研学抢票任务配置表-列表数据查询
func (s *ShadowV1GrabTicketTaskConfigService) GetGrabTicketTaskConfigList(ctx context.Context, req *pb.GetGrabTicketTaskConfigListReq) (*pb.GetGrabTicketTaskConfigListReply, error) {
	return s.shadowV1GrabTicketTaskConfigUseCase.GetGrabTicketTaskConfigList(ctx, req)
}

// UpdateGrabTicketTaskConfigStatus 研学抢票任务配置表-更新状态
func (s *ShadowV1GrabTicketTaskConfigService) UpdateGrabTicketTaskConfigStatus(ctx context.Context, req *pb.UpdateGrabTicketTaskConfigStatusReq) (*pb.UpdateGrabTicketTaskConfigReply, error) {
	return s.shadowV1GrabTicketTaskConfigUseCase.UpdateGrabTicketTaskConfigStatus(ctx, req)
}
