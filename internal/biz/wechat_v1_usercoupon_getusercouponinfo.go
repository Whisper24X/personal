package biz

import (
	"context"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetUserCouponInfo 用户优惠券记录表-通过用户优惠券ID查询用户优惠券信息
func (w *WechatV1UserCouponUseCase) GetUserCouponInfo(ctx context.Context, req *pb.GetUserCouponInfoReq) (*pb.GetUserCouponInfoReply, error) {
	resp := &pb.GetUserCouponInfoReply{}
	// 查询用户优惠券信息
	userCoupon, err := w.userCouponRepo.FindOneCacheByID(ctx, req.UserCouponId)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if userCoupon == nil || userCoupon.ID == "" {
		return resp, nil
	}
	// 查询优惠券信息
	coupon, err := w.couponRepo.FindOneCacheByID(ctx, userCoupon.CouponID)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if coupon == nil || coupon.ID == "" {
		return resp, nil
	}
	resp.CouponInfo = &pb.MyCouponItem{
		Id:             userCoupon.ID,
		UserId:         userCoupon.UserID,
		CouponId:       userCoupon.CouponID,
		CouponName:     userCoupon.CouponName,
		Status:         userCoupon.Status,
		PushType:       userCoupon.PushType,
		ClaimTime:      userCoupon.ClaimTime.Format(time.RFC3339),
		ExpireTime:     userCoupon.ExpireTime.Format(time.RFC3339),
		UseTime:        userCoupon.UseTime.Format(time.RFC3339),
		DiscountAmount: coupon.DiscountAmount,
		CouponType:     coupon.CouponType,
		MinAmount:      coupon.MinAmount,
	}

	return resp, nil
}
