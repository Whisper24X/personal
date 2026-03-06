package server

import (
	netHttp "net/http"

	"github.com/go-kratos/kratos/v2/middleware/metadata"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
	"github.com/go-kratos/kratos/v2/transport/http"
	"gitlab.yc345.tv/backend/utils/v2/health/core"
	krs "gitlab.yc345.tv/backend/utils/v2/health/kratos"
	"gitlab.yc345.tv/backend/utils/v2/metrics"
	requestCancel "gitlab.yc345.tv/backend/utils/v2/requestCancelHandle/middleware"
	shadowV1 "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	wechatV1 "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/errx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/middleware/auth"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/middleware/logger"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/middleware/recovery"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/middleware/validate"
	"gitlab.yc345.tv/backend/yanxue/internal/service"
)

// NewHTTPServer new a HTTP server.
func NewHTTPServer(
	config *conf.Bootstrap,
	// 后台
	shadowV1SysAuthService *service.ShadowV1SysAuthService,
	shadowV1SysAdminService *service.ShadowV1SysAdminService,
	shadowV1SysRoleService *service.ShadowV1SysRoleService,
	shadowV1SysPermissionService *service.ShadowV1SysPermissionService,
	shadowV1SysDeptService *service.ShadowV1SysDeptService,
	shadowV1SysOperationLogService *service.ShadowV1SysOperationLogService,
	shadowV1UserService *service.ShadowV1UserService,
	shadowV1UserBindStudentService *service.ShadowV1UserBindStudentService,
	shadowV1ContractService *service.ShadowV1ContractService,
	shadowV1GoodService *service.ShadowV1GoodService,
	shadowV1PlatformGoodService *service.ShadowV1PlatformGoodService,
	shadowV1ChannelService *service.ShadowV1ChannelService,
	shadowV1CourseService *service.ShadowV1CourseService,
	shadowV1CourseStockService *service.ShadowV1CourseStockService,
	shadowV1CourseAppointmentService *service.ShadowV1CourseAppointmentService,
	shadowV1OrderService *service.ShadowV1OrderService,
	shadowV1DynamicFieldMappingService *service.ShadowV1DynamicFieldMappingService,
	shadowV1EvaluationTemplateService *service.ShadowV1EvaluationTemplateService,
	shadowV1EvaluationService *service.ShadowV1EvaluationService,
	shadowV1GrabTicketSiteConfigService *service.ShadowV1GrabTicketSiteConfigService,
	shadowV1GrabTicketTaskConfigService *service.ShadowV1GrabTicketTaskConfigService,
	shadowV1GoodRecommendationCategoryService *service.ShadowV1GoodRecommendationCategoryService,
	shadowV1CouponService *service.ShadowV1CouponService,
	shadowV1UserCouponService *service.ShadowV1UserCouponService,
	shadowV1SysDataLogService *service.ShadowV1SysDataLogService,
	shadowV1UserWxService *service.ShadowV1UserWxService,
	shadowV1SubOrderService *service.ShadowV1SubOrderService,
	// 微信
	wechatV1UserService *service.WechatV1UserService,
	wechatV1UserBindStudentService *service.WechatV1UserBindStudentService,
	wechatV1CourseService *service.WechatV1CourseService,
	wechatV1OrderService *service.WechatV1OrderService,
	wechatV1EvaluationService *service.WechatV1EvaluationService,
	wechatV1EvaluationTemplateService *service.WechatV1EvaluationTemplateService,
	wechatV1GoodRecommendationCategoryService *service.WechatV1GoodRecommendationCategoryService,
	wechatV1GoodService *service.WechatV1GoodService,
	wechatV1CouponService *service.WechatV1CouponService,
	wechatV1UserCouponService *service.WechatV1UserCouponService,
	wechatV1WxXcxQrcodeService *service.WechatV1WxXcxQrcodeService,
) *http.Server {
	var opts = []http.ServerOption{
		// tracing,logger, recovery的顺序不能变
		http.Middleware(
			tracing.Server(),
			metrics.KratosMiddleware(),
			logger.HTTPLogger(config),
			recovery.Recovery(),
			metadata.Server(),
			validate.Validator(),
			//limiter.Limit(config),
			requestCancel.KratosMiddleware(&requestCancel.Option{
				Timeout: config.GetServer().GetHttp().GetTimeout().AsDuration(),
			}),
			auth.ShadowAuthSelectorMiddleware(shadowV1SysAuthService, shadowV1SysOperationLogService),
			auth.WechatAuthSelectorMiddleware(wechatV1UserService),
			auth.WechatOptionalAuthSelectorMiddleware(wechatV1UserService), // 可选登录中间件
		),
		krs.ServerOption(core.Manager),
	}
	if config.Server.Http.Network != "" {
		opts = append(opts, http.Network(config.Server.Http.Network))
	}
	if config.Server.Http.Addr != "" {
		opts = append(opts, http.Address(config.Server.Http.Addr))
	}
	if config.Server.Http.Timeout != nil {
		opts = append(opts, http.Timeout(config.Server.Http.Timeout.AsDuration()))
	}
	opts = append(opts, http.ErrorEncoder(errx.HTTPErrorEncoder(errorx.Manager)), http.ResponseEncoder(ResponseEncoder))
	srv := http.NewServer(opts...)

	// 后台
	shadowV1.RegisterSysAuthHTTPServer(srv, shadowV1SysAuthService)
	shadowV1.RegisterSysAdminHTTPServer(srv, shadowV1SysAdminService)
	shadowV1.RegisterSysRoleHTTPServer(srv, shadowV1SysRoleService)
	shadowV1.RegisterSysPermissionHTTPServer(srv, shadowV1SysPermissionService)
	shadowV1.RegisterSysDeptHTTPServer(srv, shadowV1SysDeptService)
	shadowV1.RegisterSysOperationLogHTTPServer(srv, shadowV1SysOperationLogService)
	shadowV1.RegisterUserHTTPServer(srv, shadowV1UserService)
	shadowV1.RegisterUserBindStudentHTTPServer(srv, shadowV1UserBindStudentService)
	shadowV1.RegisterContractHTTPServer(srv, shadowV1ContractService)
	shadowV1.RegisterGoodHTTPServer(srv, shadowV1GoodService)
	shadowV1.RegisterPlatformGoodHTTPServer(srv, shadowV1PlatformGoodService)
	shadowV1.RegisterChannelHTTPServer(srv, shadowV1ChannelService)
	shadowV1.RegisterCourseHTTPServer(srv, shadowV1CourseService)
	shadowV1.RegisterCourseStockHTTPServer(srv, shadowV1CourseStockService)
	shadowV1.RegisterCourseAppointmentHTTPServer(srv, shadowV1CourseAppointmentService)
	shadowV1.RegisterOrderHTTPServer(srv, shadowV1OrderService)
	shadowV1.RegisterDynamicFieldMappingHTTPServer(srv, shadowV1DynamicFieldMappingService)
	shadowV1.RegisterEvaluationTemplateHTTPServer(srv, shadowV1EvaluationTemplateService)
	shadowV1.RegisterEvaluationHTTPServer(srv, shadowV1EvaluationService)
	shadowV1.RegisterGrabTicketSiteConfigHTTPServer(srv, shadowV1GrabTicketSiteConfigService)
	shadowV1.RegisterGrabTicketTaskConfigHTTPServer(srv, shadowV1GrabTicketTaskConfigService)
	shadowV1.RegisterGoodRecommendationCategoryHTTPServer(srv, shadowV1GoodRecommendationCategoryService)
	shadowV1.RegisterCouponHTTPServer(srv, shadowV1CouponService)
	shadowV1.RegisterUserCouponHTTPServer(srv, shadowV1UserCouponService)
	shadowV1.RegisterSysDataLogHTTPServer(srv, shadowV1SysDataLogService)
	shadowV1.RegisterUserWxHTTPServer(srv, shadowV1UserWxService)
	shadowV1.RegisterSubOrderHTTPServer(srv, shadowV1SubOrderService)
	// 微信
	wechatV1.RegisterUserHTTPServer(srv, wechatV1UserService)
	wechatV1.RegisterUserBindStudentHTTPServer(srv, wechatV1UserBindStudentService)
	wechatV1.RegisterCourseHTTPServer(srv, wechatV1CourseService)
	wechatV1.RegisterOrderHTTPServer(srv, wechatV1OrderService)
	wechatV1.RegisterEvaluationHTTPServer(srv, wechatV1EvaluationService)
	wechatV1.RegisterEvaluationTemplateHTTPServer(srv, wechatV1EvaluationTemplateService)
	wechatV1.RegisterGoodRecommendationCategoryHTTPServer(srv, wechatV1GoodRecommendationCategoryService)
	wechatV1.RegisterGoodHTTPServer(srv, wechatV1GoodService)
	wechatV1.RegisterCouponHTTPServer(srv, wechatV1CouponService)
	wechatV1.RegisterUserCouponHTTPServer(srv, wechatV1UserCouponService)
	wechatV1.RegisterWxXcxQrcodeHTTPServer(srv, wechatV1WxXcxQrcodeService)
	// 自定义路由
	srv.HandleFunc("/yanxue/wechat/v1/officialaccount/callback", wechatV1UserService.OfficialAccountCallback)
	// 抢票通知扫码登录
	srv.HandleFunc("/yanxue/api/shadow/v1/grab_ticket/notifyScanCodeForGrabTicket", shadowV1GrabTicketSiteConfigService.NotifyScanCodeForGrabTicket)

	// 支付回调通知
	srv.HandleFunc("/yanxue/wechat/v1/order/wechatPayPaidNotify", wechatV1OrderService.WechatPayPaidNotify)
	srv.HandleFunc("/yanxue/wechat/v1/order/wechatPayRefundNotify", wechatV1OrderService.WechatPayRefundNotify)

	// 根目录:服务状态提示
	srv.HandleFunc("/", func(w netHttp.ResponseWriter, r *netHttp.Request) {
		w.Write([]byte(config.GetName() + " is running"))
	})
	return srv
}

// ResponseEncoder encodes the object to the HTTP response.
func ResponseEncoder(w http.ResponseWriter, r *http.Request, v interface{}) error {
	if v == nil {
		return nil
	}
	if rd, ok := v.(http.Redirector); ok {
		url, code := rd.Redirect()
		netHttp.Redirect(w, r, url, code)
		return nil
	}
	codec, _ := http.CodecForRequest(r, "Accept")
	data, err := codec.Marshal(v)
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/"+codec.Name())
	w.Header().Set("X-Trace-Id", r.Header.Get("TraceID"))
	_, err = w.Write(data)
	if err != nil {
		return err
	}
	return nil
}
