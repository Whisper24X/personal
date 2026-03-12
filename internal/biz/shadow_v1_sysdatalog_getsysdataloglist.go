package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetSysDataLogList 系统-数据日志-列表数据查询
func (s *ShadowV1SysDataLogUseCase) GetSysDataLogList(ctx context.Context, req *pb.GetSysDataLogListReq) (*pb.GetSysDataLogListReply, error) {
	resp := &pb.GetSysDataLogListReply{
		Total: 0,
		List:  []*pb.SysDataLogInfo{},
	}

	param := &condition.Req{
		Page:     req.GetPage(),
		PageSize: req.GetPageSize(),
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.ASC,
			},
		},
	}
	if req.GetModule() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "module",
			Value: req.GetModule(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	if req.GetOperatorId() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "operatorId",
			Value: req.GetOperatorId(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	sysDataLogs, p, err := s.sysDataLogRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = p.Total

	var operatorIds []string
	for _, log := range sysDataLogs {
		operatorIds = append(operatorIds, log.UpdatedBy)
	}
	adminMap, err := s.sysAdminRepo.AdminIdToName(ctx, operatorIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	for _, log := range sysDataLogs {
		resp.List = append(resp.List, &pb.SysDataLogInfo{
			Id:            log.ID,
			OperationType: log.OperationType,
			OperatorId:    log.OperatorID,
			OldData:       "", // 暂时不需要用到，后面有用到再加赋值逻辑
			NewData:       "",
			CreatedAt:     log.CreatedAt.Format(time.RFC3339),
			UpdatedBy:     log.UpdatedBy,
			UpdatedByName: adminMap[log.UpdatedBy],
			Module:        log.Module,
			Remark:        log.Remark,
		})
	}
	return resp, nil
}
