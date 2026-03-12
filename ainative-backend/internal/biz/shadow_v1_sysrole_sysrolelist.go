package biz

import (
	"context"

	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// SysRoleList 角色-列表
func (s *ShadowV1SysRoleUseCase) SysRoleList(ctx context.Context, req *pb.SysRoleListReq) (*pb.SysRoleListResp, error) {
	resp := &pb.SysRoleListResp{
		Total: 0,
		List:  []*pb.SysRoleInfo{},
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
	if req.GetName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "name",
			Value: req.GetName(),
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
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
	sysRoles, p, err := s.sysRoleRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = int32(p.Total)
	roleIds := lo.Map(sysRoles, func(item *yanxue_model.SysRole, _ int) string {
		return item.ID
	})
	sysRoleToPermissions, err := s.sysRolePermissionRepo.FindMultiCacheByRoleIDS(ctx, roleIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	roleIdToPermissionIds := map[string][]string{}
	for _, sysRoleToPermission := range sysRoleToPermissions {
		roleIdToPermissionIds[sysRoleToPermission.RoleID] = append(roleIdToPermissionIds[sysRoleToPermission.RoleID], sysRoleToPermission.PermissionID)
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
			PermissionIds:  roleIdToPermissionIds[sysRole.ID],
		})
	}
	return resp, nil
}
