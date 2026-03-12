package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/transport/http"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1GrabTicketSiteConfigService(
	logger log.Logger,
	shadowV1GrabTicketSiteConfigUseCase *biz.ShadowV1GrabTicketSiteConfigUseCase,
) *ShadowV1GrabTicketSiteConfigService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1GrabTicketSiteConfig"), log.WithMessageKey("message"))
	return &ShadowV1GrabTicketSiteConfigService{
		log:                                 l,
		shadowV1GrabTicketSiteConfigUseCase: shadowV1GrabTicketSiteConfigUseCase,
	}
}

type ShadowV1GrabTicketSiteConfigService struct {
	pb.UnimplementedGrabTicketSiteConfigServer
	log                                 *log.Helper
	shadowV1GrabTicketSiteConfigUseCase *biz.ShadowV1GrabTicketSiteConfigUseCase
}

// CreateGrabTicketSiteConfig 研学抢票站点配置表-创建一条数据
func (s *ShadowV1GrabTicketSiteConfigService) CreateGrabTicketSiteConfig(ctx context.Context, req *pb.CreateGrabTicketSiteConfigReq) (*pb.CreateGrabTicketSiteConfigReply, error) {
	return s.shadowV1GrabTicketSiteConfigUseCase.CreateGrabTicketSiteConfig(ctx, req)
}

// UpdateGrabTicketSiteConfig 研学抢票站点配置表-更新一条数据
func (s *ShadowV1GrabTicketSiteConfigService) UpdateGrabTicketSiteConfig(ctx context.Context, req *pb.UpdateGrabTicketSiteConfigReq) (*pb.UpdateGrabTicketSiteConfigReply, error) {
	return s.shadowV1GrabTicketSiteConfigUseCase.UpdateGrabTicketSiteConfig(ctx, req)
}

// DeleteGrabTicketSiteConfig 研学抢票站点配置表-删除单条数据
func (s *ShadowV1GrabTicketSiteConfigService) DeleteGrabTicketSiteConfig(ctx context.Context, req *pb.DeleteGrabTicketSiteConfigReq) (*pb.DeleteGrabTicketSiteConfigReply, error) {
	return s.shadowV1GrabTicketSiteConfigUseCase.DeleteGrabTicketSiteConfig(ctx, req)
}

// GetGrabTicketSiteConfigInfo 研学抢票站点配置表-单条数据查询
func (s *ShadowV1GrabTicketSiteConfigService) GetGrabTicketSiteConfigInfo(ctx context.Context, req *pb.GetGrabTicketSiteConfigInfoReq) (*pb.GetGrabTicketSiteConfigInfoReply, error) {
	return s.shadowV1GrabTicketSiteConfigUseCase.GetGrabTicketSiteConfigInfo(ctx, req)
}

// GetGrabTicketSiteConfigList 研学抢票站点配置表-列表数据查询
func (s *ShadowV1GrabTicketSiteConfigService) GetGrabTicketSiteConfigList(ctx context.Context, req *pb.GetGrabTicketSiteConfigListReq) (*pb.GetGrabTicketSiteConfigListReply, error) {
	return s.shadowV1GrabTicketSiteConfigUseCase.GetGrabTicketSiteConfigList(ctx, req)
}

// UpdateGrabTicketSiteConfigStatus 研学抢票站点配置表-更新状态
func (s *ShadowV1GrabTicketSiteConfigService) UpdateGrabTicketSiteConfigStatus(ctx context.Context, req *pb.UpdateGrabTicketSiteConfigStatusReq) (*pb.UpdateGrabTicketSiteConfigStatusReply, error) {
	return s.shadowV1GrabTicketSiteConfigUseCase.UpdateGrabTicketSiteConfigStatus(ctx, req)
}

// NotifyScanCodeForGrabTicket 研学抢票站点配置表-通知扫码
func (s *ShadowV1GrabTicketSiteConfigService) NotifyScanCodeForGrabTicket(wr http.ResponseWriter, r *http.Request) {
	s.shadowV1GrabTicketSiteConfigUseCase.NotifyScanCodeForGrabTicket(wr, r)
}
