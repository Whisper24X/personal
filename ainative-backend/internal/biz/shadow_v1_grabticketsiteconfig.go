package biz

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

func NewShadowV1GrabTicketSiteConfigUseCase(
	logger log.Logger,
	grabTicketSiteConfigRepo GrabTicketSiteConfigRepo,
	httpRpc *rpc.HttpRpc,
) *ShadowV1GrabTicketSiteConfigUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1GrabTicketSiteConfig"), log.WithMessageKey("message"))
	return &ShadowV1GrabTicketSiteConfigUseCase{
		log:                      l,
		grabTicketSiteConfigRepo: grabTicketSiteConfigRepo,
		httpRpc:                  httpRpc,
	}
}

type ShadowV1GrabTicketSiteConfigUseCase struct {
	log                      *log.Helper
	grabTicketSiteConfigRepo GrabTicketSiteConfigRepo
	httpRpc                  *rpc.HttpRpc
}
