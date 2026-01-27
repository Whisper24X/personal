package biz

import (
	"context"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetOrderPaymentInfo 订单-查询订单支付信息
func (w *WechatV1OrderUseCase) GetOrderPaymentInfo(ctx context.Context, req *pb.GetOrderPaymentInfoReq) (*pb.GetOrderPaymentInfoReply, error) {
	resp := &pb.GetOrderPaymentInfoReply{}

	// 查询订单信息
	orderList, err := w.orderRepo.FindMultiByOriginOrderNumber(ctx, req.GetOrderId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	if len(orderList) == 0 {
		return resp, errorx.OrderNotExists.WithFmtMsg(req.GetOrderId()).Err()
	}
	order := orderList[0]

	// 查询商品信息
	good, err := w.goodRepo.FindOneCacheByID(ctx, order.GoodID)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 检查商品是否存在
	if good == nil || good.ID == "" {
		return resp, errorx.GoodNotExists.WithFmtMsg(order.GoodID).Err()
	}

	// 解析商品主图
	var mainImages []string
	if len(good.MainImage) > 0 {
		_ = jsonutil.Unmarshal(good.MainImage, &mainImages)
	}

	// 组装响应数据
	resp = &pb.GetOrderPaymentInfoReply{
		GoodName:       good.Name,
		MainImage:      mainImages,
		GoodNums:       int32(len(orderList)), // 购买商品数量
		OrderNumber:    order.OriginOrderNumber,
		PaymentAmount:  order.OrderPrice,
		PaymentTime:    order.PaymentTime.Format(time.RFC3339),
		DiscountAmount: order.DiscountAmount,
	}

	return resp, nil
}
