package biz

import (
	"context"
	"time"

	"github.com/samber/lo"
	"github.com/spf13/cast"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetGoodInfo 渠道商品表-单条数据查询
func (w *WechatV1GoodUseCase) GetGoodInfo(ctx context.Context, req *pb.GetGoodInfoReq) (*pb.GetGoodInfoReply, error) {
	resp := &pb.GetGoodInfoReply{}
	good, err := w.goodRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 查询平台商品信息
	platformGood, err := w.platformGoodRepo.FindOneCacheByID(ctx, good.PlatformGoodID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if platformGood == nil || platformGood.ID == "" {
		return resp, errorx.DataRecordNotFound.Err()
	}
	resp.Info = &pb.GoodInfo{
		Id:                    good.ID,
		Name:                  good.Name,
		Price:                 int32(good.Price*100 + 0.5), // 数据库存储的是元，转换为分返回给前端，四舍五入
		Status:                good.Status,
		AppointmentRules:      good.AppointmentRules,
		ChannelGoodId:         good.ChannelGoodID,
		PlatformGoodId:        good.PlatformGoodID,
		ChannelId:             good.ChannelID,
		IsPushAppointmentInfo: good.IsPushAppointmentInfo,
		GoodType:              platformGood.GoodType,
		PurchaseAgreementName: good.PurchaseAgreementName,
		PurchaseAgreementLink: good.PurchaseAgreementLink,
	}
	var mainImage []string
	err = jsonutil.Unmarshal(good.MainImage, &mainImage)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	resp.Info.MainImage = mainImage

	var detailImages []string
	err = jsonutil.Unmarshal(good.DetailImages, &detailImages)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	resp.Info.DetailImages = detailImages

	goodContent := &pb.GoodContent{}
	err = jsonutil.Unmarshal(good.Content, goodContent)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}

	courseIds := make([]string, 0)
	for _, goodCategory := range goodContent.GoodCategories {
		for _, v := range goodCategory.Courses {
			if v.CourseId != "" {
				courseIds = append(courseIds, v.CourseId)
			}
		}
	}
	courseList, err := w.courseRepo.FindMultiCacheByIDS(ctx, courseIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	courseIdToCourseName := make(map[string]string)
	courseIdToPrice := make(map[string]float32)
	courseIdToCourseType := make(map[string]string)
	courseIdToIsPushContractRequired := make(map[string]bool)
	for _, course := range courseList {
		courseIdToCourseName[course.ID] = course.CourseName
		courseIdToPrice[course.ID] = course.Price
		courseIdToCourseType[course.ID] = course.CourseType
		courseIdToIsPushContractRequired[course.ID] = course.IsPushContractRequired
	}

	// 将课程信息填充到商品内容中
	for k, goodCategory := range goodContent.GoodCategories {
		for kk, course := range goodCategory.Courses {
			goodContent.GoodCategories[k].Courses[kk].CourseName = courseIdToCourseName[course.CourseId]
			goodContent.GoodCategories[k].Courses[kk].CoursePrice = cast.ToString(courseIdToPrice[course.CourseId])
			goodContent.GoodCategories[k].Courses[kk].CourseType = courseIdToCourseType[course.CourseId]
			goodContent.GoodCategories[k].Courses[kk].IsPushContractRequired = courseIdToIsPushContractRequired[course.CourseId]
		}
	}

	resp.Info.Content = goodContent

	// 计算用户可用的最大优惠金额
	maxDiscountAmount := w.calculateMaxDiscountAmount(ctx, req.GetId(), good.Price)
	resp.Info.MaxDiscountAmount = maxDiscountAmount

	var label []string
	if len(good.Label) > 0 && string(good.Label) != "null" {
		err = jsonutil.Unmarshal(good.Label, &label)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
	}
	resp.Info.Label = label

	return resp, nil
}

// calculateMaxDiscountAmount 计算用户可用于当前商品的最大优惠金额
func (w *WechatV1GoodUseCase) calculateMaxDiscountAmount(ctx context.Context, goodId string, goodPrice float64) int32 {
	// 获取用户ID
	userId := meta.GetUserID(ctx)
	if userId == "" {
		// 未登录用户，返回0
		return 0
	}

	// 查询用户所有优惠券
	userCoupons, err := w.userCouponRepo.FindMultiCacheByUserID(ctx, userId)
	if err != nil {
		w.log.Errorf("查询用户优惠券失败: userId=%s, err=%v", userId, err)
		return 0
	}

	if len(userCoupons) == 0 {
		return 0
	}

	// 提取所有优惠券ID
	couponIds := make([]string, 0, len(userCoupons))
	for _, userCoupon := range userCoupons {
		couponIds = append(couponIds, userCoupon.CouponID)
	}

	// 批量查询优惠券详情
	coupons, err := w.couponRepo.FindMultiCacheByIDS(ctx, couponIds)
	if err != nil {
		w.log.Errorf("查询优惠券详情失败: couponIds=%v, err=%v", couponIds, err)
		return 0
	}

	// 创建优惠券ID到优惠券的映射
	couponMap := make(map[string]*yanxue_model.Coupon)
	for _, coupon := range coupons {
		couponMap[coupon.ID] = coupon
	}

	now := time.Now()
	maxDiscount := int32(0)

	// 遍历用户优惠券，找出可用于当前商品的最大优惠金额
	for _, userCoupon := range userCoupons {
		// 只处理未核销的优惠券
		if userCoupon.Status != string(constant.UserCouponStatusUnUsed) {
			continue
		}

		// 检查是否过期
		if !userCoupon.ExpireTime.IsZero() && userCoupon.ExpireTime.Before(now) {
			continue
		}

		// 获取优惠券详情
		coupon, exists := couponMap[userCoupon.CouponID]
		if !exists || coupon == nil {
			continue
		}

		// 检查优惠券是否在有效期内
		if !coupon.ValidStartTime.IsZero() && !coupon.ValidEndTime.IsZero() {
			if coupon.ValidStartTime.After(now) || coupon.ValidEndTime.Before(now) {
				continue
			}
		}

		// 检查商品价格是否达到优惠券门槛
		if goodPrice < float64(coupon.MinAmount) {
			continue
		}

		// 判断优惠券类型
		if coupon.CouponType == string(constant.CouponTypeCommon) {
			// 通用券，可用于所有商品
			if coupon.DiscountAmount > maxDiscount {
				maxDiscount = coupon.DiscountAmount
			}
		} else if coupon.CouponType == string(constant.CouponTypeGood) {
			// 商品券，需要检查是否适用于当前商品
			var adaptGoodIds []string
			if len(coupon.AdaptGoodInfo) > 0 {
				err := jsonutil.Unmarshal(coupon.AdaptGoodInfo, &adaptGoodIds)
				if err != nil {
					w.log.Errorf("解析优惠券适用商品信息失败: couponId=%s, err=%v", coupon.ID, err)
					continue
				}
			}

			// 检查当前商品是否在适用商品列表中
			_, isApplicable := lo.Find(adaptGoodIds, func(item string) bool {
				return item == goodId
			})

			if isApplicable && coupon.DiscountAmount > maxDiscount {
				maxDiscount = coupon.DiscountAmount
			}
		}
	}

	return maxDiscount
}
