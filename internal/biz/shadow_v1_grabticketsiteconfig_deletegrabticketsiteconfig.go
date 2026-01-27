package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// DeleteGrabTicketSiteConfig 研学抢票站点配置表-删除单条数据
func (s *ShadowV1GrabTicketSiteConfigUseCase) DeleteGrabTicketSiteConfig(ctx context.Context, req *pb.DeleteGrabTicketSiteConfigReq) (*pb.DeleteGrabTicketSiteConfigReply, error) {
	resp := &pb.DeleteGrabTicketSiteConfigReply{}
	err := s.grabTicketSiteConfigRepo.DeleteOneCacheByID(ctx, req.Id)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
