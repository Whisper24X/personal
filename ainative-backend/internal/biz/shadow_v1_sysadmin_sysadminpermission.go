package biz

import (
	"context"

	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// SysAdminPermission 获取系统管理员的权限信息
// 包括角色信息、权限列表和部门信息
func (s *ShadowV1SysAdminUseCase) SysAdminPermission(ctx context.Context, req *pb.SysAdminPermissionReq) (*pb.SysAdminPermissionReply, error) {
	// 初始化返回结构
	resp := &pb.SysAdminPermissionReply{
		List: []*pb.SysPermissionInfo{},
	}
	adminId := meta.GetAdminID(ctx)
	// 查询用户的角色信息
	sysAdminRoles, err := s.sysAdminRoleRepo.FindMultiCacheByAdminID(ctx, adminId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(sysAdminRoles) == 0 {
		return resp, nil
	}
	sysAdminRoleIds := lo.Map(sysAdminRoles, func(item *yanxue_model.SysAdminRole, _ int) string {
		return item.RoleID
	})
	// 获取角色基本信息
	sysRoles, err := s.sysRoleRepo.FindMultiCacheByIDS(ctx, sysAdminRoleIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(sysRoles) == 0 {
		return resp, nil
	}
	sysAdminEnableRoleIds := []string{}
	for _, sysRole := range sysRoles {
		if sysRole.Status == int16(constant.SysStatusEnable) {
			sysAdminEnableRoleIds = append(sysAdminEnableRoleIds, sysRole.ID)
		}
	}
	// 获取角色对应的权限关联信息
	sysRoleToPermissions, err := s.sysRolePermissionRepo.FindMultiCacheByRoleIDS(ctx, sysAdminEnableRoleIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 提取权限ID列表
	sysPermissionIds := lo.Map(sysRoleToPermissions, func(item *yanxue_model.SysRolePermission, _ int) string {
		return item.PermissionID
	})
	sysPermissionIds = lo.Uniq(sysPermissionIds)
	// 获取权限详细信息
	sysPermissions, err := s.sysPermissionRepo.FindMultiCacheByIDS(ctx, sysPermissionIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 构建权限树形结构（只显示状态为1的权限）
	sysPermissionsTree := s.sysPermissionRepo.BuildTree(sysPermissions, false)
	resp.List = sysPermissionsTree
	return resp, nil
}
