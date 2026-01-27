package biz

import (
	"context"

	"github.com/spf13/cast"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
)

// AuthCheckToken 用户-检查token
func (w *WechatV1UserUseCase) AuthCheckToken(ctx context.Context, req *pb.AuthCheckTokenReq) (*pb.AuthCheckTokenReply, error) {
	resp := &pb.AuthCheckTokenReply{}
	claims, err := w.userRepo.CheckJwtTokenCheck(ctx, req.Token)
	if err != nil {
		return nil, err
	}
	resp.UserId = cast.ToString(claims["uid"])
	return resp, nil
}
