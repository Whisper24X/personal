package biz

import (
	"github.com/go-kratos/kratos/v2/log"
)

func NewWechatV1UserCouponUseCase(
	logger log.Logger,
	userCouponRepo UserCouponRepo,
	couponRepo CouponRepo,
	userRepo UserRepo,
	commonRepo CommonRepo,
	goodRepo GoodRepo,
) *WechatV1UserCouponUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/wechatV1UserCoupon"), log.WithMessageKey("message"))
	return &WechatV1UserCouponUseCase{
		log:            l,
		userCouponRepo: userCouponRepo,
		couponRepo:     couponRepo,
		userRepo:       userRepo,
		commonRepo:     commonRepo,
		goodRepo:       goodRepo,
	}
}

type WechatV1UserCouponUseCase struct {
	log            *log.Helper
	userCouponRepo UserCouponRepo
	couponRepo     CouponRepo
	userRepo       UserRepo
	commonRepo     CommonRepo
	goodRepo       GoodRepo
}
