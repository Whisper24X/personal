package biz

import (
	"context"

	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// SysRoleStatus 角色-修改状态
func (s *ShadowV1SysRoleUseCase) SysRoleStatus(ctx context.Context, req *pb.SysRoleStatusReq) (*pb.SysRoleStatusResp, error) {
	resp := &pb.SysRoleStatusResp{}
	sysRole, err := s.sysRoleRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if sysRole == nil || sysRole.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	oldSysRole := s.sysRoleRepo.DeepCopy(sysRole)
	sysRole.Status = int16(req.GetStatus())
	err = s.sysRoleRepo.UpdateOneCacheWithZero(ctx, sysRole, oldSysRole)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询该角色的管理员
	sysAdminRoles, err := s.sysAdminRoleRepo.FindMultiCacheByRoleID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 强制退出
	adminIds := lo.Map(sysAdminRoles, func(item *yanxue_model.SysAdminRole, _ int) string {
		return item.AdminID
	})
	err = s.sysAdminRepo.ExpiredToken(ctx, adminIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
