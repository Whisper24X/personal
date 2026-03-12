package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// SysRoleSelect 角色-下拉选择列表
func (s *ShadowV1SysRoleUseCase) SysRoleSelect(ctx context.Context, req *pb.SysRoleSelectReq) (*pb.SysRoleSelectResp, error) {
	resp := &pb.SysRoleSelectResp{
		List: []*pb.SysRoleInfo{},
	}
	param := &condition.Req{
		Query: []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.ASC,
			},
		},
	}
	if req.GetDataPermission() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "dataPermission",
			Value: req.GetDataPermission(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	if req.GetStatus() != 0 {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "status",
			Value: req.GetStatus(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	sysRoles, _, err := s.sysRoleRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, sysRole := range sysRoles {
		resp.List = append(resp.List, &pb.SysRoleInfo{
			Id:             sysRole.ID,
			Name:           sysRole.Name,
			Remark:         sysRole.Remark,
			DataPermission: sysRole.DataPermission,
			Status:         int32(sysRole.Status),
			CreatedAt:      timeutil.RFC3339(sysRole.CreatedAt.Time),
			UpdatedAt:      timeutil.RFC3339(sysRole.UpdatedAt.Time),
		})
	}
	return resp, nil
}
