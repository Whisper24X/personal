package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_dao"
)

// SysRoleDel 角色-删除角色
func (s *ShadowV1SysRoleUseCase) SysRoleDel(ctx context.Context, req *pb.SysRoleDelReq) (*pb.SysRoleDelResp, error) {
	resp := &pb.SysRoleDelResp{}
	// 查询是否有管理员关联
	sysAdminRoles, err := s.sysAdminRoleRepo.FindMultiCacheByRoleID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(sysAdminRoles) > 0 {
		return nil, errorx.RoleHasAdminCanNotDel.Err()
	}
	err = s.commonRepo.Transaction(ctx, func(tx *yanxue_dao.Query) error {
		// 删除角色
		err := s.sysRoleRepo.DeleteOneCacheByIDTx(ctx, tx, req.GetId())
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		// 删除角色与权限关联
		err = s.sysRolePermissionRepo.DeleteMultiByRoleIDTx(ctx, tx, req.GetId())
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		// 删除角色与用户关联
		err = s.sysAdminRoleRepo.DeleteMultiByRoleIDTx(ctx, tx, req.GetId())
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return resp, nil
}
