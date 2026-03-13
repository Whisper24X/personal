package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

func NewYanxueV1AsyncService(
	logger log.Logger,
	shadowV1CourseAppointmentService *ShadowV1CourseAppointmentService,
	shadowV1OrderService *ShadowV1OrderService,
	shadowV1UserCouponService *ShadowV1UserCouponService,
) *YanxueV1AsyncService {
	l := log.NewHelper(log.With(logger, "module", "service/yanxueV1Async"), log.WithMessageKey("message"))
	return &YanxueV1AsyncService{
		log:                              l,
		shadowV1CourseAppointmentService: shadowV1CourseAppointmentService,
		shadowV1OrderService:             shadowV1OrderService,
		shadowV1UserCouponService:        shadowV1UserCouponService,
	}
}

type YanxueV1AsyncService struct {
	log                              *log.Helper
	shadowV1CourseAppointmentService *ShadowV1CourseAppointmentService
	shadowV1OrderService             *ShadowV1OrderService
	shadowV1UserCouponService        *ShadowV1UserCouponService
}

// CourseAppointmentFinish 预约记录完成脚本
func (s *YanxueV1AsyncService) CourseAppointmentFinish(ctx context.Context) error {
	_, err := s.shadowV1CourseAppointmentService.FinishCourseAppointment(ctx, &pb.FinishCourseAppointmentReq{})
	if err != nil {
		return err
	}
	return nil
}

// FeiShuReportAppointmentSituation 飞书预约报告通知
func (s *YanxueV1AsyncService) FeiShuReportAppointmentSituation(ctx context.Context) error {
	_, err := s.shadowV1CourseAppointmentService.FeiShuReportAppointmentSituation(ctx, &pb.FeiShuReportAppointmentSituationReq{})
	if err != nil {
		return err
	}
	return nil
}

// SyncOrderRefundStatus 同步订单退款状态
func (s *YanxueV1AsyncService) SyncOrderRefundStatus(ctx context.Context) error {
	_, err := s.shadowV1OrderService.SyncOrderRefundStatus(ctx, &pb.SyncOrderRefundStatusReq{})
	if err != nil {
		return err
	}
	return nil
}

// SendAppointmentReminderSms 发送预约提醒短信
func (s *YanxueV1AsyncService) SendAppointmentReminderSms(ctx context.Context) error {
	_, err := s.shadowV1CourseAppointmentService.SendAppointmentReminderSms(ctx)
	if err != nil {
		return err
	}
	return nil
}

// SyncWeiDianOrder 同步微店订单
func (s *YanxueV1AsyncService) SyncWeiDianOrder(ctx context.Context) error {
	_, err := s.shadowV1OrderService.SyncWeiDianOrder(ctx, &pb.SyncWeiDianOrderReq{})
	if err != nil {
		return err
	}
	return nil
}

// CloseExpiredOrders 关闭超时未支付订单
func (s *YanxueV1AsyncService) CloseExpiredOrders(ctx context.Context) error {
	_, err := s.shadowV1OrderService.CloseExpiredOrders(ctx, &pb.CloseExpiredOrdersReq{})
	if err != nil {
		return err
	}
	return nil
}

// SyncWechatPayOrderStatus 同步微信支付订单状态
func (s *YanxueV1AsyncService) SyncWechatPayOrderStatus(ctx context.Context) error {
	_, err := s.shadowV1OrderService.SyncWechatPayOrderStatus(ctx, &pb.SyncWechatPayOrderStatusReq{})
	if err != nil {
		return err
	}
	return nil
}

// ExpireUserCoupons 过期用户优惠券状态更新
func (s *YanxueV1AsyncService) ExpireUserCoupons(ctx context.Context) error {
	_, err := s.shadowV1UserCouponService.ExpireUserCoupons(ctx, &pb.ExpireUserCouponsReq{})
	if err != nil {
		return err
	}
	return nil
}

// SyncWechatPayBill 同步微信支付账单
func (s *YanxueV1AsyncService) SyncWechatPayBill(ctx context.Context) error {
	_, err := s.shadowV1OrderService.SyncWechatPayBill(ctx, &pb.SyncWechatPayBillReq{})
	if err != nil {
		return err
	}
	return nil
}

// SyncDouYinSettleInfo 同步抖音分账信息
func (s *YanxueV1AsyncService) SyncDouYinSettleInfo(ctx context.Context) error {
	_, err := s.shadowV1OrderService.SyncDouYinSettleInfo(ctx, &pb.SyncDouYinSettleInfoReq{})
	if err != nil {
		return err
	}
	return nil
}

// SyncWechatPayBillPlatformFee 同步微信支付账单手续费
func (s *YanxueV1AsyncService) SyncWechatPayBillPlatformFee(ctx context.Context) error {
	return s.shadowV1OrderService.SyncWechatPayBillPlatformFee(ctx)
}

// SyncOrderSettlementTime 同步订单结算时间
// 同时同步小程序和抖音渠道的订单结算时间
func (s *YanxueV1AsyncService) SyncOrderSettlementTime(ctx context.Context) error {
	return s.shadowV1OrderService.SyncOrderSettlementTimeTask(ctx)
}

// FixOrderData 修复订单数据
func (s *YanxueV1AsyncService) FixOrderData(ctx context.Context) error {
	_, err := s.shadowV1OrderService.FixOrderData(ctx, &pb.FixOrderDataReq{})
	if err != nil {
		return err
	}
	return nil
}

// RetryFailedOrderCallback 重试失败的订单回调
func (s *YanxueV1AsyncService) RetryFailedOrderCallback(ctx context.Context) error {
	_, err := s.shadowV1OrderService.RetryFailedOrderCallback(ctx, &pb.RetryFailedOrderCallbackReq{})
	if err != nil {
		return err
	}
	return nil
}
