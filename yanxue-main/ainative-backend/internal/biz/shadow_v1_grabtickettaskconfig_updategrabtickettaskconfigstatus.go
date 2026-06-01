package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateGrabTicketTaskConfigStatus 研学抢票任务配置表-更新状态
func (s *ShadowV1GrabTicketTaskConfigUseCase) UpdateGrabTicketTaskConfigStatus(ctx context.Context, req *pb.UpdateGrabTicketTaskConfigStatusReq) (*pb.UpdateGrabTicketTaskConfigReply, error) {
	resp := &pb.UpdateGrabTicketTaskConfigReply{}
	adminId := meta.GetAdminID(ctx)
	grabTicketTaskConfig, err := s.grabTicketTaskConfigRepo.FindOneCacheByID(ctx, req.Id)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	oldGrabTicketTaskConfig := s.grabTicketTaskConfigRepo.DeepCopy(grabTicketTaskConfig)
	grabTicketTaskConfig.Status = req.Status
	grabTicketTaskConfig.UpdatedBy = adminId
	err = s.grabTicketTaskConfigRepo.UpdateOneCache(ctx, grabTicketTaskConfig, oldGrabTicketTaskConfig)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
