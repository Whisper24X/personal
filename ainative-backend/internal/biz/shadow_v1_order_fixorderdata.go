package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

// FixOrderData 修复订单数据
// 查询线上订单数据，对有异常的数据进行修复
func (s *ShadowV1OrderUseCase) FixOrderData(ctx context.Context, req *pb.FixOrderDataReq) (*pb.FixOrderDataReply, error) {
	resp := &pb.FixOrderDataReply{}

	// 使用分布式锁检查是否有其他实例正在执行
	err := s.commonRepo.LockOnce(ctx, cache.FixOrderDataLock.Key(), cache.FixOrderDataLock.TTL(), func() error {
		// 异步执行修复任务，避免接口超时
		go func() {
			// 创建新的 context，避免使用原 ctx 导致超时
			asyncCtx := context.Background()
			s.fixOrderDataAsync(asyncCtx)
		}()

		s.log.Infof("FixOrderData: 任务已启动，正在后台异步执行")
		return nil
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}

// fixOrderDataAsync 异步修复订单数据的具体实现
func (s *ShadowV1OrderUseCase) fixOrderDataAsync(ctx context.Context) {
	s.log.Infof("FixOrderData: 开始修复订单优惠数据")

	// 1. 查询抖音渠道ID
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		s.log.Errorf("FixOrderData: 查询渠道列表失败, err=%v", err)
		return
	}

	var douYinChannelId string
	for _, channel := range channelList {
		if channel.Name == constant.ChannelTypeDY {
			douYinChannelId = channel.ID
			break
		}
	}

	if douYinChannelId == "" {
		s.log.Errorf("FixOrderData: 未找到抖音渠道")
		return
	}

	s.log.Infof("FixOrderData: 抖音渠道ID=%s", douYinChannelId)

	// 2. 查询需要修复的订单
	// 条件：
	// - 抖音渠道
	// - paymentTime >= '2026-01-01'
	// - (platformDiscountAmount is null or platformDiscountAmount = 0) and (paymentDiscountAmount is null or paymentDiscountAmount = 0)
	// - orderPrice != receiptAmount
	paymentTimeStart := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	// 分页查询，避免一次性加载过多数据
	const pageSize = 1000
	var allOrders []*yanxue_model.Order
	pageNum := int32(1)

	for {
		orders, reply, err := s.orderRepo.FindMultiByCondition(ctx, &condition.Req{
			Page:     pageNum,
			PageSize: pageSize,
			Query: []*condition.QueryParam{
				{
					Field: "channelId",
					Value: douYinChannelId,
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
				{
					Field: "paymentTime",
					Value: paymentTimeStart,
					Exp:   condition.GTE,
					Logic: condition.AND,
				},
			},
		})

		if err != nil {
			s.log.Errorf("FixOrderData: 查询订单失败, pageNum=%d, err=%v", pageNum, err)
			return
		}

		allOrders = append(allOrders, orders...)
		s.log.Infof("FixOrderData: 已查询订单数据, 当前页=%d, 当前页数量=%d, 累计数量=%d, 总数=%d",
			pageNum, len(orders), len(allOrders), reply.Total)

		// 如果已经查询完所有数据，退出循环
		if len(allOrders) >= int(reply.Total) {
			break
		}

		pageNum++
	}

	s.log.Infof("FixOrderData: 查询到抖音渠道订单，共%d条", len(allOrders))

	// 3. 过滤出需要修复的订单
	// (platformDiscountAmount is null or platformDiscountAmount = 0) and (paymentDiscountAmount is null or paymentDiscountAmount = 0)
	// orderPrice != receiptAmount
	var ordersNeedFix []*yanxue_model.Order
	for _, order := range allOrders {
		// 检查优惠金额是否为空或为0
		discountIsZero := (order.PlatformDiscountAmount == 0) && (order.PaymentDiscountAmount == 0)

		// 检查订单价格是否不等于实收金额
		// OrderPrice 是 float32，单位元；ReceiptAmount 是 int32，单位分
		orderPriceInCents := int32(order.OrderPrice*100 + 0.5) // 四舍五入转换为分
		priceNotMatch := orderPriceInCents != order.ReceiptAmount
		priceNotEqual := order.ReceiptAmount != orderPriceInCents+order.PlatformDiscountAmount+order.PaymentDiscountAmount

		if (discountIsZero && priceNotMatch) || priceNotEqual {
			ordersNeedFix = append(ordersNeedFix, order)
		}
	}

	s.log.Infof("FixOrderData: 过滤出需要修复的订单，共%d条", len(ordersNeedFix))

	if len(ordersNeedFix) == 0 {
		s.log.Infof("FixOrderData: 没有需要修复的订单")
		return
	}

	// 4. 串行处理订单，重新同步 receiptAmount, platformDiscountAmount, paymentDiscountAmount
	successCount := 0
	failCount := 0
	totalOrders := len(ordersNeedFix)
	processedOrders := 0

	for _, order := range ordersNeedFix {
		processedOrders++

		s.log.Infof("FixOrderData: 开始修复订单, orderId=%s, orderNumber=%s, originOrderNumber=%s, 进度=%d/%d",
			order.ID, order.OrderNumber, order.OriginOrderNumber, processedOrders, totalOrders)

		// 调用修复方法
		err := s.fixSingleOrderDiscountData(ctx, order)
		if err != nil {
			s.log.Errorf("FixOrderData: 修复订单失败, orderId=%s, orderNumber=%s, err=%v",
				order.ID, order.OrderNumber, err)
			failCount++
		} else {
			s.log.Infof("FixOrderData: 修复订单成功, orderId=%s, orderNumber=%s",
				order.ID, order.OrderNumber)
			successCount++
		}

		// 每处理50个订单输出一次进度
		if processedOrders%50 == 0 || processedOrders == totalOrders {
			s.log.Infof("FixOrderData: 处理进度 %d/%d (%.2f%%), 成功=%d, 失败=%d",
				processedOrders, totalOrders, float64(processedOrders)/float64(totalOrders)*100, successCount, failCount)
		}
	}

	s.log.Infof("FixOrderData: 订单优惠数据修复完成, 总数=%d, 成功=%d, 失败=%d", totalOrders, successCount, failCount)
}

// fixSingleOrderDiscountData 修复单个订单的优惠数据
func (s *ShadowV1OrderUseCase) fixSingleOrderDiscountData(ctx context.Context, order *yanxue_model.Order) error {
	// 1. 查询抖音订单信息
	orderInfoReply, err := s.httpRpc.QueryDouYinOrderInfo(ctx, &rpc.QueryDouYinOrderInfoReqParams{
		AccountId: constant.DouYinAccountId,
		OrderId:   order.OriginOrderNumber,
		PageNum:   1,
		PageSize:  100,
	})
	if err != nil {
		s.log.Errorf("FixOrderData: 查询抖音订单信息失败, orderId=%s, originOrderNumber=%s, err=%v",
			order.ID, order.OriginOrderNumber, err)
		return err
	}

	if len(orderInfoReply.Data.Orders) == 0 {
		s.log.Warnf("FixOrderData: 抖音订单信息为空, orderId=%s, originOrderNumber=%s",
			order.ID, order.OriginOrderNumber)
		return err
	}

	// 2. 查询券信息，获取 platformDiscountAmount 和 paymentDiscountAmount
	certificateReply, err := s.httpRpc.QueryDouYinCertificate(ctx, &rpc.QueryDouYinCertificateReqParams{
		OrderId:   order.OriginOrderNumber,
		AccountId: constant.DouYinAccountId,
	})

	if err != nil {
		s.log.Errorf("FixOrderData: 查询抖音券状态失败, orderId=%s, err=%v", order.ID, err)
		return err
	}

	if len(certificateReply.Data.Certificates) == 0 {
		s.log.Warnf("FixOrderData: 抖音券信息为空, orderId=%s", order.ID)
		return err
	}

	// 累加所有券的平台优惠和支付优惠
	var totalPlatformDiscountAmount int64 = 0
	var totalPaymentDiscountAmount int64 = 0

	for _, cert := range certificateReply.Data.Certificates {
		totalPlatformDiscountAmount += cert.Amount.PlatformDiscountAmount
		totalPaymentDiscountAmount += cert.Amount.PaymentDiscountAmount
	}

	// 3. 计算 receiptAmount（实收金额）
	// receiptAmount = 实付金额 + 平台优惠 + 支付优惠
	orderPriceInCents := int32(order.OrderPrice*100 + 0.5) // 实付金额，单位分
	receiptAmount := orderPriceInCents + int32(totalPlatformDiscountAmount) + int32(totalPaymentDiscountAmount)

	s.log.Infof("FixOrderData: 订单优惠数据, orderId=%s, orderPrice=%.2f元(%d分), platformDiscountAmount=%d分, paymentDiscountAmount=%d分, receiptAmount=%d分",
		order.ID, order.OrderPrice, orderPriceInCents, totalPlatformDiscountAmount, totalPaymentDiscountAmount, receiptAmount)

	// 4. 更新父订单
	oldOrder := s.orderRepo.DeepCopy(order)
	order.PlatformDiscountAmount = int32(totalPlatformDiscountAmount)
	order.PaymentDiscountAmount = int32(totalPaymentDiscountAmount)
	order.ReceiptAmount = receiptAmount

	err = s.orderRepo.UpdateOneCache(ctx, order, oldOrder)
	if err != nil {
		s.log.Errorf("FixOrderData: 更新父订单失败, orderId=%s, err=%v", order.ID, err)
		return err
	}

	s.log.Infof("FixOrderData: 更新父订单成功, orderId=%s, orderNumber=%s", order.ID, order.OrderNumber)

	// 5. 同步更新子订单
	subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, order.ID)
	if err != nil {
		s.log.Errorf("FixOrderData: 查询子订单失败, orderId=%s, err=%v", order.ID, err)
		return err
	}

	if len(subOrders) == 0 {
		s.log.Warnf("FixOrderData: 订单没有子订单, orderId=%s", order.ID)
		return nil
	}

	// 计算每个子订单的优惠金额和实收金额
	subOrderCount := int32(len(subOrders))
	avgPlatformDiscount := int32(totalPlatformDiscountAmount) / subOrderCount
	avgPaymentDiscount := int32(totalPaymentDiscountAmount) / subOrderCount
	avgReceipt := receiptAmount / subOrderCount

	s.log.Infof("FixOrderData: 子订单数量=%d, 平均平台优惠=%d分, 平均支付优惠=%d分, 平均实收=%d分",
		subOrderCount, avgPlatformDiscount, avgPaymentDiscount, avgReceipt)

	// 更新子订单
	for i, subOrder := range subOrders {
		oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)

		// 最后一个子订单补齐差额
		if i == len(subOrders)-1 {
			subOrder.PlatformDiscountAmount = int32(totalPlatformDiscountAmount) - (avgPlatformDiscount * (subOrderCount - 1))
			subOrder.PaymentDiscountAmount = int32(totalPaymentDiscountAmount) - (avgPaymentDiscount * (subOrderCount - 1))
			subOrder.ReceiptAmount = receiptAmount - (avgReceipt * (subOrderCount - 1))
		} else {
			subOrder.PlatformDiscountAmount = avgPlatformDiscount
			subOrder.PaymentDiscountAmount = avgPaymentDiscount
			subOrder.ReceiptAmount = avgReceipt
		}

		err := s.subOrderRepo.UpdateOneCache(ctx, subOrder, oldSubOrder)
		if err != nil {
			s.log.Errorf("FixOrderData: 更新子订单失败, subOrderId=%s, err=%v", subOrder.ID, err)
			continue
		}

		s.log.Infof("FixOrderData: 更新子订单成功, subOrderId=%s, subOrderNumber=%s, platformDiscount=%d分, paymentDiscount=%d分, receipt=%d分",
			subOrder.ID, subOrder.OrderNumber, subOrder.PlatformDiscountAmount, subOrder.PaymentDiscountAmount, subOrder.ReceiptAmount)
	}

	return nil
}
