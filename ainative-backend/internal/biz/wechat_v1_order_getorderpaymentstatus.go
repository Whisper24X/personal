package biz

import (
	"context"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
)

// GetOrderPaymentStatus 订单-查询订单支付状态
func (w *WechatV1OrderUseCase) GetOrderPaymentStatus(ctx context.Context, req *pb.GetOrderPaymentStatusReq) (*pb.GetOrderPaymentStatusReply, error) {
	resp := &pb.GetOrderPaymentStatusReply{}
	orderInfo, err := w.orderRepo.FindOneCacheByID(ctx, req.GetOrderId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if orderInfo.Status != string(constant.OrderStatusPendingPayment) {
		resp.IsFinishPay = true
	}
	return resp, nil
}
