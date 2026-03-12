package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1UserMessageUseCase(
	logger log.Logger,
) *ShadowV1UserMessageUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1UserMessage"), log.WithMessageKey("message"))
	return &ShadowV1UserMessageUseCase{
		log: l,
	}
}

type ShadowV1UserMessageUseCase struct {
	log *log.Helper
}
