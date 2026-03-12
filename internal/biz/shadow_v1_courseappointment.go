package biz

import (
	"github.com/go-kratos/kratos/v2/log"

	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

func NewShadowV1CourseAppointmentUseCase(
	logger log.Logger,
	ycOssHttpRpc *rpc.YcOssHttpRpc,
	smsNotifyHttpRpc *rpc.SmsNotifyHttpRpc,
	commonRepo CommonRepo,
	bffRepo BffRepo,
	courseAppointmentRepo CourseAppointmentRepo,
	courseRepo CourseRepo,
	courseStockRepo CourseStockRepo,
	sysAdminRepo SysAdminRepo,
	goodRepo GoodRepo,
	orderRepo OrderRepo,
	channelRepo ChannelRepo,
	userRepo UserRepo,
	userWxRepo UserWxRepo,
	userMessageRepo UserMessageRepo,
	subOrderRepo SubOrderRepo,
) *ShadowV1CourseAppointmentUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1CourseAppointment"), log.WithMessageKey("message"))
	return &ShadowV1CourseAppointmentUseCase{
		log:                   l,
		ycOssHttpRpc:          ycOssHttpRpc,
		smsNotifyHttpRpc:      smsNotifyHttpRpc,
		commonRepo:            commonRepo,
		bffRepo:               bffRepo,
		courseAppointmentRepo: courseAppointmentRepo,
		courseRepo:            courseRepo,
		courseStockRepo:       courseStockRepo,
		sysAdminRepo:          sysAdminRepo,
		orderRepo:             orderRepo,
		goodRepo:              goodRepo,
		channelRepo:           channelRepo,
		userRepo:              userRepo,
		userWxRepo:            userWxRepo,
		userMessageRepo:       userMessageRepo,
		subOrderRepo:          subOrderRepo,
	}
}

type ShadowV1CourseAppointmentUseCase struct {
	log                   *log.Helper
	commonRepo            CommonRepo
	ycOssHttpRpc          *rpc.YcOssHttpRpc
	smsNotifyHttpRpc      *rpc.SmsNotifyHttpRpc
	bffRepo               BffRepo
	courseAppointmentRepo CourseAppointmentRepo
	courseRepo            CourseRepo
	courseStockRepo       CourseStockRepo
	sysAdminRepo          SysAdminRepo
	orderRepo             OrderRepo
	goodRepo              GoodRepo
	channelRepo           ChannelRepo
	userRepo              UserRepo
	userWxRepo            UserWxRepo
	userMessageRepo       UserMessageRepo
	subOrderRepo          SubOrderRepo
}
