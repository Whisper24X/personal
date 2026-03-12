package biz

import (
	"context"
	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"sort"
	"time"
)

// GetMyCouponList 用户优惠券记录表-查询我的优惠券列表
func (w *WechatV1UserCouponUseCase) GetMyCouponList(ctx context.Context, req *pb.GetMyCouponListReq) (*pb.GetMyCouponListReply, error) {
	resp := &pb.GetMyCouponListReply{}
	userId := meta.GetUserID(ctx)
	coupons, err := w.userCouponRepo.FindMultiByUserID(ctx, userId)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 按照领取时间倒序排列（最后领取的放最前面）
	sort.Slice(coupons, func(i, j int) bool {
		return coupons[i].ClaimTime.After(coupons[j].ClaimTime)
	})

	var couponIds []string
	for _, coupon := range coupons {
		couponIds = append(couponIds, coupon.CouponID)
	}
	// 查询优惠券信息
	couponIdToItemMap := make(map[string]*yanxue_model.Coupon)
	couponList, err := w.couponRepo.FindMultiCacheByIDS(ctx, couponIds)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询商品价格
	var goodPrice float64
	if req.GetGoodId() != "" {
		goodInfo, err := w.goodRepo.FindOneCacheByID(ctx, req.GetGoodId())
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		goodPrice = goodInfo.Price
	}

	now := time.Now()
	for _, coupon := range couponList {
		// 如果有指定商品，需要校验商品的价格是否能达到门槛值
		if req.GetGoodId() != "" {
			// 低于门槛值，则不返回
			if goodPrice < float64(coupon.MinAmount) {
				continue
			}
		}
		// 如果是通用券，不管有没有传入商品ID都加入
		if coupon.CouponType == string(constant.CouponTypeCommon) {
			couponIdToItemMap[coupon.ID] = coupon
			continue
		} else if coupon.CouponType == string(constant.CouponTypeGood) { // 商品券
			// 如果传入商品ID，则需要过滤
			if req.GetGoodId() != "" {
				var adaptGoodInfo []string
				err = jsonutil.Unmarshal(coupon.AdaptGoodInfo, &adaptGoodInfo)
				if err != nil {
					return resp, errorx.DataFormattingError.WithError(err).Err()
				}
				_, exist := lo.Find(adaptGoodInfo, func(item string) bool {
					return item == req.GetGoodId()
				})
				if exist { // 在可用商品列表中，则加入
					couponIdToItemMap[coupon.ID] = coupon
				}
			} else { // 如果没有传入商品ID，直接加入
				couponIdToItemMap[coupon.ID] = coupon
			}
		}
	}
	for _, coupon := range coupons {
		couponItem := couponIdToItemMap[coupon.CouponID]
		if couponItem == nil {
			continue
		}
		// 如果不在优惠券使用时间范围内，则将状态设置为已过期
		if (!couponItem.ValidStartTime.IsZero() && couponItem.ValidStartTime.After(now)) ||
			(!couponItem.ValidEndTime.IsZero() && couponItem.ValidEndTime.Before(now)) {
			coupon.Status = string(constant.UserCouponStatusExpired)
		}
		// 如果已过期，设置状态
		if coupon.ExpireTime.Before(now) {
			coupon.Status = string(constant.UserCouponStatusExpired)
		}
		resp.List = append(resp.List, &pb.MyCouponItem{
			Id:             coupon.ID,
			UserId:         coupon.UserID,
			CouponId:       coupon.CouponID,
			CouponName:     coupon.CouponName,
			Status:         coupon.Status,
			PushType:       coupon.PushType,
			ClaimTime:      TransTimeToRFC3339(coupon.ClaimTime),
			ExpireTime:     TransTimeToRFC3339(coupon.ExpireTime),
			UseTime:        TransTimeToRFC3339(coupon.UseTime),
			DiscountAmount: couponItem.DiscountAmount,
			CouponType:     couponItem.CouponType,
			MinAmount:      couponItem.MinAmount,
		})
	}
	return resp, nil
}
