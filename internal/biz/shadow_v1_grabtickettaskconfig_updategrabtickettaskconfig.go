package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// UpdateGrabTicketTaskConfig 研学抢票任务配置表-更新一条数据
func (s *ShadowV1GrabTicketTaskConfigUseCase) UpdateGrabTicketTaskConfig(ctx context.Context, req *pb.UpdateGrabTicketTaskConfigReq) (*pb.UpdateGrabTicketTaskConfigReply, error) {
	resp := &pb.UpdateGrabTicketTaskConfigReply{}
	adminId := meta.GetAdminID(ctx)
	grabTicketTaskConfig, err := s.grabTicketTaskConfigRepo.FindOneCacheByID(ctx, req.Id)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	userInfoJson, err := jsonutil.Marshal(req.UserInfo)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}

	oldGrabTicketTaskConfig := s.grabTicketTaskConfigRepo.DeepCopy(grabTicketTaskConfig)
	grabTicketTaskConfig.Session = req.Session
	grabTicketTaskConfig.Venue = req.Venue
	grabTicketTaskConfig.TimeSlot = req.TimeSlot
	grabTicketTaskConfig.Priority = req.Priority
	grabTicketTaskConfig.MaxRetries = req.MaxRetries
	grabTicketTaskConfig.RetryCount = req.RetryCount
	grabTicketTaskConfig.UserInfo = userInfoJson
	grabTicketTaskConfig.TicketType = req.TicketType
	grabTicketTaskConfig.VisitDate = req.VisitDate
	grabTicketTaskConfig.PreExecuteTimeGap = req.PreExecuteTimeGap
	grabTicketTaskConfig.EnableRetry = req.EnableRetry
	grabTicketTaskConfig.RetryTimeGap = req.RetryTimeGap
	grabTicketTaskConfig.Status = req.Status
	grabTicketTaskConfig.UpdatedBy = adminId
	grabTicketTaskConfig.TaskName = req.TaskName
	err = s.grabTicketTaskConfigRepo.UpdateOneCache(ctx, grabTicketTaskConfig, oldGrabTicketTaskConfig)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
