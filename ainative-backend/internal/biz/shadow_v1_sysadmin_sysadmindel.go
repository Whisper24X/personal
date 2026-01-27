package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_dao"
)

// SysAdminDel 管理用户-删除管理员
func (s *ShadowV1SysAdminUseCase) SysAdminDel(ctx context.Context, req *pb.SysAdminDelReq) (*pb.SysAdminDelReply, error) {
	resp := &pb.SysAdminDelReply{}
	err := s.commonRepo.Transaction(ctx, func(tx *yanxue_dao.Query) error {
		// 删除管理员
		err := s.sysAdminRepo.DeleteOneCacheByIDTx(ctx, tx, req.GetId())
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		// 删除关联的角色
		err = s.sysAdminRoleRepo.DeleteMultiCacheByAdminIDTx(ctx, tx, req.GetId())
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		// 删除关联的部门
		err = s.sysAdminDeptRepo.DeleteMultiCacheByAdminIDTx(ctx, tx, req.GetId())
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		// 强制退出
		_ = s.sysAdminRepo.ExpiredToken(ctx, []string{req.GetId()})
		return nil
	})
	if err != nil {
		return nil, err
	}
	return resp, nil
}
