package biz

import (
	"context"

	"github.com/spf13/cast"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// SysAuthCheckToken Auth-检查token
func (s *ShadowV1SysAuthUseCase) SysAuthCheckToken(ctx context.Context, req *pb.SysAuthCheckTokenReq) (*pb.SysAuthCheckTokenReply, error) {
	resp := &pb.SysAuthCheckTokenReply{}
	claims, err := s.sysAdminRepo.CheckJwtTokenCheck(ctx, req.Token)
	if err != nil {
		return nil, err
	}
	resp.AdminId = cast.ToString(claims["adminId"])
	return resp, nil
}
