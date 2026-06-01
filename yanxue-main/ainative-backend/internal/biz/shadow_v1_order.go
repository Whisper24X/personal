package biz

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

func NewShadowV1OrderUseCase(
	logger log.Logger,
	ycOssHttpRpc *rpc.YcOssHttpRpc,
	commonRepo CommonRepo,
	bffRepo BffRepo,
	sysAdminRepo SysAdminRepo,
	channelRepo ChannelRepo,
	orderRepo OrderRepo,
	goodRepo GoodRepo,
	courseRepo CourseRepo,
	courseAppointmentRepo CourseAppointmentRepo,
	dynamicFieldMappingRepo DynamicFieldMappingRepo,
	httpRpc *rpc.HttpRpc,
	wechatPayRepo WechatPayRepo,
	userCouponRepo UserCouponRepo,
	platformGoodRepo PlatformGoodRepo,
	sysDataLogRepo SysDataLogRepo,
	wechatPayBillRepo WechatPayBillRepo,
	subOrderRepo SubOrderRepo,
	asyncTaskRepo AsyncTaskRepo,
) *ShadowV1OrderUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1Order"), log.WithMessageKey("message"))
	return &ShadowV1OrderUseCase{
		log:                     l,
		ycOssHttpRpc:            ycOssHttpRpc,
		commonRepo:              commonRepo,
		bffRepo:                 bffRepo,
		sysAdminRepo:            sysAdminRepo,
		channelRepo:             channelRepo,
		orderRepo:               orderRepo,
		goodRepo:                goodRepo,
		courseRepo:              courseRepo,
		courseAppointmentRepo:   courseAppointmentRepo,
		dynamicFieldMappingRepo: dynamicFieldMappingRepo,
		httpRpc:                 httpRpc,
		wechatPayRepo:           wechatPayRepo,
		userCouponRepo:          userCouponRepo,
		platformGoodRepo:        platformGoodRepo,
		sysDataLogRepo:          sysDataLogRepo,
		wechatPayBillRepo:       wechatPayBillRepo,
		subOrderRepo:            subOrderRepo,
		asyncTaskRepo:           asyncTaskRepo,
	}
}

type ShadowV1OrderUseCase struct {
	log                     *log.Helper
	ycOssHttpRpc            *rpc.YcOssHttpRpc
	commonRepo              CommonRepo
	bffRepo                 BffRepo
	sysAdminRepo            SysAdminRepo
	channelRepo             ChannelRepo
	orderRepo               OrderRepo
	goodRepo                GoodRepo
	courseRepo              CourseRepo
	courseAppointmentRepo   CourseAppointmentRepo
	dynamicFieldMappingRepo DynamicFieldMappingRepo
	httpRpc                 *rpc.HttpRpc
	wechatPayRepo           WechatPayRepo
	userCouponRepo          UserCouponRepo
	platformGoodRepo        PlatformGoodRepo
	sysDataLogRepo          SysDataLogRepo
	wechatPayBillRepo       WechatPayBillRepo
	subOrderRepo            SubOrderRepo
	asyncTaskRepo           AsyncTaskRepo
}
