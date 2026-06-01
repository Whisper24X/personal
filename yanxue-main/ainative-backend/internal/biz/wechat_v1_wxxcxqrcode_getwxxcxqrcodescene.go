package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
)

// GetWxXcxQrcodeScene 微信小程序码-根据token获取场景
func (w *WechatV1WxXcxQrcodeUseCase) GetWxXcxQrcodeScene(ctx context.Context, req *pb.GetWxXcxQrcodeSceneReq) (*pb.GetWxXcxQrcodeSceneReply, error) {
	resp := &pb.GetWxXcxQrcodeSceneReply{
		Page:  "",
		Scene: "",
	}
	info, err := w.wxXcxQrcodeRepo.FindOneCacheByToken(ctx, req.GetToken())
	if err != nil {
		return nil, err
	}
	resp.Page = info.Page
	resp.Scene = info.Scene
	return resp, nil
}
