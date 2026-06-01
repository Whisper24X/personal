package biz

import (
	"context"

	"github.com/spf13/cast"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
)

// H5 本地联调：固定 dev token，development 环境放行，便于 H5 无法微信登录时访问所有页面
const (
	DevTokenLocal = "h5-dev-local-token"
	DevUserID     = "00000000-0000-0000-0000-000000000001"
)

// AuthCheckToken 用户-检查token
func (w *WechatV1UserUseCase) AuthCheckToken(ctx context.Context, req *pb.AuthCheckTokenReq) (*pb.AuthCheckTokenReply, error) {
	resp := &pb.AuthCheckTokenReply{}

	// development 环境：dev token 直接放行，用于 H5 本地联调（H5 无法 wx.login）
	if w.cfg.GetEnv() == conf.GO_ENV_development && req.Token == DevTokenLocal {
		resp.UserId = DevUserID
		return resp, nil
	}

	claims, err := w.userRepo.CheckJwtTokenCheck(ctx, req.Token)
	if err != nil {
		return nil, err
	}
	resp.UserId = cast.ToString(claims["uid"])
	return resp, nil
}
