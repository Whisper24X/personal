package biz

import "github.com/go-kratos/kratos/v2/log"

func NewWechatV1GoodUseCase(
	logger log.Logger,
	goodRepo GoodRepo,
	courseRepo CourseRepo,
	platformGoodRepo PlatformGoodRepo,
	userCouponRepo UserCouponRepo,
	couponRepo CouponRepo,
) *WechatV1GoodUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/wechatV1Good"), log.WithMessageKey("message"))
	return &WechatV1GoodUseCase{
		log:              l,
		goodRepo:         goodRepo,
		courseRepo:       courseRepo,
		platformGoodRepo: platformGoodRepo,
		userCouponRepo:   userCouponRepo,
		couponRepo:       couponRepo,
	}
}

type WechatV1GoodUseCase struct {
	log              *log.Helper
	goodRepo         GoodRepo
	courseRepo       CourseRepo
	platformGoodRepo PlatformGoodRepo
	userCouponRepo   UserCouponRepo
	couponRepo       CouponRepo
}
