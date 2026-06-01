package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// UnbindUserWx 用户-解绑微信
func (s *ShadowV1UserUseCase) UnbindUserWx(ctx context.Context, req *pb.UnbindUserWxReq) (*pb.UnbindUserWxReply, error) {
	resp := &pb.UnbindUserWxReply{}
	userInfo, err := s.userRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	if userInfo == nil || userInfo.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	oldUserInfo := s.userRepo.DeepCopy(userInfo)
	userInfo.UserWxID = ""
	err = s.userRepo.UpdateOneCacheWithZero(ctx, userInfo, oldUserInfo)
	if err != nil {
		return nil, err
	}
	// 如果用户被禁用 则清除 token
	err = s.userRepo.ExpiredToken(ctx, []string{userInfo.ID})
	if err != nil {
		return nil, err
	}
	return resp, nil
}
