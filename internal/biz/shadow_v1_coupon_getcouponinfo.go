package biz

import (
	"context"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

func TransTimeToStr(time time.Time) string {
	if time.IsZero() {
		return ""
	}
	return time.Format("2006-01-02 15:04:05")
}

// GetCouponInfo 优惠券表-单条数据查询
func (s *ShadowV1CouponUseCase) GetCouponInfo(ctx context.Context, req *pb.GetCouponInfoReq) (*pb.GetCouponInfoReply, error) {
	// 参数验证
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// 根据ID查询优惠券
	coupon, err := s.couponRepo.FindOneByID(ctx, req.Id)
	if err != nil {
		s.log.Errorf("GetCouponInfo failed: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 检查数据是否存在
	if coupon == nil {
		return nil, nil
	}

	// 转换为响应格式
	resp := &pb.GetCouponInfoReply{
		Info: &pb.CouponInfo{
			Id:              coupon.ID,
			Name:            coupon.Name,
			DiscountAmount:  coupon.DiscountAmount,
			PushType:        coupon.PushType,
			CouponType:      coupon.CouponType,
			MinAmount:       coupon.MinAmount,
			ValidStartTime:  TransTimeToStr(coupon.ValidStartTime),
			ValidEndTime:    TransTimeToStr(coupon.ValidEndTime),
			ClaimStartTime:  TransTimeToStr(coupon.ClaimStartTime),
			ClaimEndTime:    TransTimeToStr(coupon.ClaimEndTime),
			TotalStock:      coupon.TotalStock,
			LimitPerUser:    coupon.LimitPerUser,
			Remark:          coupon.Remark,
			ShareQRCode:     coupon.ShareQRCode,
			CouponValidDays: coupon.CouponValidDays,
			CreatedAt:       coupon.CreatedAt.Format(time.RFC3339),
			UpdatedAt:       coupon.UpdatedAt.Format(time.RFC3339),
			Status:          coupon.Status,
		},
	}

	var adaptGoodInfo []string
	if coupon.AdaptGoodInfo != nil {
		err = jsonutil.Unmarshal(coupon.AdaptGoodInfo, &adaptGoodInfo)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		resp.Info.AdaptGoodInfo = adaptGoodInfo
	}

	return resp, nil
}
