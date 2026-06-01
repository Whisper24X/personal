package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// SysAdminInfo 管理用户-单个管理员信息
func (s *ShadowV1SysAdminUseCase) SysAdminInfo(ctx context.Context, req *pb.SysAdminInfoReq) (*pb.SysAdminInfoReply, error) {
	resp := &pb.SysAdminInfoReply{
		Info: &pb.SysAdminInfo{
			Id:          "",
			Phone:       "",
			Nickname:    "",
			Avatar:      "",
			Status:      0,
			IsChangePwd: false,
			CreatedAt:   "",
			UpdatedAt:   "",
			RoleList:    []*pb.SysAdminRoleInfo{},
			DeptList:    []*pb.SysAdminDeptInfo{},
		},
	}
	adminId := meta.GetAdminID(ctx)
	sysAdmin, err := s.sysAdminRepo.FindOneCacheByID(ctx, adminId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if sysAdmin == nil || sysAdmin.ID == "" {
		return nil, errorx.AccountNotExist.Err()
	}
	sysAdmins, err := s.bffRepo.FindMultiAdminsRoleAndDept(ctx, []*yanxue_model.SysAdmin{sysAdmin})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(sysAdmins) > 0 {
		resp.Info = sysAdmins[0]
	}
	return resp, nil
}
