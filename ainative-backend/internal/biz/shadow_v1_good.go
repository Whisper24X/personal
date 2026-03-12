package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1GoodUseCase(
	logger log.Logger,
	goodRepo GoodRepo,
	channelRepo ChannelRepo,
	platformGoodRepo PlatformGoodRepo,
	sysAdminRepo SysAdminRepo,
	orderRepo OrderRepo,
	courseRepo CourseRepo,
) *ShadowV1GoodUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1Good"), log.WithMessageKey("message"))
	return &ShadowV1GoodUseCase{
		log:              l,
		goodRepo:         goodRepo,
		channelRepo:      channelRepo,
		platformGoodRepo: platformGoodRepo,
		sysAdminRepo:     sysAdminRepo,
		orderRepo:        orderRepo,
		courseRepo:       courseRepo,
	}
}

type ShadowV1GoodUseCase struct {
	log              *log.Helper
	goodRepo         GoodRepo
	channelRepo      ChannelRepo
	platformGoodRepo PlatformGoodRepo
	sysAdminRepo     SysAdminRepo
	orderRepo        OrderRepo
	courseRepo       CourseRepo
}
