package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// SysPermissionDel 功能权限-删除
func (s *ShadowV1SysPermissionUseCase) SysPermissionDel(ctx context.Context, req *pb.SysPermissionDelReq) (*pb.SysPermissionDelResp, error) {
	resp := &pb.SysPermissionDelResp{}
	// 查询当前权限节点及其所有子节点
	permissionIds, err := s.sysPermissionRepo.FindPermissionCurrentAndChildrenIds(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 删除数据
	err = s.sysPermissionRepo.DeleteMultiCacheByIDS(ctx, permissionIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 删除角色权限关联
	err = s.sysRoleToPermissionRepo.DeleteMultiCacheByPermissionIDS(ctx, permissionIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
