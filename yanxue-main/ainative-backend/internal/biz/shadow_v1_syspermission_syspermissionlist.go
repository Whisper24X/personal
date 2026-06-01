package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// SysPermissionList 功能权限-列表
func (s *ShadowV1SysPermissionUseCase) SysPermissionList(ctx context.Context, req *pb.SysPermissionListReq) (*pb.SysPermissionListResp, error) {
	resp := &pb.SysPermissionListResp{
		List: []*pb.SysPermissionInfo{},
	}
	// 查询全部权限
	sysPermissions, _, err := s.sysPermissionRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 根据 id，pid 转为树状结构
	resp.List = s.sysPermissionRepo.BuildTree(sysPermissions, true)
	return resp, nil
}
