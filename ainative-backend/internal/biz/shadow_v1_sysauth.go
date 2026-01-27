package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1SysAuthUseCase(
	logger log.Logger,
	sysAdminRepo SysAdminRepo,
) *ShadowV1SysAuthUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1SysAuth"), log.WithMessageKey("message"))
	return &ShadowV1SysAuthUseCase{
		log:          l,
		sysAdminRepo: sysAdminRepo,
	}
}

type ShadowV1SysAuthUseCase struct {
	log          *log.Helper
	sysAdminRepo SysAdminRepo
}
