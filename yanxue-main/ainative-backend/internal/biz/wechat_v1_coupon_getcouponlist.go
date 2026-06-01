package biz

import (
	"context"
	"time"

	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

func TransTimeToRFC3339(t time.Time) string {
	// 检查时间是否为零值或数据库默认值（1970-01-01）
	// IsZero() 检查 Unix 时间戳是否为 0（对应 1970-01-01 00:00:00 UTC）
	// 数据库默认值 '1970-01-01 08:00:00+08' 在转换为 UTC 时就是 1970-01-01 00:00:00 UTC
	// 明确检查 Unix 时间戳是否为 0，确保能正确识别数据库默认值
	if t.IsZero() || t.Unix() == 0 {
		return ""
	}
	return t.Format(time.RFC3339)
}

// GetCouponList 优惠券表-列表数据查询
func (w *WechatV1CouponUseCase) GetCouponList(ctx context.Context, req *pb.GetCouponListReq) (*pb.GetCouponListReply, error) {
	resp := &pb.GetCouponListReply{}
	userId := meta.GetUserID(ctx)
	// 先获取所有优惠券
	param := &condition.Req{
		Query: []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}

	// 查询已上架并且当前时间在可领取时间范围内的优惠券
	param.Query = append(param.Query, &condition.QueryParam{
		Field: "status",
		Value: string(constant.CouponStatusPutOn),
		Exp:   condition.EQ,
		Logic: condition.AND,
	})
	now := time.Now()

	coupons, _, err := w.couponRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	var validCouponList []*yanxue_model.Coupon

	// 查询商品价格
	var goodPrice float64
	if req.GetGoodId() != "" {
		goodInfo, err := w.goodRepo.FindOneCacheByID(ctx, req.GetGoodId())
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		goodPrice = goodInfo.Price
	}

	for _, coupon := range coupons {
		// 如果不在优惠券领取时间范围内，则过滤掉
		if !coupon.ClaimStartTime.IsZero() && !coupon.ClaimEndTime.IsZero() &&
			(coupon.ClaimStartTime.After(now) || coupon.ClaimEndTime.Before(now)) {
			continue
		}
		// 如果不在优惠券使用时间范围内，则过滤掉
		if !coupon.ValidStartTime.IsZero() && !coupon.ValidEndTime.IsZero() &&
			(coupon.ValidStartTime.After(now) || coupon.ValidEndTime.Before(now)) {
			continue
		}
		// 如果是私密推送的优惠券则过滤掉
		if coupon.PushType == string(constant.CouponPushTypePrivate) {
			continue
		}
		// 如果有指定商品，需要校验商品的价格是否能达到门槛值
		if req.GetGoodId() != "" {
			// 低于门槛值，则不返回
			if goodPrice < float64(coupon.MinAmount) {
				continue
			}
		}
		// 如果是通用券则直接添加
		if coupon.CouponType == string(constant.CouponTypeCommon) {
			validCouponList = append(validCouponList, coupon)
			continue
		}
		// 如果是商品券，则需要判断优惠券适用商品中是否包含
		if coupon.CouponType == string(constant.CouponTypeGood) {
			// 指定商品的优惠券，需要过滤
			if req.GetGoodId() != "" {
				var adaptGoodInfo []string
				err = jsonutil.Unmarshal(coupon.AdaptGoodInfo, &adaptGoodInfo)
				if err != nil {
					return resp, errorx.DataFormattingError.WithError(err).Err()
				}
				_, exist := lo.Find(adaptGoodInfo, func(item string) bool {
					return item == req.GetGoodId()
				})
				if exist {
					validCouponList = append(validCouponList, coupon)
				}
			} else { // 没有指定商品，则可以直接添加
				validCouponList = append(validCouponList, coupon)
			}
		}
	}

	// 查询用户已领取的优惠券信息
	userCoupons, err := w.userCouponRepo.FindMultiByUserID(ctx, userId)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 记录用户已领取但没有使用并且没有过期的优惠券
	userCouponUnUseCountMap := make(map[string]int)
	userCouponClaimCountMap := make(map[string]int)
	for _, userCoupon := range userCoupons {
		if userCoupon.Status == string(constant.UserCouponStatusUnUsed) &&
			userCoupon.ExpireTime.After(now) {
			userCouponUnUseCountMap[userCoupon.CouponID]++
		}
		userCouponClaimCountMap[userCoupon.CouponID]++
	}

	var couponIds []string
	for _, coupon := range validCouponList {
		couponIds = append(couponIds, coupon.ID)
	}
	couponCountMap, err := w.userCouponRepo.CountByCouponID(ctx, couponIds, "")
	if err != nil {
		return resp, err
	}
	// 如果是商品优惠券，过滤出用户手头上可以使用在这个商品上的优惠券和用户可以领取的使用在这个商品上的优惠券
	for _, coupon := range validCouponList {
		userCouponUnUseCount := int32(userCouponUnUseCountMap[coupon.ID])
		userCouponClaimCount := int32(userCouponClaimCountMap[coupon.ID])
		// 已发放数量
		claimCouponCount := couponCountMap[coupon.ID]
		// 如果发放数量已达到总额度，并且没有已领取但未使用的优惠券，则不返回
		if int32(claimCouponCount) >= coupon.TotalStock && userCouponUnUseCount == 0 {
			continue
		}
		// 如果指定商品，则需要展示可以领取的，和已领取未用完的优惠券
		if req.GetGoodId() != "" {
			if userCouponClaimCount >= coupon.LimitPerUser && userCouponUnUseCount == 0 {
				continue
			}
		} else { // 如果没有指定商品，则只展示可以领取的
			if userCouponClaimCount >= coupon.LimitPerUser {
				continue
			}
		}

		resp.List = append(resp.List, &pb.CouponInfo{
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
			ReceivedCount:   userCouponClaimCount,
		})
	}

	return resp, nil
}
