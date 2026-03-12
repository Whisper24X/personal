package biz

import (
	"context"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetUserCouponList 用户优惠券记录表-列表数据查询
func (s *ShadowV1UserCouponUseCase) GetUserCouponList(ctx context.Context, req *pb.GetUserCouponListReq) (*pb.GetUserCouponListReply, error) {
	resp := &pb.GetUserCouponListReply{}
	page := int32(1)
	pageSize := int32(10)
	if req.GetPage() > 0 {
		page = req.GetPage()
	}
	if req.GetPageSize() > 0 {
		pageSize = req.GetPageSize()
	}

	param := &condition.Req{
		Page:     page,
		PageSize: pageSize,
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}

	// 状态筛选
	if req.GetStatus() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "status",
			Value: req.GetStatus(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 优惠券名称模糊查询
	if req.GetCouponName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "couponName",
			Value: "%" + req.GetCouponName() + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}

	// 手机号精确查询
	if req.GetPhone() != "" {
		// 手机号加密
		ph, err := cryptutil.YcPhoneEncrypt(req.GetPhone())
		if err != nil {
			return resp, errorx.ParamPhoneInvalid.Err()
		}
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "ph",
			Value: ph,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	// 领取时间范围查询
	if req.GetClaimStartTime() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "claimTime",
			Value: timeutil.Carbon().Parse(req.GetClaimStartTime()).StartOfDay().ToStdTime(),
			Exp:   condition.GTE,
			Logic: condition.AND,
		})
	}

	if req.GetClaimEndTime() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "claimTime",
			Value: timeutil.Carbon().Parse(req.GetClaimEndTime()).EndOfDay().ToStdTime(),
			Exp:   condition.LTE,
			Logic: condition.AND,
		})
	}

	// 过期时间范围查询
	if req.GetExpireTimeStartTime() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "expireTime",
			Value: timeutil.Carbon().Parse(req.GetExpireTimeStartTime()).StartOfDay().ToStdTime(),
			Exp:   condition.GTE,
			Logic: condition.AND,
		})
	}

	if req.GetExpireTimeEndTime() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "expireTime",
			Value: timeutil.Carbon().Parse(req.GetExpireTimeEndTime()).EndOfDay().ToStdTime(),
			Exp:   condition.LTE,
			Logic: condition.AND,
		})
	}

	// 查询数据
	userCoupons, reply, err := s.userCouponRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		s.log.Errorf("GetUserCouponList failed: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 转换为响应格式
	resp = &pb.GetUserCouponListReply{
		Total: reply.Total,
		List:  make([]*pb.UserCouponInfo, 0, len(userCoupons)),
	}

	// 转换每个用户优惠券信息
	for _, userCoupon := range userCoupons {
		phone, err := cryptutil.YcPhoneDecrypt(userCoupon.Ph)
		if err != nil {
			return resp, errors.New(500, "-1", "解析联系方式失败！")
		}

		info := &pb.UserCouponInfo{
			Id:          userCoupon.ID,
			UserId:      userCoupon.UserID,
			CouponId:    userCoupon.CouponID,
			CouponName:  userCoupon.CouponName,
			Status:      userCoupon.Status,
			Ph:          phone,
			PushType:    userCoupon.PushType,
			ClaimTime:   userCoupon.ClaimTime.Format(time.RFC3339),
			ExpireTime:  userCoupon.ExpireTime.Format(time.RFC3339),
			OrderNumber: userCoupon.OrderNumber,
			CreatedAt:   userCoupon.CreatedAt.Format(time.RFC3339),
			UpdatedAt:   userCoupon.UpdatedAt.Format(time.RFC3339),
		}

		// 处理使用时间
		if !userCoupon.UseTime.IsZero() {
			info.UseTime = userCoupon.UseTime.Format(time.RFC3339)
		}

		resp.List = append(resp.List, info)
	}

	return resp, nil
}
