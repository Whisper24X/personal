package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetCouponList 优惠券表-列表数据查询
func (s *ShadowV1CouponUseCase) GetCouponList(ctx context.Context, req *pb.GetCouponListReq) (*pb.GetCouponListReply, error) {
	// 参数验证
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// 构建查询条件
	conditionReq := &condition.Req{
		Page:     req.Page,
		PageSize: req.PageSize,
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}

	// 添加查询条件
	if req.Name != "" {
		conditionReq.Query = append(conditionReq.Query, &condition.QueryParam{
			Field: "name",
			Value: "%" + req.Name + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}

	if req.PushType != "" {
		conditionReq.Query = append(conditionReq.Query, &condition.QueryParam{
			Field: "pushType",
			Value: req.PushType,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	if req.Status != "" {
		conditionReq.Query = append(conditionReq.Query, &condition.QueryParam{
			Field: "status",
			Value: req.Status,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 查询数据
	coupons, reply, err := s.couponRepo.FindMultiByCondition(ctx, conditionReq)
	if err != nil {
		s.log.Errorf("GetCouponList failed: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 转换为响应格式
	resp := &pb.GetCouponListReply{
		Total: reply.Total,
		List:  make([]*pb.CouponInfo, 0, len(coupons)),
	}

	// 转换每个优惠券信息
	for _, coupon := range coupons {
		info := &pb.CouponInfo{
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
		}

		// 处理适用商品信息
		if coupon.AdaptGoodInfo != nil {
			var adaptGoodInfo []string
			err = jsonutil.Unmarshal(coupon.AdaptGoodInfo, &adaptGoodInfo)
			if err != nil {
				return resp, errorx.DataFormattingError.WithError(err).Err()
			}
			info.AdaptGoodInfo = adaptGoodInfo
		}

		resp.List = append(resp.List, info)
	}

	return resp, nil
}
