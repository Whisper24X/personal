package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateGrabTicketSiteConfig 研学抢票站点配置表-更新一条数据
func (s *ShadowV1GrabTicketSiteConfigUseCase) UpdateGrabTicketSiteConfig(ctx context.Context, req *pb.UpdateGrabTicketSiteConfigReq) (*pb.UpdateGrabTicketSiteConfigReply, error) {
	resp := &pb.UpdateGrabTicketSiteConfigReply{}
	adminId := meta.GetAdminID(ctx)
	grabTicketSiteConfig, err := s.grabTicketSiteConfigRepo.FindOneCacheByID(ctx, req.Id)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	oldGrabTicketSiteConfig := s.grabTicketSiteConfigRepo.DeepCopy(grabTicketSiteConfig)
	grabTicketSiteConfig.SiteDomain = req.SiteDomain
	grabTicketSiteConfig.TargetURL = req.TargetURL
	grabTicketSiteConfig.Status = req.Status
	grabTicketSiteConfig.TaskUserLimit = req.TaskUserLimit
	grabTicketSiteConfig.UpdatedBy = adminId
	err = s.grabTicketSiteConfigRepo.UpdateOneCache(ctx, grabTicketSiteConfig, oldGrabTicketSiteConfig)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
