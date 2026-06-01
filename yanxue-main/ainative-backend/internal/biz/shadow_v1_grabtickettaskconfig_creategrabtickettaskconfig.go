package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// CreateGrabTicketTaskConfig 研学抢票任务配置表-创建一条数据
func (s *ShadowV1GrabTicketTaskConfigUseCase) CreateGrabTicketTaskConfig(ctx context.Context, req *pb.CreateGrabTicketTaskConfigReq) (*pb.CreateGrabTicketTaskConfigReply, error) {
	resp := &pb.CreateGrabTicketTaskConfigReply{}
	adminId := meta.GetAdminID(ctx)
	userInfoJson, err := jsonutil.Marshal(req.UserInfo)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	grabTicketTaskConfig := &yanxue_model.GrabTicketTaskConfig{
		SiteConfigID:      req.SiteConfigId,
		Session:           req.Session,
		Venue:             req.Venue,
		TimeSlot:          req.TimeSlot,
		Priority:          req.Priority,
		MaxRetries:        req.MaxRetries,
		RetryCount:        req.RetryCount,
		UserInfo:          userInfoJson,
		TicketType:        req.TicketType,
		VisitDate:         req.VisitDate,
		PreExecuteTimeGap: req.PreExecuteTimeGap,
		EnableRetry:       req.EnableRetry,
		RetryTimeGap:      req.RetryTimeGap,
		Status:            req.Status,
		TaskName:          req.TaskName,
		UpdatedBy:         adminId,
	}
	err = s.grabTicketTaskConfigRepo.CreateOneCache(ctx, grabTicketTaskConfig)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Id = grabTicketTaskConfig.ID
	return resp, nil
}
