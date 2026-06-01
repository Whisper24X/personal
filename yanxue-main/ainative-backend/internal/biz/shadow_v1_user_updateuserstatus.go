package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// UpdateUserStatus 用户-修改状态
func (s *ShadowV1UserUseCase) UpdateUserStatus(ctx context.Context, req *pb.UpdateUserStatusReq) (*pb.UpdateUserStatusReply, error) {
	resp := &pb.UpdateUserStatusReply{}
	user, err := s.userRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if user == nil || user.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	oldUser := s.userRepo.DeepCopy(user)
	oldUser.Status = int16(req.GetStatus())
	err = s.userRepo.UpdateOneCache(ctx, oldUser, user)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 如果用户被禁用 则清除 token
	if req.GetStatus() == int32(constant.UserStatusDisable) {
		err = s.userRepo.ExpiredToken(ctx, []string{user.ID})
		if err != nil {
			return nil, err
		}
	}
	return resp, nil
}
