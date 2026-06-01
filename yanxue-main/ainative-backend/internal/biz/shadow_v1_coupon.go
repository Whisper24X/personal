package biz

import (
	"github.com/go-kratos/kratos/v2/log"
)

func NewShadowV1CouponUseCase(
	logger log.Logger,
	couponRepo CouponRepo,
	sysDataLogRepo SysDataLogRepo,
	userCouponRepo UserCouponRepo,
) *ShadowV1CouponUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1Coupon"), log.WithMessageKey("message"))
	return &ShadowV1CouponUseCase{
		log:            l,
		couponRepo:     couponRepo,
		sysDataLogRepo: sysDataLogRepo,
		userCouponRepo: userCouponRepo,
	}
}

type ShadowV1CouponUseCase struct {
	log            *log.Helper
	couponRepo     CouponRepo
	sysDataLogRepo SysDataLogRepo
	userCouponRepo UserCouponRepo
}
