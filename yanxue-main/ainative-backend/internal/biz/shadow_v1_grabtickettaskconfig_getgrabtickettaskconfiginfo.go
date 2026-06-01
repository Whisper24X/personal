package biz

import (
	"context"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetGrabTicketTaskConfigInfo 研学抢票任务配置表-单条数据查询
func (s *ShadowV1GrabTicketTaskConfigUseCase) GetGrabTicketTaskConfigInfo(ctx context.Context, req *pb.GetGrabTicketTaskConfigInfoReq) (*pb.GetGrabTicketTaskConfigInfoReply, error) {
	resp := &pb.GetGrabTicketTaskConfigInfoReply{}
	grabTicketTaskConfig, err := s.grabTicketTaskConfigRepo.FindOneCacheByID(ctx, req.Id)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	var userInfo []*pb.GrabTicketUserInfo
	err = jsonutil.Unmarshal(grabTicketTaskConfig.UserInfo, &userInfo)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	resp.Info = &pb.GrabTicketTaskConfigInfo{
		Id:                grabTicketTaskConfig.ID,
		SiteConfigId:      grabTicketTaskConfig.SiteConfigID,
		Session:           grabTicketTaskConfig.Session,
		Venue:             grabTicketTaskConfig.Venue,
		TimeSlot:          grabTicketTaskConfig.TimeSlot,
		Priority:          grabTicketTaskConfig.Priority,
		MaxRetries:        grabTicketTaskConfig.MaxRetries,
		RetryCount:        grabTicketTaskConfig.RetryCount,
		UserInfo:          userInfo,
		TicketType:        grabTicketTaskConfig.TicketType,
		VisitDate:         grabTicketTaskConfig.VisitDate,
		PreExecuteTimeGap: grabTicketTaskConfig.PreExecuteTimeGap,
		EnableRetry:       grabTicketTaskConfig.EnableRetry,
		RetryTimeGap:      grabTicketTaskConfig.RetryTimeGap,
		Status:            grabTicketTaskConfig.Status,
		TaskName:          grabTicketTaskConfig.TaskName,
		CreatedAt:         grabTicketTaskConfig.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         grabTicketTaskConfig.UpdatedAt.Format(time.RFC3339),
	}
	return resp, nil
}
