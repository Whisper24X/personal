package biz

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// CreateUserCoupon 用户优惠券记录表-创建一条数据
func (w *WechatV1UserCouponUseCase) CreateUserCoupon(ctx context.Context, req *pb.CreateUserCouponReq) (*pb.CreateUserCouponReply, error) {
	resp := &pb.CreateUserCouponReply{}
	userId := meta.GetUserID(ctx)
	// 查询优惠券信息
	coupon, err := w.couponRepo.FindOneCacheByID(ctx, req.CouponId)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 查询用户信息
	user, err := w.userRepo.FindOneCacheByID(ctx, userId)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 使用分布式锁处理并发领取问题
	lockKey := fmt.Sprintf("user_coupon:create:%s", req.CouponId)
	err = w.commonRepo.AutoLock(ctx, lockKey, time.Second*10, func() error {
		// 校验库存是否足够
		totalStock := coupon.TotalStock

		// 查询已领取的优惠券数量
		claimedCountMap, err := w.userCouponRepo.CountByCouponID(ctx, []string{req.CouponId}, "")
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		claimedCount := claimedCountMap[req.CouponId]

		// 检查库存是否足够
		if claimedCount >= int64(totalStock) {
			return errors.New(http.StatusConflict, "-1", "领取失败，券被抢光啦！")
		}

		// 校验是否在可领取时间范围内
		now := time.Now()
		if !coupon.ClaimStartTime.IsZero() && !coupon.ClaimEndTime.IsZero() &&
			(coupon.ClaimStartTime.After(now) || coupon.ClaimEndTime.Before(now)) {
			return errors.New(http.StatusConflict, "-1", "领取失败，券被抢光啦！")
		}

		// 校验是否已上架
		if coupon.Status != string(constant.CouponStatusPutOn) {
			return errors.New(http.StatusConflict, "-1", "领取失败，券被抢光啦！")
		}

		// 校验用户已领取的数量是否超过限制
		userCouponList, err := w.userCouponRepo.FindMultiByUserIDCouponID(ctx, userId, req.CouponId)
		if err != nil {
			return errors.New(http.StatusConflict, "-1", "领取失败，券被抢光啦！")
		}
		if len(userCouponList) >= int(coupon.LimitPerUser) {
			return errors.New(http.StatusConflict, "-1", "领取失败，券被抢光啦！")
		}

		// 创建用户优惠券记录
		userCoupon := &yanxue_model.UserCoupon{
			UserID:     userId,
			CouponID:   req.CouponId,
			CouponName: coupon.Name,
			Status:     string(constant.UserCouponStatusUnUsed), // 默认状态为未核销
			Ph:         user.Ph,                                 // 手机号
			PushType:   coupon.PushType,                         // 推送方式
			ClaimTime:  time.Now(),
		}

		if !coupon.ValidEndTime.IsZero() {
			userCoupon.ExpireTime = coupon.ValidEndTime
		} else {
			userCoupon.ExpireTime = time.Now().AddDate(0, 0, int(coupon.CouponValidDays))
		}

		// 保存到数据库
		err = w.userCouponRepo.CreateOneCache(ctx, userCoupon)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}

		resp.Id = userCoupon.ID
		return nil
	})

	if err != nil {
		return resp, err
	}

	return resp, nil
}
