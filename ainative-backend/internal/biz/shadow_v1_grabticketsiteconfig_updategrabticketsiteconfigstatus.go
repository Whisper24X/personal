package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateGrabTicketSiteConfigStatus 研学抢票站点配置表-更新状态
func (s *ShadowV1GrabTicketSiteConfigUseCase) UpdateGrabTicketSiteConfigStatus(ctx context.Context, req *pb.UpdateGrabTicketSiteConfigStatusReq) (*pb.UpdateGrabTicketSiteConfigStatusReply, error) {
	resp := &pb.UpdateGrabTicketSiteConfigStatusReply{}
	adminId := meta.GetAdminID(ctx)
	grabTicketSiteConfig, err := s.grabTicketSiteConfigRepo.FindOneCacheByID(ctx, req.Id)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	oldGrabTicketSiteConfig := s.grabTicketSiteConfigRepo.DeepCopy(grabTicketSiteConfig)
	grabTicketSiteConfig.Status = req.Status
	grabTicketSiteConfig.UpdatedBy = adminId
	err = s.grabTicketSiteConfigRepo.UpdateOneCache(ctx, grabTicketSiteConfig, oldGrabTicketSiteConfig)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
