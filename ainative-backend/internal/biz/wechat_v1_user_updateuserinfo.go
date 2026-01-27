package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateUserInfo User-更新用户信息
func (w *WechatV1UserUseCase) UpdateUserInfo(ctx context.Context, req *pb.UpdateUserInfoReq) (*pb.UpdateUserInfoReply, error) {
	resp := &pb.UpdateUserInfoReply{}
	userId := meta.GetUserID(ctx)
	user, err := w.userRepo.FindOneCacheByID(ctx, userId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if user == nil || user.ID == "" {
		return resp, errorx.DataRecordNotFound.Err()
	}
	oldUser := w.userRepo.DeepCopy(user)
	user.Nickname = req.GetNickname()
	user.Avatar = req.GetAvatar()
	user.Address = req.GetAddress()
	user.Birthday = req.GetBirthday()
	err = w.userRepo.UpdateOneCache(ctx, user, oldUser)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
