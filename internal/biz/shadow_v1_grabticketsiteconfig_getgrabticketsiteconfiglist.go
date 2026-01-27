package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetGrabTicketSiteConfigList 研学抢票站点配置表-列表数据查询
func (s *ShadowV1GrabTicketSiteConfigUseCase) GetGrabTicketSiteConfigList(ctx context.Context, req *pb.GetGrabTicketSiteConfigListReq) (*pb.GetGrabTicketSiteConfigListReply, error) {
	resp := &pb.GetGrabTicketSiteConfigListReply{}
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
	list, reply, err := s.grabTicketSiteConfigRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = reply.Total
	for _, item := range list {
		resp.List = append(resp.List, &pb.GrabTicketSiteConfigInfo{
			Id:            item.ID,
			SiteName:      item.SiteName,
			SiteDomain:    item.SiteDomain,
			TargetURL:     item.TargetURL,
			Status:        item.Status,
			CreatedAt:     item.CreatedAt.Format(time.RFC3339),
			UpdatedAt:     item.UpdatedAt.Format(time.RFC3339),
			TaskUserLimit: item.TaskUserLimit,
		})
	}
	return resp, nil
}
