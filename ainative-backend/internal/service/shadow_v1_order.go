package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1OrderService(
	logger log.Logger,
	shadowV1OrderUseCase *biz.ShadowV1OrderUseCase,
) *ShadowV1OrderService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1Order"), log.WithMessageKey("message"))
	return &ShadowV1OrderService{
		log:                  l,
		shadowV1OrderUseCase: shadowV1OrderUseCase,
	}
}

type ShadowV1OrderService struct {
	pb.UnimplementedOrderServer
	log                  *log.Helper
	shadowV1OrderUseCase *biz.ShadowV1OrderUseCase
}

// GetOrderList 订单-列表数据查询
func (s *ShadowV1OrderService) GetOrderList(ctx context.Context, req *pb.GetOrderListReq) (*pb.GetOrderListReply, error) {
	return s.shadowV1OrderUseCase.GetOrderList(ctx, req)
}

// ImportOrderInfoByCsvFile 订单-导入订单信息
func (s *ShadowV1OrderService) ImportOrderInfoByCsvFile(ctx context.Context, req *pb.ImportOrderInfoByCsvFileReq) (*pb.ImportOrderInfoByCsvFileReply, error) {
	return s.shadowV1OrderUseCase.ImportOrderInfoByCsvFile(ctx, req)
}

// ExportOrderList 订单-导出订单信息
func (s *ShadowV1OrderService) ExportOrderList(ctx context.Context, req *pb.ExportOrderListReq) (*pb.ExportOrderListReply, error) {
	return s.shadowV1OrderUseCase.ExportOrderList(ctx, req)
}

// FinishOrder 订单-结束
func (s *ShadowV1OrderService) FinishOrder(ctx context.Context, req *pb.FinishOrderReq) (*pb.FinishOrderReply, error) {
	return s.shadowV1OrderUseCase.FinishOrder(ctx, req)
}

// CancelOrder 订单-取消
func (s *ShadowV1OrderService) CancelOrder(ctx context.Context, req *pb.CancelOrderReq) (*pb.CancelOrderReply, error) {
	return s.shadowV1OrderUseCase.CancelOrder(ctx, req)
}

// GetOrderGoodInfo 订单-获取订单商品详情
func (s *ShadowV1OrderService) GetOrderGoodInfo(ctx context.Context, req *pb.GetOrderGoodInfoReq) (*pb.GetOrderGoodInfoReply, error) {
	return s.shadowV1OrderUseCase.GetOrderGoodInfo(ctx, req)
}

// GetOrderListByPhone 订单-手机号查询订单
func (s *ShadowV1OrderService) GetOrderListByPhone(ctx context.Context, req *pb.GetOrderListByPhoneReq) (*pb.GetOrderListByPhoneReply, error) {
	return s.shadowV1OrderUseCase.GetOrderListByPhone(ctx, req)
}

// GetOrderVerificationProgressList 查询订单核销进度
func (s *ShadowV1OrderService) GetOrderVerificationProgressList(ctx context.Context, req *pb.GetOrderVerificationProgressListReq) (*pb.GetOrderVerificationProgressListReply, error) {
	return s.shadowV1OrderUseCase.GetOrderVerificationProgressList(ctx, req)
}

// UpdateOrderDetail 订单-修改订单详情
func (s *ShadowV1OrderService) UpdateOrderDetail(ctx context.Context, req *pb.UpdateOrderDetailReq) (*pb.UpdateOrderDetailReply, error) {
	return s.shadowV1OrderUseCase.UpdateOrderDetail(ctx, req)
}

// ImportPhoneByCsvFile 订单-导入手机号
func (s *ShadowV1OrderService) ImportPhoneByCsvFile(ctx context.Context, req *pb.ImportPhoneByCsvFileReq) (*pb.ImportPhoneByCsvFileReply, error) {
	return s.shadowV1OrderUseCase.ImportPhoneByCsvFile(ctx, req)
}

// DouYinOrderInfoCallback 抖音订单消息回传
func (s *ShadowV1OrderService) DouYinOrderInfoCallback(ctx context.Context, req *pb.DouYinOrderInfoCallbackReq) (*pb.DouYinOrderInfoCallbackReply, error) {
	return s.shadowV1OrderUseCase.DouYinOrderInfoCallback(ctx, req)
}

// SyncOrderRefundStatus 订单退款状态同步
func (s *ShadowV1OrderService) SyncOrderRefundStatus(ctx context.Context, req *pb.SyncOrderRefundStatusReq) (*pb.SyncOrderRefundStatusReply, error) {
	return s.shadowV1OrderUseCase.SyncOrderRefundStatus(ctx, req)
}

// SyncWeiDianOrder 微店订单同步
func (s *ShadowV1OrderService) SyncWeiDianOrder(ctx context.Context, req *pb.SyncWeiDianOrderReq) (*pb.SyncWeiDianOrderReply, error) {
	return s.shadowV1OrderUseCase.SyncWeiDianOrder(ctx, req)
}

// MiniProgramOrderRefund 小程序订单退款
func (s *ShadowV1OrderService) MiniProgramOrderRefund(ctx context.Context, req *pb.MiniProgramOrderRefundReq) (*pb.MiniProgramOrderRefundReply, error) {
	return s.shadowV1OrderUseCase.MiniProgramOrderRefund(ctx, req)
}

