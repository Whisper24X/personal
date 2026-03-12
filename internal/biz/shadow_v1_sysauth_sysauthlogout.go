package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// SysAuthLogout Auth-退出
func (s *ShadowV1SysAuthUseCase) SysAuthLogout(ctx context.Context, req *pb.SysAuthLogoutReq) (*pb.SysAuthLogoutReply, error) {
	resp := &pb.SysAuthLogoutReply{}
	adminId := meta.GetAdminID(ctx)
	err := s.sysAdminRepo.ExpiredToken(ctx, []string{adminId})
	if err != nil {
		return nil, err
	}
	return resp, nil
}
