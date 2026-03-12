package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1SysOperationLogUseCase(
	logger log.Logger,
	bffRepo BffRepo,
	SysOperationLogRepo SysOperationLogRepo,
) *ShadowV1SysOperationLogUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1SysOperationLog"), log.WithMessageKey("message"))
	return &ShadowV1SysOperationLogUseCase{
		log:                 l,
		bffRepo:             bffRepo,
		SysOperationLogRepo: SysOperationLogRepo,
	}
}

type ShadowV1SysOperationLogUseCase struct {
	log                 *log.Helper
	bffRepo             BffRepo
	SysOperationLogRepo SysOperationLogRepo
}
