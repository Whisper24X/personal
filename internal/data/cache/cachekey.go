package cache

import (
	"time"

	"gitlab.yc345.tv/backend/yanxue/internal/pkg/cache/keymanage"
)

var cacheKey = keymanage.New("yanxue")

var (
	LOCK                                 = cacheKey.AddKey("LOCK", time.Minute*5, "锁")
	RouteCache                           = cacheKey.AddKey("RouteCache", time.Hour*24, "路由缓存")
	UserSmsCode                          = cacheKey.AddKey("UserSmsCode", time.Minute*5, "用户短信验证码")
	UserSmsCodeFrequency                 = cacheKey.AddKey("UserSmsCodeFrequency", time.Hour*24, "用户短信验证码频率")
	FinishCourseAppointmentLock          = cacheKey.AddKey("FinishCourseAppointmentLock", time.Minute*3, "课程预约完成锁")
	OrderFinishLock                      = cacheKey.AddKey("OrderFinishLock", time.Minute*3, "订单完成锁")
	FeiShuReportAppointmentSituationLock = cacheKey.AddKey("FeiShuReportAppointmentSituationLock", time.Minute*3, "飞书通知预约情况锁")
	SendAppointmentReminderSmsLock       = cacheKey.AddKey("SendAppointmentReminderSmsLock", time.Minute*10, "发送预约提醒短信锁")
	SyncOrderRefundStatusLock            = cacheKey.AddKey("SyncOrderRefundStatusLock", time.Minute*3, "同步订单退款状态锁")
	WeiDianAccessToken                   = cacheKey.AddKey("WeDianAccessToken", time.Hour*12, "微店access_token")
	SyncWeiDianOrderInfoLock             = cacheKey.AddKey("SyncWeiDianOrderInfoLock", time.Minute*5, "同步微店订单锁")
	SyncWechatPayBillLock                = cacheKey.AddKey("SyncWechatPayBillLock", time.Minute*5, "同步微信支付账单锁")
	SyncWechatPayBillPlatformFeeLock     = cacheKey.AddKey("SyncWechatPayBillPlatformFeeLock", time.Minute*30, "同步微信支付账单手续费锁")
	WxXcxQrcodeTokenLock                 = cacheKey.AddKey("WxXcxQrcodeTokenLock", time.Minute*5, "微信小程序码token锁")
	SyncWechatPayOrderStatusLock         = cacheKey.AddKey("SyncWechatPayOrderStatusLock", time.Minute, "同步微信支付订单状态锁")
	ExpireUserCouponsLock                = cacheKey.AddKey("ExpireUserCouponsLock", time.Minute*5, "过期用户优惠券状态更新锁")
	SyncDouYinSettleInfoLock             = cacheKey.AddKey("SyncDouYinSettleInfoLock", time.Minute*5, "同步抖音分账信息锁")
	SyncDouYinCertificateIdLock          = cacheKey.AddKey("SyncDouYinCertificateIdLock", time.Minute*5, "同步抖音券ID锁")
	SyncWeiDianRefundAmountLock          = cacheKey.AddKey("SyncWeiDianRefundAmountLock", time.Minute*5, "同步微店退款金额锁")
	FixOrderDataLock                     = cacheKey.AddKey("FixOrderDataLock", time.Minute*5, "修复订单数据锁")
	FixRefundAmountLock                  = cacheKey.AddKey("FixRefundAmountLock", time.Minute*5, "修复退款金额锁")
	SyncDouYinOrderLock                  = cacheKey.AddKey("SyncDouYinOrderLock", time.Minute*10, "同步抖音订单锁")
	RetryFailedOrderCallbackLock         = cacheKey.AddKey("RetryFailedOrderCallbackLock", time.Minute*1, "重试失败订单回调锁")
)
