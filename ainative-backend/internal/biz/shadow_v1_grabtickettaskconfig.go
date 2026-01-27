package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1GrabTicketTaskConfigUseCase(
	logger log.Logger,
	grabTicketTaskConfigRepo GrabTicketTaskConfigRepo,
) *ShadowV1GrabTicketTaskConfigUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1GrabTicketTaskConfig"), log.WithMessageKey("message"))
	return &ShadowV1GrabTicketTaskConfigUseCase{
		log:                      l,
		grabTicketTaskConfigRepo: grabTicketTaskConfigRepo,
	}
}

type ShadowV1GrabTicketTaskConfigUseCase struct {
	log                      *log.Helper
	grabTicketTaskConfigRepo GrabTicketTaskConfigRepo
}
