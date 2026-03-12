package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_dao"
)

// SysDeptDel 部门-删除
func (s *ShadowV1SysDeptUseCase) SysDeptDel(ctx context.Context, req *pb.SysDeptDelReq) (*pb.SysDeptDelResp, error) {
	resp := &pb.SysDeptDelResp{}
	ids, err := s.sysDeptRepo.FindDeptCurrentAndChildrenIds(ctx, []string{req.GetId()})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询是否有管理员关联
	sysAdminDepts, err := s.sysAdminDeptRepo.FindMultiCacheByDeptIDS(ctx, ids)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(sysAdminDepts) > 0 {
		return nil, errorx.DeptHasAdminCanNotDel.Err()
	}
	err = s.commonRepo.Transaction(ctx, func(tx *yanxue_dao.Query) error {
		// 删除部门
		err = s.sysDeptRepo.DeleteMultiCacheByIDS(ctx, ids)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		// 删除关联的管理员
		err = s.sysAdminDeptRepo.DeleteMultiCacheByDeptIDS(ctx, ids)
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
