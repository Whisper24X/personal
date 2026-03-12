package biz

import (
	"context"
	"github.com/go-kratos/kratos/v2/errors"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"net/http"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
)

// UpdateOrderStatus 订单-更改订单状态
func (w *WechatV1OrderUseCase) UpdateOrderStatus(ctx context.Context, req *pb.UpdateOrderStatusReq) (*pb.UpdateOrderStatusReply, error) {
	resp := &pb.UpdateOrderStatusReply{}
	if req.GetStatus() != string(constant.OrderStatusClosed) {
		return resp, errors.New(http.StatusBadRequest, "-1", "退款状态错误！只允许订单关闭状态！")
	}
	orderInfo, err := w.orderRepo.FindOneCacheByID(ctx, req.GetOrderId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	oldOrderInfo := w.orderRepo.DeepCopy(orderInfo)
	orderInfo.Status = req.GetStatus()
	err = w.orderRepo.UpdateOneCache(ctx, orderInfo, oldOrderInfo)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	// 如果使用了优惠券，需要解锁
	if orderInfo.UserCouponID != "" {
		// 订单关闭，解锁优惠券
		userCoupon, err := w.userCouponRepo.FindOneCacheByID(ctx, orderInfo.UserCouponID)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		oldUserCoupon := w.userCouponRepo.DeepCopy(userCoupon)
		userCoupon.Status = string(constant.UserCouponStatusUnUsed)
		err = w.userCouponRepo.UpdateOneCache(ctx, userCoupon, oldUserCoupon)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
	}
	return resp, nil
}
