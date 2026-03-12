package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// SysAdminStatus 管理用户-修改状态
func (s *ShadowV1SysAdminUseCase) SysAdminStatus(ctx context.Context, req *pb.SysAdminStatusReq) (*pb.SysAdminStatusReply, error) {
	resp := &pb.SysAdminStatusReply{}
	sysAdmin, err := s.sysAdminRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if sysAdmin == nil || sysAdmin.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	oldSysAdmin := s.sysAdminRepo.DeepCopy(sysAdmin)
	sysAdmin.Status = int16(req.GetStatus())
	err = s.sysAdminRepo.UpdateOneCacheWithZero(ctx, sysAdmin, oldSysAdmin)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 强制退出
	_ = s.sysAdminRepo.ExpiredToken(ctx, []string{sysAdmin.ID})
	return resp, nil
}
