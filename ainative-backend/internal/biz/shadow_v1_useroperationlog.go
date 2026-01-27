package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1UserOperationLogUseCase(
	logger log.Logger,
) *ShadowV1UserOperationLogUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1UserOperationLog"), log.WithMessageKey("message"))
	return &ShadowV1UserOperationLogUseCase{
		log: l,
	}
}

type ShadowV1UserOperationLogUseCase struct {
	log *log.Helper
}
