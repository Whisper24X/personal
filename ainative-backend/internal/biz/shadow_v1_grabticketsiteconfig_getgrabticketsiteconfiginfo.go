package biz

import (
	"context"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetGrabTicketSiteConfigInfo 研学抢票站点配置表-单条数据查询
func (s *ShadowV1GrabTicketSiteConfigUseCase) GetGrabTicketSiteConfigInfo(ctx context.Context, req *pb.GetGrabTicketSiteConfigInfoReq) (*pb.GetGrabTicketSiteConfigInfoReply, error) {
	resp := &pb.GetGrabTicketSiteConfigInfoReply{}
	grabTicketSiteConfig, err := s.grabTicketSiteConfigRepo.FindOneCacheByID(ctx, req.Id)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Info = &pb.GrabTicketSiteConfigInfo{
		Id:            grabTicketSiteConfig.ID,
		SiteName:      grabTicketSiteConfig.SiteName,
		SiteDomain:    grabTicketSiteConfig.SiteDomain,
		TargetURL:     grabTicketSiteConfig.TargetURL,
		Status:        grabTicketSiteConfig.Status,
		CreatedAt:     grabTicketSiteConfig.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     grabTicketSiteConfig.UpdatedAt.Format(time.RFC3339),
		TaskUserLimit: grabTicketSiteConfig.TaskUserLimit,
	}
	return resp, nil
}
