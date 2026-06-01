package biz

import "github.com/go-kratos/kratos/v2/log"

func NewWechatV1CouponUseCase(
	logger log.Logger,
	couponRepo CouponRepo,
	userCouponRepo UserCouponRepo,
	goodRepo GoodRepo,
	channelRepo ChannelRepo,
) *WechatV1CouponUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/wechatV1Coupon"), log.WithMessageKey("message"))
	return &WechatV1CouponUseCase{
		log:            l,
		couponRepo:     couponRepo,
		userCouponRepo: userCouponRepo,
		goodRepo:       goodRepo,
		channelRepo:    channelRepo,
	}
}

type WechatV1CouponUseCase struct {
	log            *log.Helper
	couponRepo     CouponRepo
	userCouponRepo UserCouponRepo
	goodRepo       GoodRepo
	channelRepo    ChannelRepo
}
