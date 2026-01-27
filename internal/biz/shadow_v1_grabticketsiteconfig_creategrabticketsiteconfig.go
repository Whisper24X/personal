package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// CreateGrabTicketSiteConfig 研学抢票站点配置表-创建一条数据
func (s *ShadowV1GrabTicketSiteConfigUseCase) CreateGrabTicketSiteConfig(ctx context.Context, req *pb.CreateGrabTicketSiteConfigReq) (*pb.CreateGrabTicketSiteConfigReply, error) {
	resp := &pb.CreateGrabTicketSiteConfigReply{}
	adminId := meta.GetAdminID(ctx)
	grabTicketSiteConfig := &yanxue_model.GrabTicketSiteConfig{
		SiteName:      req.SiteName,
		SiteDomain:    req.SiteDomain,
		TargetURL:     req.TargetURL,
		Status:        req.Status,
		TaskUserLimit: req.TaskUserLimit,
		UpdatedBy:     adminId,
	}
	err := s.grabTicketSiteConfigRepo.CreateOneCache(ctx, grabTicketSiteConfig)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Id = grabTicketSiteConfig.ID
	return resp, nil
}
