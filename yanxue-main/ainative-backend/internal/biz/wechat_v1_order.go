package biz

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
)

func NewWechatV1OrderUseCase(
	cfg *conf.Bootstrap,
	logger log.Logger,
	orderRepo OrderRepo,
	userRepo UserRepo,
	userWxRepo UserWxRepo,
	courseRepo CourseRepo,
	courseAppointmentRepo CourseAppointmentRepo,
	goodRepo GoodRepo,
	channelRepo ChannelRepo,
	userCouponRepo UserCouponRepo,
	couponRepo CouponRepo,
	commonRepo CommonRepo,
	wechatPayRepo WechatPayRepo,
	platformGoodRepo PlatformGoodRepo,
	userMessageRepo UserMessageRepo,
	subOrderRepo SubOrderRepo,
) *WechatV1OrderUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/wechatV1Order"), log.WithMessageKey("message"))
	return &WechatV1OrderUseCase{
		cfg:                   cfg,
		log:                   l,
		orderRepo:             orderRepo,
		userRepo:              userRepo,
		userWxRepo:            userWxRepo,
		courseRepo:            courseRepo,
		courseAppointmentRepo: courseAppointmentRepo,
		goodRepo:              goodRepo,
		channelRepo:           channelRepo,
		userCouponRepo:        userCouponRepo,
		couponRepo:            couponRepo,
		commonRepo:            commonRepo,
		wechatPayRepo:         wechatPayRepo,
		platformGoodRepo:      platformGoodRepo,
		userMessageRepo:       userMessageRepo,
		subOrderRepo:          subOrderRepo,
	}
}

type WechatV1OrderUseCase struct {
	cfg                   *conf.Bootstrap
	log                   *log.Helper
	userRepo              UserRepo
	userWxRepo            UserWxRepo
	orderRepo             OrderRepo
	channelRepo           ChannelRepo
	goodRepo              GoodRepo
	courseRepo            CourseRepo
	courseAppointmentRepo CourseAppointmentRepo
	userCouponRepo        UserCouponRepo
	couponRepo            CouponRepo
	commonRepo            CommonRepo
	wechatPayRepo         WechatPayRepo
	platformGoodRepo      PlatformGoodRepo
	userMessageRepo       UserMessageRepo
	subOrderRepo          SubOrderRepo
}
