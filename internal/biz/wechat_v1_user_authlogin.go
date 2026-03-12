package biz

import (
	"context"

	"github.com/spf13/cast"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// AuthLogin 用户-登录
func (w *WechatV1UserUseCase) AuthLogin(ctx context.Context, req *pb.AuthLoginReq) (*pb.AuthLoginReply, error) {
	resp := &pb.AuthLoginReply{
		UserWxId: "",
		Token:    &pb.Token{},
	}
	// 获取微信用户信息
	tokenResponse, err := w.officialAccount.OAuth.TokenFromCode(req.GetCode())
	if err != nil {
		return nil, errorx.WxServiceErr.WithError(err).Err()
	}
	accessToken := (*tokenResponse)["access_token"].(string)
	unionID := cast.ToString((*tokenResponse)["unionid"])
	openID := cast.ToString((*tokenResponse)["openid"])
	// 特殊处理，如果unionid为空，则使用openid
	if unionID == "" {
		unionID = openID
	}
	// 如果unionid为空，则返回错误
	if unionID == "" {
		return nil, errorx.WxOpenIDGetErr.Err()
	}
	// 查询用户是否存在
	userWx, err := w.userWxRepo.FindOneCacheByUnionid(ctx, unionID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	wxUserInfo, err := w.officialAccount.OAuth.UserFromToken(accessToken, openID)
	if err != nil {
		return nil, errorx.WxServiceErr.WithError(err).Err()
	}
	nickname := wxUserInfo.GetNickname()
	sex := cast.ToInt16(wxUserInfo.GetAttribute("sex", 0))
	province := cast.ToString(wxUserInfo.GetAttribute("province", ""))
	city := cast.ToString(wxUserInfo.GetAttribute("city", ""))
	country := cast.ToString(wxUserInfo.GetAttribute("country", ""))
	headimgurl := wxUserInfo.GetAvatar()
	// 创建用户
	if userWx == nil || userWx.ID == "" {
		userWx = &yanxue_model.UserWx{
			Unionid:           unionID,
			OffiaccountOpenID: openID,
			OffiaccountFollow: false,
			Status:            1,
			Nickname:          nickname,
			Sex:               sex,
			Province:          province,
			City:              city,
			Country:           country,
			Headimgurl:        headimgurl,
		}
		err = w.userWxRepo.CreateOneCache(ctx, userWx)
		if err != nil {
			return nil, errorx.DataSQLErr.Err()
		}
	} else {
		// 数据有变化才更新
		if !(userWx.Nickname == nickname && userWx.Sex == sex && userWx.Province == province && userWx.City == city && userWx.Country == country && userWx.Headimgurl == headimgurl) {
			oldUserWx := w.userWxRepo.DeepCopy(userWx)
			userWx.Nickname = nickname
			userWx.Sex = sex
			userWx.Province = province
			userWx.City = city
			userWx.Country = country
			userWx.Headimgurl = headimgurl
			err = w.userWxRepo.UpdateOneCacheWithZero(ctx, userWx, oldUserWx)
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
