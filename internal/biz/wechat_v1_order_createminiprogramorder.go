package biz

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	"github.com/google/uuid"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// UUIDTo32String 将 uuid格式的字符串类型转换为 32 个字符的字符串（无连字符）
func UUIDTo32String(id string) string {
	// 先获取标准格式的字符串（包含连字符），然后移除所有连字符
	return strings.ReplaceAll(id, "-", "")
}

// CreateMiniProgramOrder 订单-创建小程序订单
func (w *WechatV1OrderUseCase) CreateMiniProgramOrder(ctx context.Context, req *pb.CreateMiniProgramOrderReq) (*pb.CreateMiniProgramOrderReply, error) {
	resp := &pb.CreateMiniProgramOrderReply{}
	userId := meta.GetUserID(ctx)
	goodInfo, err := w.goodRepo.FindOneCacheByID(ctx, req.GetGoodId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	if goodInfo == nil || goodInfo.ID == "" {
		return resp, errors.New(http.StatusConflict, "-1", "商品不存在，无法购买！")
	}
	if goodInfo.Status != string(constant.GoodStatusPutOn) {
		return resp, errors.New(http.StatusConflict, "-1", "商品已下架，无法购买！")
	}

	// 使用分布式锁处理并发问题
	lockKey := fmt.Sprintf("wechat_miniProgram_order:create:%s", userId)
	err = w.commonRepo.AutoLock(ctx, lockKey, time.Second*10, func() error {
		// 计算商品总价格
		totalPrice := goodInfo.Price
		discountAmount := int32(0)
		// 如果使用了优惠券，需要锁定优惠券并且计算抵扣后的金额
		var userCouponInfo *yanxue_model.UserCoupon
		if req.GetUserCouponId() != "" {
			// 查询优惠券信息
			userCouponInfo, err = w.userCouponRepo.FindOneCacheByID(ctx, req.GetUserCouponId())
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			if userCouponInfo == nil || userCouponInfo.ID == "" {
				return errors.New(http.StatusConflict, "-1", "优惠券不存在，无法使用！")
			}
			// 校验是否在使用有效期内
			if userCouponInfo.ExpireTime.Before(time.Now()) {
				// 已过期，提示报错信息
				return errors.New(http.StatusConflict, "-1", "优惠券已过期，无法使用！")
			}
			// 校验优惠券是否是未使用的状态，只有未使用状态才可以用
			if userCouponInfo.Status != string(constant.UserCouponStatusUnUsed) {
				return errors.New(http.StatusConflict, "-1", "优惠券已无效，无法使用！")
			}
			// 锁定优惠券
			oldUserCouponInfo := w.userCouponRepo.DeepCopy(userCouponInfo)
			userCouponInfo.Status = string(constant.UserCouponStatusLocked)
			err = w.userCouponRepo.UpdateOneCache(ctx, userCouponInfo, oldUserCouponInfo)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			couponInfo, err := w.couponRepo.FindOneCacheByID(ctx, userCouponInfo.CouponID)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
			if couponInfo == nil || couponInfo.ID == "" {
				return errors.New(http.StatusConflict, "-1", "优惠券不存在，无法使用！")
			}
			// 计算优惠信息
			// 如果无门槛，则可以直接扣除，如果有门槛，需要看看是否达到门槛值
			if totalPrice-float64(couponInfo.MinAmount) >= 0 {
				discountAmount = couponInfo.DiscountAmount
			} else { // 如果达不到门槛值，则报错
				return errors.New(http.StatusConflict, "-1", "商品价格没有达到优惠券门槛，无法使用！")
			}
		}
		// 计算实际支付金额
		totalPrice = totalPrice - float64(discountAmount)
		// 兜底逻辑，最少需要支付一分钱
		if totalPrice <= 0 {
			totalPrice = 0.01
		}
		// 查询用户信息
		userInfo, err := w.userRepo.FindOneCacheByID(ctx, userId)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		// 查询渠道ID
		channelList, _, err := w.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		miniProgramChannelId := ""
		for _, channel := range channelList {
			if channel.Name == constant.ChannelTypeXCX {
				miniProgramChannelId = channel.ID
			}
		}
		// 生成订单编号（为了统一格式，加上-1后缀）
		originOrderNumber := uuid.New().String()
		orderNumber := fmt.Sprintf("%s-1", originOrderNumber)
		courseAppointmentDraft, err := jsonutil.Marshal(req.GetCourseAppointmentDraft())
		if err != nil {
			return errorx.DataFormattingError.WithError(err).Err()
		}
		// 设置支付截止时间为当前时间+10分钟
		paymentDeadline := time.Now().Add(10 * time.Minute)

		// 查询商品类型
		platformGoodIdToGoodTypeMap, err := w.platformGoodRepo.PlatformGoodIdToGoodType(ctx, []string{goodInfo.PlatformGoodID})
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		goodType := platformGoodIdToGoodTypeMap[goodInfo.PlatformGoodID]

		orderData := &yanxue_model.Order{
			GoodID:                 req.GoodId,
			ChannelGoodID:          req.GoodId, // 小程序的渠道商品ID和商品ID一致
			ChannelID:              miniProgramChannelId,
			OrderPrice:             float32(totalPrice),
			Status:                 string(constant.OrderStatusPendingPayment),
			OrderNumber:            orderNumber,
			OriginOrderNumber:      originOrderNumber,
			PaymentTime:            time.Time{},
			Ph:                     userInfo.Ph,
			ParentRemark:           req.ParentRemark,
			DiscountAmount:         discountAmount * 100, // 优惠金额转换为分
			ShopDiscountAmount:     discountAmount * 100, // 小程序的优惠金额同时赋值给店铺优惠
			CourseAppointmentDraft: courseAppointmentDraft,
			PaymentDeadline:        paymentDeadline,
			GoodType:               goodType, // 商品类型
		}
		if req.GetUserCouponId() != "" {
			orderData.UserCouponID = req.GetUserCouponId()
		}

		err = w.orderRepo.CreateOneCache(ctx, orderData)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		// 如果已经使用了优惠券，则需要变更优惠券的状态
		if discountAmount > 0 {
			oldUserCouponInfo := w.userCouponRepo.DeepCopy(userCouponInfo)
			userCouponInfo.Status = string(constant.UserCouponStatusUsed)
			userCouponInfo.OrderNumber = originOrderNumber
			userCouponInfo.UseTime = time.Now()
			err = w.userCouponRepo.UpdateOneCache(ctx, userCouponInfo, oldUserCouponInfo)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
		}
		resp.OrderId = orderData.ID
		return nil
	})
	if err != nil {
		return resp, err
	}

	return resp, nil
}