// CloseExpiredOrders 关闭超时未支付订单
func (s *ShadowV1OrderService) CloseExpiredOrders(ctx context.Context, req *pb.CloseExpiredOrdersReq) (*pb.CloseExpiredOrdersReply, error) {
	return s.shadowV1OrderUseCase.CloseExpiredOrders(ctx, req)
}

// SyncWechatPayOrderStatus 同步微信支付订单状态
func (s *ShadowV1OrderService) SyncWechatPayOrderStatus(ctx context.Context, req *pb.SyncWechatPayOrderStatusReq) (*pb.SyncWechatPayOrderStatusReply, error) {
	return s.shadowV1OrderUseCase.SyncWechatPayOrderStatus(ctx, req)
}

// SyncWechatPayBill 同步微信支付账单
func (s *ShadowV1OrderService) SyncWechatPayBill(ctx context.Context, req *pb.SyncWechatPayBillReq) (*pb.SyncWechatPayBillReply, error) {
	resp, err := s.shadowV1OrderUseCase.SyncWechatPayBill(ctx, req)
	if err != nil {
		s.log.Errorf("同步微信支付账单失败！原因：%v", err)
	}
	return resp, err
}

// SyncWechatPayBillPlatformFee 同步微信支付账单手续费（定时任务）
func (s *ShadowV1OrderService) SyncWechatPayBillPlatformFee(ctx context.Context) error {
	return s.shadowV1OrderUseCase.SyncWechatPayBillPlatformFee(ctx)
}

// SyncDouYinSettleInfo 同步抖音分账信息
func (s *ShadowV1OrderService) SyncDouYinSettleInfo(ctx context.Context, req *pb.SyncDouYinSettleInfoReq) (*pb.SyncDouYinSettleInfoReply, error) {
	return s.shadowV1OrderUseCase.SyncDouYinSettleInfo(ctx, req)
}

// ExportWechatPayBill 导出微信账单
func (s *ShadowV1OrderService) ExportWechatPayBill(ctx context.Context, req *pb.ExportWechatPayBillReq) (*pb.ExportWechatPayBillReply, error) {
	return s.shadowV1OrderUseCase.ExportWechatPayBill(ctx, req)
}

// SplitSubOrder 刷订单数据和拆单
func (s *ShadowV1OrderService) SplitSubOrder(ctx context.Context, req *pb.SplitSubOrderReq) (*pb.SplitSubOrderReply, error) {
	return s.shadowV1OrderUseCase.SplitSubOrder(ctx, req)
}

// RefreshServiceStatus 刷服务状态数据
func (s *ShadowV1OrderService) RefreshServiceStatus(ctx context.Context, req *pb.RefreshServiceStatusReq) (*pb.RefreshServiceStatusReply, error) {
	return s.shadowV1OrderUseCase.RefreshServiceStatus(ctx, req)
}

// RefreshGoodType 刷新商品类型
func (s *ShadowV1OrderService) RefreshGoodType(ctx context.Context, req *pb.RefreshGoodTypeReq) (*pb.RefreshGoodTypeReply, error) {
	return s.shadowV1OrderUseCase.RefreshGoodType(ctx, req)
}

// SyncHistoryOrderFee 同步历史订单费用
func (s *ShadowV1OrderService) SyncHistoryOrderFee(ctx context.Context, req *pb.SyncHistoryOrderFeeReq) (*pb.SyncHistoryOrderFeeReply, error) {
	return s.shadowV1OrderUseCase.SyncHistoryOrderFee(ctx, req)
}

// SyncDouYinCertificateId 同步抖音券ID
func (s *ShadowV1OrderService) SyncDouYinCertificateId(ctx context.Context, req *pb.SyncDouYinCertificateIdReq) (*pb.SyncDouYinCertificateIdReply, error) {
	return s.shadowV1OrderUseCase.SyncDouYinCertificateId(ctx, req)
}

// SyncWeiDianRefundAmount 同步微店退款金额
func (s *ShadowV1OrderService) SyncWeiDianRefundAmount(ctx context.Context, req *pb.SyncWeiDianRefundAmountReq) (*pb.SyncWeiDianRefundAmountReply, error) {
	return s.shadowV1OrderUseCase.SyncWeiDianRefundAmount(ctx, req)
}

// FixOrderData 修复订单数据
func (s *ShadowV1OrderService) FixOrderData(ctx context.Context, req *pb.FixOrderDataReq) (*pb.FixOrderDataReply, error) {
	return s.shadowV1OrderUseCase.FixOrderData(ctx, req)
}

// FixRefundAmount 修复退款数据
func (s *ShadowV1OrderService) FixRefundAmount(ctx context.Context, req *pb.FixRefundAmountReq) (*pb.FixRefundAmountReply, error) {
	return s.shadowV1OrderUseCase.FixRefundAmount(ctx, req)
}

// SyncDouYinOrder 同步抖音订单
func (s *ShadowV1OrderService) SyncDouYinOrder(ctx context.Context, req *pb.SyncDouYinOrderReq) (*pb.SyncDouYinOrderReply, error) {
	return s.shadowV1OrderUseCase.SyncDouYinOrder(ctx, req)
}

// RetryFailedOrderCallback 重试失败的订单回调
func (s *ShadowV1OrderService) RetryFailedOrderCallback(ctx context.Context, req *pb.RetryFailedOrderCallbackReq) (*pb.RetryFailedOrderCallbackReply, error) {
	return s.shadowV1OrderUseCase.RetryFailedOrderCallback(ctx, req)
}
