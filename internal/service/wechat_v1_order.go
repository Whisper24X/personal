package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/transport/http"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewWechatV1OrderService(
	logger log.Logger,
	wechatV1OrderUseCase *biz.WechatV1OrderUseCase,
) *WechatV1OrderService {
	l := log.NewHelper(log.With(logger, "module", "service/wechatV1Order"), log.WithMessageKey("message"))
	return &WechatV1OrderService{
		log:                  l,
		wechatV1OrderUseCase: wechatV1OrderUseCase,
	}
}

type WechatV1OrderService struct {
	pb.UnimplementedOrderServer
	log                  *log.Helper
	wechatV1OrderUseCase *biz.WechatV1OrderUseCase
}

// GetOrderList 订单-获取用户订单列表
func (w *WechatV1OrderService) GetOrderList(ctx context.Context, req *pb.GetOrderListReq) (*pb.GetOrderListReply, error) {
	return w.wechatV1OrderUseCase.GetOrderList(ctx, req)
}

// GetOrderGoodInfo 订单-获取订单商品详情
func (w *WechatV1OrderService) GetOrderGoodInfo(ctx context.Context, req *pb.GetOrderGoodInfoReq) (*pb.GetOrderGoodInfoReply, error) {
	return w.wechatV1OrderUseCase.GetOrderGoodInfo(ctx, req)
}

// CreateMiniProgramOrder 订单-创建小程序订单
func (w *WechatV1OrderService) CreateMiniProgramOrder(ctx context.Context, req *pb.CreateMiniProgramOrderReq) (*pb.CreateMiniProgramOrderReply, error) {
	return w.wechatV1OrderUseCase.CreateMiniProgramOrder(ctx, req)
}

// GetOrderPaymentInfo 订单-查询订单支付信息
func (w *WechatV1OrderService) GetOrderPaymentInfo(ctx context.Context, req *pb.GetOrderPaymentInfoReq) (*pb.GetOrderPaymentInfoReply, error) {
	return w.wechatV1OrderUseCase.GetOrderPaymentInfo(ctx, req)
}

// CreateWechatPaymentOrder 订单-发起微信支付
func (w *WechatV1OrderService) CreateWechatPaymentOrder(ctx context.Context, req *pb.CreateWechatPaymentOrderReq) (*pb.CreateWechatPaymentOrderReply, error) {
	return w.wechatV1OrderUseCase.CreateWechatPaymentOrder(ctx, req)
}

// GetOrderPaymentStatus 订单-查询订单支付状态
func (w *WechatV1OrderService) GetOrderPaymentStatus(ctx context.Context, req *pb.GetOrderPaymentStatusReq) (*pb.GetOrderPaymentStatusReply, error) {
	return w.wechatV1OrderUseCase.GetOrderPaymentStatus(ctx, req)
}

// WechatPayPaidNotify 支付-支付回调通知
func (w *WechatV1OrderService) WechatPayPaidNotify(wr http.ResponseWriter, r *http.Request) {
	w.wechatV1OrderUseCase.WechatPayPaidNotify(wr, r)
}

// WechatPayRefundNotify 支付-退款回调通知
func (w *WechatV1OrderService) WechatPayRefundNotify(wr http.ResponseWriter, r *http.Request) {
	w.wechatV1OrderUseCase.WechatPayRefundNotify(wr, r)
}

// UpdateOrderStatus 订单-更改订单状态
func (w *WechatV1OrderService) UpdateOrderStatus(ctx context.Context, req *pb.UpdateOrderStatusReq) (*pb.UpdateOrderStatusReply, error) {
	return w.wechatV1OrderUseCase.UpdateOrderStatus(ctx, req)
}
