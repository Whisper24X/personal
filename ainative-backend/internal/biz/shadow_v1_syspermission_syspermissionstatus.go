package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// SysPermissionStatus 功能权限-修改权限状态
func (s *ShadowV1SysPermissionUseCase) SysPermissionStatus(ctx context.Context, req *pb.SysPermissionStatusReq) (*pb.SysPermissionStatusResp, error) {
	resp := &pb.SysPermissionStatusResp{}
	sysPermission, err := s.sysPermissionRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if sysPermission == nil || sysPermission.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	oldSysPermission := s.sysPermissionRepo.DeepCopy(sysPermission)
	sysPermission.Status = int16(req.GetStatus())
	err = s.sysPermissionRepo.UpdateOneCacheWithZero(ctx, sysPermission, oldSysPermission)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
