package biz

import (
	"context"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"time"
)

// CloseExpiredOrders 请求-关闭超时未支付订单
func (s *ShadowV1OrderUseCase) CloseExpiredOrders(ctx context.Context, req *pb.CloseExpiredOrdersReq) (*pb.CloseExpiredOrdersReply, error) {
	resp := &pb.CloseExpiredOrdersReply{}

	// 构建查询条件：状态为待支付且支付截止时间已过期的订单
	param := &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "status",
				Value: string(constant.OrderStatusPendingPayment),
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
			{
				Field: "paymentDeadline",
				Value: time.Now(),
				Exp:   condition.LT,
				Logic: condition.AND,
			},
		},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.ASC,
			},
		},
	}

	// 查询超时未支付的订单
	orderList, _, err := s.orderRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 如果没有超时订单，直接返回
	if len(orderList) == 0 {
		resp.SuccessCount = 0
		return resp, nil
	}

	// 批量更新订单状态为交易关闭
	orderIds := make([]string, 0, len(orderList))
	for _, order := range orderList {
		orderIds = append(orderIds, order.ID)
	}

	// 更新订单状态
	updateData := map[string]interface{}{
		"status": string(constant.OrderStatusClosed),
	}

	err = s.orderRepo.UpdateBatchByIDS(ctx, orderIds, updateData)
	if err != nil {
		s.log.Errorf("订单状态关闭失败！订单ID列表：%v, err: %v", orderIds, err)
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 解锁优惠券
	var userCouponIds []string
	for _, order := range orderList {
		if order.UserCouponID != "" {
			userCouponIds = append(userCouponIds, order.UserCouponID)
		}
	}
	// 如果使用了优惠券，需要解锁
	if len(userCouponIds) > 0 {
		// 更新优惠券状态为未使用
		updateUserCouponData := map[string]interface{}{
			"status": string(constant.UserCouponStatusUnUsed),
		}
		err = s.userCouponRepo.UpdateBatchByIDS(ctx, userCouponIds, updateUserCouponData)
		if err != nil {
			s.log.Errorf("优惠券状态变更失败！优惠券ID列表：%v, err: %v", userCouponIds, err)
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
	}
	resp.SuccessCount = int32(len(orderList))
	s.log.Infof("成功关闭 %d 个超时未支付订单", len(orderList))

	return resp, nil
}
