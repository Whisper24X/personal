package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// SysDeptList 部门-列表
func (s *ShadowV1SysDeptUseCase) SysDeptList(ctx context.Context, req *pb.SysDeptListReq) (*pb.SysDeptListResp, error) {
	resp := &pb.SysDeptListResp{
		List: []*pb.SysDeptInfo{},
	}
	sysDepts, _, err := s.sysDeptRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 转为树形结构
	resp.List = s.sysDeptRepo.BuildTree(sysDepts, true, false)
	return resp, nil
}
