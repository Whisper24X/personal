package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// DeleteGrabTicketTaskConfig 研学抢票任务配置表-删除单条数据
func (s *ShadowV1GrabTicketTaskConfigUseCase) DeleteGrabTicketTaskConfig(ctx context.Context, req *pb.DeleteGrabTicketTaskConfigReq) (*pb.DeleteGrabTicketTaskConfigReply, error) {
	resp := &pb.DeleteGrabTicketTaskConfigReply{}
	err := s.grabTicketTaskConfigRepo.DeleteOneCacheByID(ctx, req.Id)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
