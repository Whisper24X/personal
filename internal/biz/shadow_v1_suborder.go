package biz

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

func NewShadowV1SubOrderUseCase(
	logger log.Logger,
	subOrderRepo SubOrderRepo,
	goodRepo GoodRepo,
	channelRepo ChannelRepo,
	sysAdminRepo SysAdminRepo,
	ycOssHttpRpc *rpc.YcOssHttpRpc,
) *ShadowV1SubOrderUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1SubOrder"), log.WithMessageKey("message"))
	return &ShadowV1SubOrderUseCase{
		log:          l,
		subOrderRepo: subOrderRepo,
		goodRepo:     goodRepo,
		channelRepo:  channelRepo,
		sysAdminRepo: sysAdminRepo,
		ycOssHttpRpc: ycOssHttpRpc,
	}
}

type ShadowV1SubOrderUseCase struct {
	log          *log.Helper
	subOrderRepo SubOrderRepo
	goodRepo     GoodRepo
	channelRepo  ChannelRepo
	sysAdminRepo SysAdminRepo
	ycOssHttpRpc *rpc.YcOssHttpRpc
}
