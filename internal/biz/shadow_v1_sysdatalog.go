package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1SysDataLogUseCase(
	logger log.Logger,
	sysDataLogRepo SysDataLogRepo,
	sysAdminRepo SysAdminRepo,
) *ShadowV1SysDataLogUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1SysDataLog"), log.WithMessageKey("message"))
	return &ShadowV1SysDataLogUseCase{
		log:            l,
		sysDataLogRepo: sysDataLogRepo,
		sysAdminRepo:   sysAdminRepo,
	}
}

type ShadowV1SysDataLogUseCase struct {
	log            *log.Helper
	sysDataLogRepo SysDataLogRepo
	sysAdminRepo   SysAdminRepo
}
