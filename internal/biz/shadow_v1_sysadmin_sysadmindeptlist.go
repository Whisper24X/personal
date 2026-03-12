package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// SysAdminDeptList 管理用户-管理员的部门数据
func (s *ShadowV1SysAdminUseCase) SysAdminDeptList(ctx context.Context, req *pb.SysAdminDeptListReq) (*pb.SysAdminDeptListReply, error) {
	resp := &pb.SysAdminDeptListReply{
		List: []*pb.SysDeptInfo{},
	}
	adminId := meta.GetAdminID(ctx)
	// 获取管理员部门数据
	deptIds, err := s.bffRepo.FindAdminCanViewDeptIds(ctx, adminId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询整个部门树形结构，并只展示在路径上的树形结构，并把 deptIds 中的部门设置为可选
	deptTree, err := s.sysDeptRepo.BuildCanViewTreeWithSelect(ctx, deptIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.List = deptTree
	return resp, nil
}
