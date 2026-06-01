package biz

import (
	"context"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// ExpireUserCoupons 过期用户优惠券状态更新
func (s *ShadowV1UserCouponUseCase) ExpireUserCoupons(ctx context.Context, req *pb.ExpireUserCouponsReq) (*pb.ExpireUserCouponsReply, error) {
	resp := &pb.ExpireUserCouponsReply{}
	// 使用分布式锁防止重复执行
	err := s.commonRepo.LockOnce(ctx, cache.ExpireUserCouponsLock.Key(), cache.ExpireUserCouponsLock.TTL(), func() error {
		// 查询状态为未核销(unUsed)且已过期的用户优惠券
		// 构建查询条件：状态为未核销且过期时间小于当前时间的优惠券
		now := time.Now()
		param := &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "status",
					Value: string(constant.UserCouponStatusUnUsed),
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
				{
					Field: "expireTime",
					Value: now,
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

		// 查询符合条件的用户优惠券
		userCouponList, _, err := s.userCouponRepo.FindMultiByCondition(ctx, param)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}

		// 如果没有需要处理的优惠券，直接返回
		if len(userCouponList) == 0 {
			s.log.Info("没有需要处理的过期用户优惠券")
			return nil
		}

		s.log.Infof("共找到 %d 个需要处理的过期用户优惠券", len(userCouponList))

		// 批量更新用户优惠券状态为已过期
		var userCouponIds []string
		for _, userCoupon := range userCouponList {
			userCouponIds = append(userCouponIds, userCoupon.ID)
		}

		// 更新用户优惠券状态
		updateData := map[string]interface{}{
			"status": string(constant.UserCouponStatusExpired),
		}

		err = s.userCouponRepo.UpdateBatchByIDS(ctx, userCouponIds, updateData)
		if err != nil {
			s.log.Errorf("更新用户优惠券状态失败！优惠券ID列表：%v, err: %v", userCouponIds, err)
			return errorx.DataSQLErr.WithError(err).Err()
		}

		s.log.Infof("成功更新 %d 个用户优惠券状态为已过期", len(userCouponList))

		return nil
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}
