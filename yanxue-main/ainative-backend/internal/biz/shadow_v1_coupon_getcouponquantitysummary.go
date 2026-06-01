package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetCouponQuantitySummary 优惠券表-查询优惠券数量信息
func (s *ShadowV1CouponUseCase) GetCouponQuantitySummary(ctx context.Context, req *pb.GetCouponQuantitySummaryReq) (*pb.GetCouponQuantitySummaryReply, error) {
	resp := &pb.GetCouponQuantitySummaryReply{}
	coupon, err := s.couponRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.TotalQuantity = coupon.TotalStock
	// 查询已领取优惠券数量
	receivedQuantityMap, err := s.userCouponRepo.CountByCouponID(ctx, []string{req.GetId()}, "")
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	receivedQuantity := receivedQuantityMap[req.GetId()]
	resp.ReceivedQuantity = int32(receivedQuantity)
	resp.RemainingQuantity = coupon.TotalStock - int32(receivedQuantity)
	// 查询已核销的优惠群数量
	usedQuantityMap, err := s.userCouponRepo.CountByCouponID(ctx, []string{req.GetId()}, string(constant.UserCouponStatusUsed))
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	usedQuantity := usedQuantityMap[req.GetId()]
	resp.UsedQuantity = int32(usedQuantity)
	return resp, nil
}
