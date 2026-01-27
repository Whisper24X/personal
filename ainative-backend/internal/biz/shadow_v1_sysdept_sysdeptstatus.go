package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// SysDeptStatus 部门-修改权限状态
func (s *ShadowV1SysDeptUseCase) SysDeptStatus(ctx context.Context, req *pb.SysDeptStatusReq) (*pb.SysDeptStatusResp, error) {
	resp := &pb.SysDeptStatusResp{}
	sysDept, err := s.sysDeptRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if sysDept == nil || sysDept.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	oldSysDept := s.sysDeptRepo.DeepCopy(sysDept)
	sysDept.Status = int16(req.GetStatus())
	err = s.sysDeptRepo.UpdateOneCacheWithZero(ctx, sysDept, oldSysDept)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
