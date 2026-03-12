package biz

import "github.com/go-kratos/kratos/v2/log"

func NewWechatV1CourseUseCase(
	logger log.Logger,
	bffRepo BffRepo,
	orderRepo OrderRepo,
	userRepo UserRepo,
	courseAppointmentRepo CourseAppointmentRepo,
	goodRepo GoodRepo,
	courseRepo CourseRepo,
	courseStockRepo CourseStockRepo,
	userMessageRepo UserMessageRepo,
	userWxRepo UserWxRepo,
	platformGoodRepo PlatformGoodRepo,
	subOrderRepo SubOrderRepo,
) *WechatV1CourseUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/wechatV1Course"), log.WithMessageKey("message"))
	return &WechatV1CourseUseCase{
		log:                   l,
		bffRepo:               bffRepo,
		orderRepo:             orderRepo,
		userRepo:              userRepo,
		courseAppointmentRepo: courseAppointmentRepo,
		goodRepo:              goodRepo,
		courseRepo:            courseRepo,
		courseStockRepo:       courseStockRepo,
		userMessageRepo:       userMessageRepo,
		userWxRepo:            userWxRepo,
		platformGoodRepo:      platformGoodRepo,
		subOrderRepo:          subOrderRepo,
	}
}

type WechatV1CourseUseCase struct {
	log                   *log.Helper
	bffRepo               BffRepo
	orderRepo             OrderRepo
	userRepo              UserRepo
	courseAppointmentRepo CourseAppointmentRepo
	goodRepo              GoodRepo
	courseRepo            CourseRepo
	courseStockRepo       CourseStockRepo
	userMessageRepo       UserMessageRepo
	userWxRepo            UserWxRepo
	platformGoodRepo      PlatformGoodRepo
	subOrderRepo          SubOrderRepo
}
