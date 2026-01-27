package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// SysOperationLogList 操作日志-列表
func (s *ShadowV1SysOperationLogUseCase) SysOperationLogList(ctx context.Context, req *pb.SysOperationLogListReq) (*pb.SysOperationLogListResp, error) {
	resp := &pb.SysOperationLogListResp{
		Total: 0,
		List:  []*pb.SysOperationLogInfo{},
	}
	// 获取当前管理员ID
	adminId := meta.GetAdminID(ctx)
	// 查询当前管理员可以查看的用户ID
	canViewAdminIds, err := s.bffRepo.FindAdminCanViewAdminIds(ctx, adminId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	param := &condition.Req{
		Page:     req.GetPage(),
		PageSize: req.GetPageSize(),
		Query: []*condition.QueryParam{
			{
				Field: "adminId",
				Value: canViewAdminIds,
				Exp:   condition.IN,
				Logic: condition.AND,
			},
		},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}
	if req.GetAdminId() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "adminId",
			Value: req.GetAdminId(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	if req.GetIp() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "ip",
			Value: req.GetIp(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	if req.GetUri() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "uri",
			Value: req.GetUri(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	if req.GetStartDate() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "createdAt",
			Value: req.GetStartDate(),
			Exp:   condition.GTE,
			Logic: condition.AND,
		})
	}
	if req.GetEndDate() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "createdAt",
			Value: req.GetEndDate(),
			Exp:   condition.LTE,
			Logic: condition.AND,
		})
	}
	sysOperationLogList, p, err := s.SysOperationLogRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return nil, err
	}
	resp.Total = int32(p.Total)
	resp.List = make([]*pb.SysOperationLogInfo, 0)
	for _, v := range sysOperationLogList {
		resp.List = append(resp.List, &pb.SysOperationLogInfo{
			Id:        v.ID,
			AdminId:   v.AdminID,
			Username:  "",
			Ip:        v.IP,
			Uri:       v.URI,
			UriDesc:   "",
			Useragent: v.Useragent,
			Req:       v.Req.String(),
			Resp:      v.Resp.String(),
			CreatedAt: timeutil.RFC3339(v.CreatedAt.Time),
		})
	}
	return resp, nil
}
