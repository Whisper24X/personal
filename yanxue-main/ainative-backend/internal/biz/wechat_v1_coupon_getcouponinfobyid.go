package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetCouponInfoById 查询优惠券信息
func (w *WechatV1CouponUseCase) GetCouponInfoById(ctx context.Context, req *pb.GetCouponInfoByIdReq) (*pb.GetCouponInfoByIdReply, error) {
	resp := &pb.GetCouponInfoByIdReply{}
	coupon, err := w.couponRepo.FindOneCacheByID(ctx, req.CouponId)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.CouponInfo = &pb.CouponInfo{
		Id:              coupon.ID,
		Name:            coupon.Name,
		DiscountAmount:  coupon.DiscountAmount,
		PushType:        coupon.PushType,
		CouponType:      coupon.CouponType,
		MinAmount:       coupon.MinAmount,
		ValidStartTime:  TransTimeToRFC3339(coupon.ValidStartTime),
		ValidEndTime:    TransTimeToRFC3339(coupon.ValidEndTime),
		ClaimStartTime:  TransTimeToRFC3339(coupon.ClaimStartTime),
		ClaimEndTime:    TransTimeToRFC3339(coupon.ClaimEndTime),
		LimitPerUser:    coupon.LimitPerUser,
		CouponValidDays: coupon.CouponValidDays,
	}
	return resp, nil
}
