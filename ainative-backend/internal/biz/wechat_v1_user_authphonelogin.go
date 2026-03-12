package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
)

// AuthPhoneLogin User-手机号-登录
func (w *WechatV1UserUseCase) AuthPhoneLogin(ctx context.Context, req *pb.AuthPhoneLoginReq) (*pb.AuthPhoneLoginReply, error) {
	resp := &pb.AuthPhoneLoginReply{
		Token: &pb.Token{},
	}
	// 验证短信验证码
	phone, userWxId, err := w.userRepo.CheckSmsCode(ctx, req.GetSmsCodeId(), req.GetSmsCode())
	if err != nil {
		return nil, err
	}
	// 手机号加密
	ph, err := cryptutil.YcPhoneEncrypt(phone)
	if err != nil {
		return nil, errorx.DataFormattingError.Err()
	}
	// 查询用户是否存在
	user, err := w.userRepo.FindOneCacheByPh(ctx, ph)
	if err != nil {
		return nil, errorx.DataSQLErr.Err()
	}
	if user == nil || user.ID == "" {
		// 创建用户
		user = &yanxue_model.User{
			Ph:       ph,
			UserWxID: userWxId,
			Nickname: w.userRepo.GetDefaultNickName(phone),
			Avatar:   "",
			Status:   1,
		}
		err = w.userRepo.CreateOneCache(ctx, user)
		if err != nil {
			return nil, errorx.DataSQLErr.Err()
		}
	} else {
		// 如果用户存在
		if user.UserWxID != "" {
			return nil, errorx.WxUserPhoneAlreadyBound.Err()
		}
		// 更新用户
		oldUser := w.userRepo.DeepCopy(user)
		user.UserWxID = userWxId
		err = w.userRepo.UpdateOneCache(ctx, user, oldUser)
		if err != nil {
			return nil, errorx.DataSQLErr.Err()
		}
	}

	// 颁发token
	kv := make(map[string]interface{})
	kv["uid"] = user.ID
	token, err := w.userRepo.GenerateJwTToken(ctx, kv)
	if err != nil {
		return nil, errorx.TokenGenerationFailed.WithError(err).Err()
	}
	resp.Token = &pb.Token{
		Token:     token.Token,
		ExpiredAt: int32(token.ExpiredAt),
		RefreshAt: int32(token.RefreshAt),
	}
	return resp, nil
}
