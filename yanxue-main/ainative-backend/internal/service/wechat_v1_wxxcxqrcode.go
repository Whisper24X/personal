package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewWechatV1WxXcxQrcodeService(
	logger log.Logger,
	wechatV1WxXcxQrcodeUseCase *biz.WechatV1WxXcxQrcodeUseCase,
) *WechatV1WxXcxQrcodeService {
	l := log.NewHelper(log.With(logger, "module", "service/wechatV1WxXcxQrcode"), log.WithMessageKey("message"))
	return &WechatV1WxXcxQrcodeService{
		log:                        l,
		wechatV1WxXcxQrcodeUseCase: wechatV1WxXcxQrcodeUseCase,
	}
}

type WechatV1WxXcxQrcodeService struct {
	pb.UnimplementedWxXcxQrcodeServer
	log                        *log.Helper
	wechatV1WxXcxQrcodeUseCase *biz.WechatV1WxXcxQrcodeUseCase
}

// GenerateWxXcxQrcode 微信小程序码-生成小程序码
func (w *WechatV1WxXcxQrcodeService) GenerateWxXcxQrcode(ctx context.Context, req *pb.GenerateWxXcxQrcodeReq) (*pb.GenerateWxXcxQrcodeReply, error) {
	return w.wechatV1WxXcxQrcodeUseCase.GenerateWxXcxQrcode(ctx, req)
}

// GetWxXcxQrcodeScene 微信小程序码-根据token获取场景
func (w *WechatV1WxXcxQrcodeService) GetWxXcxQrcodeScene(ctx context.Context, req *pb.GetWxXcxQrcodeSceneReq) (*pb.GetWxXcxQrcodeSceneReply, error) {
	return w.wechatV1WxXcxQrcodeUseCase.GetWxXcxQrcodeScene(ctx, req)
}
