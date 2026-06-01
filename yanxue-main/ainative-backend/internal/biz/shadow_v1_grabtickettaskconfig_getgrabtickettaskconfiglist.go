package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetGrabTicketTaskConfigList 研学抢票任务配置表-列表数据查询
func (s *ShadowV1GrabTicketTaskConfigUseCase) GetGrabTicketTaskConfigList(ctx context.Context, req *pb.GetGrabTicketTaskConfigListReq) (*pb.GetGrabTicketTaskConfigListReply, error) {
	resp := &pb.GetGrabTicketTaskConfigListReply{}
	page := int32(1)
	pageSize := int32(100)
	if req.GetPage() != 0 {
		page = req.GetPage()
	}
	if req.GetPageSize() != 0 {
		pageSize = req.GetPageSize()
	}
	param := &condition.Req{
		Page:     page,
		PageSize: pageSize,
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "updatedAt",
				Order: condition.DESC,
			},
		},
	}
	param.Query = append(param.Query, &condition.QueryParam{
		Field: "siteConfigId",
		Value: req.SiteConfigId,
		Exp:   condition.EQ,
		Logic: condition.AND,
	})
	list, reply, err := s.grabTicketTaskConfigRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = reply.Total
	for _, item := range list {
		var userInfo []*pb.GrabTicketUserInfo
		err = jsonutil.Unmarshal(item.UserInfo, &userInfo)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		resp.List = append(resp.List, &pb.GrabTicketTaskConfigInfo{
			Id:                item.ID,
			SiteConfigId:      item.SiteConfigID,
			Session:           item.Session,
			Venue:             item.Venue,
			TimeSlot:          item.TimeSlot,
			Priority:          item.Priority,
			MaxRetries:        item.MaxRetries,
			RetryCount:        item.RetryCount,
			UserInfo:          userInfo,
			TicketType:        item.TicketType,
			VisitDate:         item.VisitDate,
			PreExecuteTimeGap: item.PreExecuteTimeGap,
			EnableRetry:       item.EnableRetry,
			RetryTimeGap:      item.RetryTimeGap,
			Status:            item.Status,
			TaskName:          item.TaskName,
			CreatedAt:         item.CreatedAt.Format(time.RFC3339),
			UpdatedAt:         item.UpdatedAt.Format(time.RFC3339),
		})
	}
	return resp, nil
}
