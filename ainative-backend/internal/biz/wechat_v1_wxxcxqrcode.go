package biz

import (
	"github.com/FrancisLv/PowerWeChat/v3/src/miniProgram"
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

func NewWechatV1WxXcxQrcodeUseCase(
	logger log.Logger,
	commonRepo CommonRepo,
	wxXcxQrcodeRepo WxXcxQrcodeRepo,
	miniProgram *miniProgram.MiniProgram,
	ycOssHttpRpc *rpc.YcOssHttpRpc,
) *WechatV1WxXcxQrcodeUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/wechatV1WxXcxQrcode"), log.WithMessageKey("message"))
	return &WechatV1WxXcxQrcodeUseCase{
		log:             l,
		commonRepo:      commonRepo,
		wxXcxQrcodeRepo: wxXcxQrcodeRepo,
		miniProgram:     miniProgram,
		ycOssHttpRpc:    ycOssHttpRpc,
	}
}

type WechatV1WxXcxQrcodeUseCase struct {
	log             *log.Helper
	commonRepo      CommonRepo
	wxXcxQrcodeRepo WxXcxQrcodeRepo
	miniProgram     *miniProgram.MiniProgram
	ycOssHttpRpc    *rpc.YcOssHttpRpc
}
