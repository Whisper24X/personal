package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1PlatformGoodUseCase(
	logger log.Logger,
	platformGoodRepo PlatformGoodRepo,
	sysAdminRepo SysAdminRepo,
	goodRepo GoodRepo,
	orderRepo OrderRepo,
) *ShadowV1PlatformGoodUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1PlatformGood"), log.WithMessageKey("message"))
	return &ShadowV1PlatformGoodUseCase{
		log:              l,
		platformGoodRepo: platformGoodRepo,
		sysAdminRepo:     sysAdminRepo,
		goodRepo:         goodRepo,
		orderRepo:        orderRepo,
	}
}

type ShadowV1PlatformGoodUseCase struct {
	log              *log.Helper
	platformGoodRepo PlatformGoodRepo
	sysAdminRepo     SysAdminRepo
	goodRepo         GoodRepo
	orderRepo        OrderRepo
}
