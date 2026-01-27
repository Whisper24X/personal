package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// AuthLoginXcx User-登录(小程序)
func (w *WechatV1UserUseCase) AuthLoginXcx(ctx context.Context, req *pb.AuthLoginXcxReq) (*pb.AuthLoginXcxReply, error) {
	resp := &pb.AuthLoginXcxReply{
		UserWxId: "",
		Token:    &pb.Token{},
	}
	// 调用小程序获取openid
	session, err := w.miniProgram.Auth.Session(ctx, req.GetCode())
	if err != nil {
		return nil, errorx.APIThirdErr.WithError(err).Err()
	}
	unionID := session.UnionID
	// 特殊处理，如果unionid为空，则使用openid
	if unionID == "" {
		unionID = session.OpenID
	}
	if unionID == "" {
		return nil, errorx.WxOpenIDGetErr.Err()
	}
	// 查询微信用户信息
	userWx, err := w.userWxRepo.FindOneCacheByUnionid(ctx, unionID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if userWx == nil || userWx.ID == "" {
		// 创建小程序信息
		userWx = &yanxue_model.UserWx{
			Unionid:           unionID,
			OffiaccountOpenID: "",
			OffiaccountFollow: false,
			MiniprogramOpenID: session.OpenID,
			Status:            int16(constant.StatusEnable),
		}
		err = w.userWxRepo.CreateOneCache(ctx, userWx)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
	} else {
		// 如果小程序openid为空，则更新小程序openid
		if userWx.MiniprogramOpenID == "" {
			oldUserWx := w.userWxRepo.DeepCopy(userWx)
			userWx.MiniprogramOpenID = session.OpenID
			err = w.userWxRepo.UpdateOneCache(ctx, userWx, oldUserWx)
			if err != nil {
				return nil, errorx.DataSQLErr.Err()
			}
		}
	}
	resp.UserWxId = userWx.ID
	// 查询用户信息
	users, err := w.userRepo.FindMultiCacheByUserWxID(ctx, userWx.ID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(users) == 0 {
		return resp, nil
	}
	user := users[0]
	// 用户被禁用 返回被锁定的报错
	if user.Status == int16(constant.UserStatusDisable) {
		return nil, errorx.AccountIsLocked.Err()
	}
	// 生成token
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
