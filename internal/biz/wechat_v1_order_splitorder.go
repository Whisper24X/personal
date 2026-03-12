package biz

import (
	"context"
	"fmt"
	"strings"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// SplitOrderToSubOrders 拆分订单为子订单（微信小程序订单）
// 根据商品的所有商品类别中的 useTime 累加值，创建对应数量的子订单
// 金额平分到每个子订单，注意单位转换：父订单（元）-> 子订单（分）
func (w *WechatV1OrderUseCase) SplitOrderToSubOrders(ctx context.Context, orderId string) error {
	// 1. 查询父订单
	order, err := w.orderRepo.FindOneByID(ctx, orderId)
	if err != nil {
		w.log.Errorf("拆单失败：查询父订单失败，orderId=%s, err=%v", orderId, err)
		return errorx.DataSQLErr.WithError(err).Err()
	}

	if order == nil || order.ID == "" {
		w.log.Errorf("拆单失败：订单不存在，orderId=%s", orderId)
		return errorx.DataSQLErr.Err()
	}

	// 记录父订单的手机号信息
	w.log.Infof("拆单：查询父订单信息，orderId=%s, Ph=%s", orderId, order.Ph)

	// 2. 检查是否已经拆过单
	existingSubOrders, err := w.subOrderRepo.FindMultiCacheByParentOrderID(ctx, orderId)
	if err != nil {
		w.log.Errorf("拆单失败：查询子订单失败，orderId=%s, err=%v", orderId, err)
		return errorx.DataSQLErr.WithError(err).Err()
	}

	if len(existingSubOrders) > 0 {
		w.log.Infof("订单已经拆过单，跳过拆单，orderId=%s, 子订单数=%d", orderId, len(existingSubOrders))
		return nil
	}

	// 3. 查询商品信息
	goodInfo, err := w.goodRepo.FindOneCacheByID(ctx, order.GoodID)
	if err != nil {
		w.log.Errorf("拆单失败：查询商品失败，orderId=%s, goodId=%s, err=%v", orderId, order.GoodID, err)
		return errorx.DataSQLErr.WithError(err).Err()
	}

	if goodInfo == nil || goodInfo.ID == "" {
		w.log.Errorf("拆单失败：商品不存在，orderId=%s, goodId=%s", orderId, order.GoodID)
		return errorx.DataSQLErr.Err()
	}

	// 4. 解析商品内容，计算总 useTimes
	content := &pb.GoodContent{}
	err = jsonutil.Unmarshal(goodInfo.Content, content)
	if err != nil {
		w.log.Errorf("拆单失败：解析商品内容失败，orderId=%s, goodId=%s, err=%v", orderId, order.GoodID, err)
		return errorx.DataFormattingError.WithError(err).Err()
	}

	totalUseTimes := int32(0)
	for _, category := range content.GoodCategories {
		totalUseTimes += category.UseTimes
	}

	// 如果 useTimes 为 0，不需要拆单
	if totalUseTimes <= 0 {
		w.log.Infof("订单不需要拆单，orderId=%s, totalUseTimes=%d", orderId, totalUseTimes)
		return nil
	}

	// 查询商品类型
	platformGoodIdToGoodTypeMap, err := w.platformGoodRepo.PlatformGoodIdToGoodType(ctx, []string{goodInfo.PlatformGoodID})
	if err != nil {
		w.log.Errorf("拆单失败：查询商品类型失败，orderId=%s, platformGoodId=%s, err=%v", orderId, goodInfo.PlatformGoodID, err)
		return errorx.DataSQLErr.WithError(err).Err()
	}
	goodType := platformGoodIdToGoodTypeMap[goodInfo.PlatformGoodID]

	// 5. 计算每个子订单的金额（单位转换：元 -> 分）
	// 父订单金额（元）* 100 = 总金额（分）
	totalAmountInCents := int32(order.OrderPrice*100 + 0.5) // 元转分，四舍五入
	// 优惠金额（分）
	totalDiscountInCents := order.DiscountAmount
	// 退款金额（分）
	totalRefundAmountInCents := order.RefundAmount
	// 平台手续费（分）
	totalPlatformFeeInCents := order.PlatformFee
	// 达人佣金（分）
	totalTalentCommissionInCents := order.TalentCommission
	// 实收金额（分）
	totalReceiptAmountInCents := order.ReceiptAmount
	// 平台优惠（分）
	totalPlatformDiscountInCents := order.PlatformDiscountAmount
	// 支付优惠（分）
	totalPaymentDiscountInCents := order.PaymentDiscountAmount
	// 店铺优惠（分）
	totalShopDiscountInCents := order.ShopDiscountAmount
	// 保险费（分）
	totalActualInsuredInCents := order.ActualInsured

	// 平均分配，最后一个子订单补齐差额
	avgAmountPerSubOrder := totalAmountInCents / totalUseTimes
	avgDiscountPerSubOrder := totalDiscountInCents / totalUseTimes
	avgRefundAmountPerSubOrder := totalRefundAmountInCents / totalUseTimes
	avgPlatformFeePerSubOrder := totalPlatformFeeInCents / totalUseTimes
	avgTalentCommissionPerSubOrder := totalTalentCommissionInCents / totalUseTimes
	avgReceiptAmountPerSubOrder := totalReceiptAmountInCents / totalUseTimes
	avgPlatformDiscountPerSubOrder := totalPlatformDiscountInCents / totalUseTimes
	avgPaymentDiscountPerSubOrder := totalPaymentDiscountInCents / totalUseTimes
	avgShopDiscountPerSubOrder := totalShopDiscountInCents / totalUseTimes
	avgActualInsuredPerSubOrder := totalActualInsuredInCents / totalUseTimes

	w.log.Infof("开始拆单，orderId=%s, totalUseTimes=%d, totalAmount=%d分, avgAmount=%d分, totalDiscount=%d分, avgDiscount=%d分",
		orderId, totalUseTimes, totalAmountInCents, avgAmountPerSubOrder, totalDiscountInCents, avgDiscountPerSubOrder)

	// 6. 创建子订单列表
	subOrders := make([]*yanxue_model.SubOrder, 0, totalUseTimes)

	for i := int32(0); i < totalUseTimes; i++ {
		subOrderAmount := avgAmountPerSubOrder
		subOrderDiscount := avgDiscountPerSubOrder
		subOrderRefundAmount := avgRefundAmountPerSubOrder
		subOrderPlatformFee := avgPlatformFeePerSubOrder
		subOrderTalentCommission := avgTalentCommissionPerSubOrder
		subOrderReceiptAmount := avgReceiptAmountPerSubOrder
		subOrderPlatformDiscount := avgPlatformDiscountPerSubOrder
		subOrderPaymentDiscount := avgPaymentDiscountPerSubOrder
		subOrderShopDiscount := avgShopDiscountPerSubOrder
		subOrderActualInsured := avgActualInsuredPerSubOrder

		// 最后一个子订单补齐差额
		if i == totalUseTimes-1 {
			subOrderAmount = totalAmountInCents - (avgAmountPerSubOrder * (totalUseTimes - 1))
			subOrderDiscount = totalDiscountInCents - (avgDiscountPerSubOrder * (totalUseTimes - 1))
			subOrderRefundAmount = totalRefundAmountInCents - (avgRefundAmountPerSubOrder * (totalUseTimes - 1))
			subOrderPlatformFee = totalPlatformFeeInCents - (avgPlatformFeePerSubOrder * (totalUseTimes - 1))
			subOrderTalentCommission = totalTalentCommissionInCents - (avgTalentCommissionPerSubOrder * (totalUseTimes - 1))
			subOrderReceiptAmount = totalReceiptAmountInCents - (avgReceiptAmountPerSubOrder * (totalUseTimes - 1))
			subOrderPlatformDiscount = totalPlatformDiscountInCents - (avgPlatformDiscountPerSubOrder * (totalUseTimes - 1))
			subOrderPaymentDiscount = totalPaymentDiscountInCents - (avgPaymentDiscountPerSubOrder * (totalUseTimes - 1))
			subOrderShopDiscount = totalShopDiscountInCents - (avgShopDiscountPerSubOrder * (totalUseTimes - 1))
			subOrderActualInsured = totalActualInsuredInCents - (avgActualInsuredPerSubOrder * (totalUseTimes - 1))
		}

		// 生成子订单号：判断父订单号最后一个-后面是否是纯数字
		// 如果是纯数字（如832357255360145-2），说明已有后缀，直接追加
		// 如果不是纯数字（如f987db00-e5ba-4c0e-983c-a69f6a107d00或832357255360145），说明无后缀，加-1-前缀
		var subOrderNumber string
		hasNumericSuffix := false
		if lastDashIndex := strings.LastIndex(order.OrderNumber, "-"); lastDashIndex != -1 {
			suffix := order.OrderNumber[lastDashIndex+1:]
			// 检查后缀是否是纯数字
			isNumeric := true
			for _, ch := range suffix {
				if ch < '0' || ch > '9' {
					isNumeric = false
					break
				}
			}
			hasNumericSuffix = isNumeric && len(suffix) > 0
		}

		if hasNumericSuffix {
			// 父订单已有数字后缀，直接追加子订单索引
			subOrderNumber = fmt.Sprintf("%s-%d", order.OrderNumber, i+1)
		} else {
			// 父订单无数字后缀，加-1-前缀
			subOrderNumber = fmt.Sprintf("%s-1-%d", order.OrderNumber, i+1)
		}

		subOrder := &yanxue_model.SubOrder{
			ParentOrderID:          order.ID,
			ChannelID:              order.ChannelID,
			GoodID:                 order.GoodID,
			ChannelGoodID:          order.ChannelGoodID,
			OrderNumber:            subOrderNumber,
			OrderPrice:             subOrderAmount,           // 单位：分
			DiscountAmount:         subOrderDiscount,         // 单位：分
			RefundAmount:           subOrderRefundAmount,     // 单位：分
			PlatformFee:            subOrderPlatformFee,      // 单位：分
			TalentCommission:       subOrderTalentCommission, // 单位：分
			ReceiptAmount:          subOrderReceiptAmount,    // 单位：分
			PlatformDiscountAmount: subOrderPlatformDiscount, // 单位：分
			PaymentDiscountAmount:  subOrderPaymentDiscount,  // 单位：分
			ShopDiscountAmount:     subOrderShopDiscount,     // 单位：分
			ActualInsured:          subOrderActualInsured,    // 单位：分
			PaymentTime:            order.PaymentTime,
			Ph:                     order.Ph,                            // 从父订单继承手机号（加密后的），确保赋值
			Status:                 string(constant.OrderStatusPending), // 待预约
			OriginOrderNumber:      order.OrderNumber,
			ParentRemark:           order.ParentRemark,
			PaymentDeadline:        order.PaymentDeadline,
			UserCouponID:           order.UserCouponID,
			PayID:                  order.PayID,
			GoodType:               goodType, // 商品类型，从 platformGood 获取
			RefundID:               order.RefundID,
			RefundReason:           order.RefundReason,
			RefundTime:             order.RefundTime,
			CampTime:               "",                                  // 预约时填写
			ServiceStatus:          string(constant.OrderStatusPending), // 待预约
			TalentUID:              order.TalentUID,                     // 继承父订单的达人UID
			TalentName:             order.TalentName,                    // 继承父订单的达人名称
		}

		// 记录子订单的手机号赋值情况
		if i == 0 {
			w.log.Infof("拆单：子订单手机号赋值，orderId=%s, 父订单Ph=%s, 子订单Ph=%s", orderId, order.Ph, subOrder.Ph)
		}

		subOrders = append(subOrders, subOrder)
	}

	// 7. 批量创建子订单
	err = w.subOrderRepo.CreateBatchCache(ctx, subOrders, 100)
	if err != nil {
		w.log.Errorf("拆单失败：创建子订单失败，orderId=%s, err=%v", orderId, err)
		return errorx.DataSQLErr.WithError(err).Err()
	}

	w.log.Infof("订单拆分成功，orderId=%s, 拆分为 %d 个子订单", orderId, totalUseTimes)
	return nil
}
