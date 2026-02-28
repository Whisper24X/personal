package biz

import (
	"context"
	"sync"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

// SyncHistoryOrderFee 同步历史订单费用（异步处理）
func (s *ShadowV1OrderUseCase) SyncHistoryOrderFee(ctx context.Context, req *pb.SyncHistoryOrderFeeReq) (*pb.SyncHistoryOrderFeeReply, error) {
	resp := &pb.SyncHistoryOrderFeeReply{}

	// 异步执行同步任务
	go func() {
		// 使用 context.Background() 避免请求超时影响后台任务
		bgCtx := context.Background()

		s.log.Infof("SyncHistoryOrderFee: 开始异步同步历史订单费用")

		// 执行同步逻辑
		err := s.syncHistoryOrderFeeAsync(bgCtx)
		if err != nil {
			s.log.Errorf("SyncHistoryOrderFee: 异步同步失败, err=%v", err)
		} else {
			s.log.Infof("SyncHistoryOrderFee: 异步同步完成")
		}
	}()

	s.log.Infof("SyncHistoryOrderFee: 已启动异步任务")
	return resp, nil
}

// syncHistoryOrderFeeAsync 异步同步历史订单费用的具体实现
func (s *ShadowV1OrderUseCase) syncHistoryOrderFeeAsync(ctx context.Context) error {
	// 1. 查询所有渠道信息
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}

	// 构建渠道名称到ID的映射
	channelNameToIdMap := make(map[string]string)
	for _, channel := range channelList {
		channelNameToIdMap[channel.Name] = channel.ID
	}

	// 2. 查询2026年1月1日开始的所有订单
	startTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.Local)
	param := &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "createdAt",
				Value: startTime,
				Exp:   condition.GTE,
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

	orderList, _, err := s.orderRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}

	s.log.Infof("SyncHistoryOrderFee: 查询到订单总数=%d", len(orderList))

	// 3. 按渠道分类订单
	xcxChannelId := channelNameToIdMap[constant.ChannelTypeXCX]
	dyChannelId := channelNameToIdMap[constant.ChannelTypeDY]
	wdChannelId := channelNameToIdMap[constant.ChannelTypeWD]

	var xcxOrders, dyOrders, wdOrders []*yanxue_model.Order
	for _, order := range orderList {
		switch order.ChannelID {
		case xcxChannelId:
			xcxOrders = append(xcxOrders, order)
		case dyChannelId:
			dyOrders = append(dyOrders, order)
		case wdChannelId:
			wdOrders = append(wdOrders, order)
		}
	}

	s.log.Infof("SyncHistoryOrderFee: 小程序订单=%d, 抖音订单=%d, 微店订单=%d",
		len(xcxOrders), len(dyOrders), len(wdOrders))

	//// 4. 处理小程序订单
	//xcxSuccessCount, xcxFailCount := s.syncXCXOrderFee(ctx, xcxOrders)

	// 5. 处理抖音订单
	dySuccessCount, dyFailCount := s.syncDouYinOrderFee(ctx, dyOrders)

	//// 6. 重新赋值所有订单的子订单 orderPrice（修复浮点数精度问题）
	//s.log.Infof("SyncHistoryOrderFee: 开始重新赋值所有子订单的 orderPrice")
	//fixSuccessCount, fixFailCount := s.fixSubOrderPrice(ctx, orderList)

	s.log.Infof("SyncHistoryOrderFee: 同步完成, 抖音(成功=%d,失败=%d)",
		dySuccessCount, dyFailCount)
	//s.log.Infof("SyncHistoryOrderFee: 同步完成, 小程序(成功=%d,失败=%d), 抖音(成功=%d,失败=%d), 微店订单数=%d(不处理), 修复子订单orderPrice(成功=%d,失败=%d)",
	//	xcxSuccessCount, xcxFailCount, dySuccessCount, dyFailCount, len(wdOrders), fixSuccessCount, fixFailCount)

	return nil
}

// syncXCXOrderFee 同步小程序订单费用
// 小程序：将 discountAmount 的值赋值到 shopDiscountAmount
func (s *ShadowV1OrderUseCase) syncXCXOrderFee(ctx context.Context, orders []*yanxue_model.Order) (int, int) {
	successCount := 0
	failCount := 0

	for _, order := range orders {
		oldOrder := s.orderRepo.DeepCopy(order)

		// 小程序：将优惠金额（discountAmount）赋值给店铺优惠（shopDiscountAmount）
		order.ShopDiscountAmount = order.DiscountAmount

		err := s.orderRepo.UpdateOneCache(ctx, order, oldOrder)
		if err != nil {
			s.log.Errorf("SyncHistoryOrderFee: 更新小程序父订单失败, orderId=%s, err=%v", order.ID, err)
			failCount++
			continue
		}

		// 同步更新子订单
		err = s.syncXCXSubOrderFee(ctx, order)
		if err != nil {
			s.log.Errorf("SyncHistoryOrderFee: 同步小程序子订单失败, orderId=%s, err=%v", order.ID, err)
			failCount++
			continue
		}

		successCount++
	}

	s.log.Infof("SyncHistoryOrderFee: 小程序订单同步完成, 成功=%d, 失败=%d", successCount, failCount)
	return successCount, failCount
}

// syncXCXSubOrderFee 同步小程序子订单费用
func (s *ShadowV1OrderUseCase) syncXCXSubOrderFee(ctx context.Context, parentOrder *yanxue_model.Order) error {
	// 查询该父订单的所有子订单
	subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, parentOrder.ID)
	if err != nil {
		return err
	}

	if len(subOrders) == 0 {
		s.log.Infof("SyncHistoryOrderFee: 小程序父订单没有子订单, parentOrderId=%s", parentOrder.ID)
		return nil
	}

	subOrderCount := int32(len(subOrders))

	// 计算平均店铺优惠金额
	avgShopDiscountAmount := parentOrder.ShopDiscountAmount / subOrderCount

	// 并发更新所有子订单
	wg := &sync.WaitGroup{}
	wg.Add(len(subOrders))
	for i, subOrder := range subOrders {
		go func(index int, subOrder *yanxue_model.SubOrder) {
			defer wg.Done()

			oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)

			// 最后一个子订单补齐差额
			if index == len(subOrders)-1 {
				subOrder.ShopDiscountAmount = parentOrder.ShopDiscountAmount - (avgShopDiscountAmount * (subOrderCount - 1))
			} else {
				subOrder.ShopDiscountAmount = avgShopDiscountAmount
			}

			err := s.subOrderRepo.UpdateOneCache(context.Background(), subOrder, oldSubOrder)
			if err != nil {
				s.log.Errorf("SyncHistoryOrderFee: 更新小程序子订单失败, subOrderId=%s, err=%v", subOrder.ID, err)
			}
		}(i, subOrder)
	}

	wg.Wait()

	return nil
}

// syncDouYinOrderFee 同步抖音订单费用
// 抖音：赋值 platformDiscountAmount, paymentDiscountAmount, shopDiscountAmount, actualInsured 四个字段
func (s *ShadowV1OrderUseCase) syncDouYinOrderFee(ctx context.Context, orders []*yanxue_model.Order) (int, int) {
	successCount := 0
	failCount := 0

	for _, order := range orders {
		oldOrder := s.orderRepo.DeepCopy(order)

		// 1. 查询抖音订单信息
		orderInfoReply, err := s.httpRpc.QueryDouYinOrderInfo(ctx, &rpc.QueryDouYinOrderInfoReqParams{
			AccountId: constant.DouYinAccountId,
			OrderId:   order.OriginOrderNumber,
			PageNum:   1,
			PageSize:  100,
		})
		if err != nil {
			s.log.Errorf("SyncHistoryOrderFee: 查询抖音订单信息失败, orderId=%s, originOrderNumber=%s, err=%v",
				order.ID, order.OriginOrderNumber, err)
			failCount++
			continue
		}

		if len(orderInfoReply.Data.Orders) == 0 {
			s.log.Warnf("SyncHistoryOrderFee: 抖音订单信息为空, orderId=%s, originOrderNumber=%s",
				order.ID, order.OriginOrderNumber)
			failCount++
			continue
		}

		orderInfo := orderInfoReply.Data.Orders[0]

		// 2. 查询券信息，获取 platformDiscountAmount 和 paymentDiscountAmount
		certificateReply, err := s.httpRpc.QueryDouYinCertificate(ctx, &rpc.QueryDouYinCertificateReqParams{
			OrderId:   order.OriginOrderNumber,
			AccountId: constant.DouYinAccountId,
		})

		if err != nil {
			s.log.Errorf("SyncHistoryOrderFee: 查询抖音券状态失败, orderId=%s, err=%v", order.ID, err)
			failCount++
			continue
		}

		if len(certificateReply.Data.Certificates) == 0 {
			s.log.Warnf("SyncHistoryOrderFee: 抖音券信息为空, orderId=%s", order.ID)
			failCount++
			continue
		}

		// 累加所有券的平台优惠和支付优惠
		var totalPlatformDiscountAmount int64 = 0
		var totalPaymentDiscountAmount int64 = 0

		for _, cert := range certificateReply.Data.Certificates {
			totalPlatformDiscountAmount += cert.Amount.PlatformDiscountAmount
			totalPaymentDiscountAmount += cert.Amount.PaymentDiscountAmount
		}

		order.PlatformDiscountAmount = int32(totalPlatformDiscountAmount)
		order.PaymentDiscountAmount = int32(totalPaymentDiscountAmount)

		s.log.Infof("SyncHistoryOrderFee: 抖音订单平台优惠和支付优惠, orderId=%s, platformDiscountAmount=%d分, paymentDiscountAmount=%d分",
			order.ID, totalPlatformDiscountAmount, totalPaymentDiscountAmount)

		// 3. 查询分账信息，获取 shopDiscountAmount 和 actualInsured
		// 注意：分账信息可能查询不到，不应该影响平台优惠和支付优惠的更新
		ledgerQuerySuccess := false
		if len(orderInfo.Certificate) > 0 {
			var certificateIds []string
			for _, cert := range orderInfo.Certificate {
				if cert.CertificateId != "" {
					certificateIds = append(certificateIds, cert.CertificateId)
				}
			}

			if len(certificateIds) > 0 {
				ledgerReply, err := s.httpRpc.QueryDouYinLedgerRecordByCert(ctx, &rpc.QueryDouYinLedgerRecordByCertReqParams{
					CertificateIds: certificateIds,
				})

				if err != nil {
					s.log.Warnf("SyncHistoryOrderFee: 查询抖音分账信息失败（不影响平台优惠和支付优惠的更新）, orderId=%s, err=%v", order.ID, err)
				} else if len(ledgerReply.Data.Records) == 0 {
					s.log.Warnf("SyncHistoryOrderFee: 抖音分账记录为空（不影响平台优惠和支付优惠的更新）, orderId=%s", order.ID)
				} else {
					// 汇总所有分账记录的商家优惠（MerchantTicket）和保险费（ActualInsured）
					var totalMerchantTicket int64 = 0
					var totalActualInsured int64 = 0

					for _, record := range ledgerReply.Data.Records {
						totalMerchantTicket += record.Amount.MerchantTicket
						totalActualInsured += record.Amount.ActualInsured
					}

					order.ShopDiscountAmount = int32(totalMerchantTicket)
					order.ActualInsured = int32(totalActualInsured)
					ledgerQuerySuccess = true

					s.log.Infof("SyncHistoryOrderFee: 抖音订单商家优惠和保险费, orderId=%s, shopDiscountAmount=%d分, actualInsured=%d分",
						order.ID, totalMerchantTicket, totalActualInsured)
				}
			} else {
				s.log.Warnf("SyncHistoryOrderFee: 抖音订单没有有效的券ID（不影响平台优惠和支付优惠的更新）, orderId=%s", order.ID)
			}
		} else {
			s.log.Warnf("SyncHistoryOrderFee: 抖音订单没有券信息（不影响平台优惠和支付优惠的更新）, orderId=%s", order.ID)
		}

		// 记录分账信息查询结果
		if ledgerQuerySuccess {
			s.log.Infof("SyncHistoryOrderFee: 抖音订单费用同步完整（包含分账信息）, orderId=%s", order.ID)
		} else {
			s.log.Infof("SyncHistoryOrderFee: 抖音订单费用同步部分完成（仅平台优惠和支付优惠，分账信息未获取）, orderId=%s", order.ID)
		}

		// 4. 更新父订单
		err = s.orderRepo.UpdateOneCache(ctx, order, oldOrder)
		if err != nil {
			s.log.Errorf("SyncHistoryOrderFee: 更新抖音父订单失败, orderId=%s, err=%v", order.ID, err)
			failCount++
			continue
		}

		// 5. 同步更新子订单
		err = s.syncDouYinSubOrderFee(ctx, order)
		if err != nil {
			s.log.Errorf("SyncHistoryOrderFee: 同步抖音子订单失败, orderId=%s, err=%v", order.ID, err)
			failCount++
			continue
		}

		successCount++
	}

	s.log.Infof("SyncHistoryOrderFee: 抖音订单同步完成, 成功=%d, 失败=%d", successCount, failCount)
	return successCount, failCount
}

// syncDouYinSubOrderFee 同步抖音子订单费用
func (s *ShadowV1OrderUseCase) syncDouYinSubOrderFee(ctx context.Context, parentOrder *yanxue_model.Order) error {
	// 查询该父订单的所有子订单
	subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, parentOrder.ID)
	if err != nil {
		return err
	}

	if len(subOrders) == 0 {
		s.log.Infof("SyncHistoryOrderFee: 抖音父订单没有子订单, parentOrderId=%s", parentOrder.ID)
		return nil
	}

	subOrderCount := int32(len(subOrders))

	// 计算平均金额
	avgPlatformDiscountAmount := parentOrder.PlatformDiscountAmount / subOrderCount
	avgPaymentDiscountAmount := parentOrder.PaymentDiscountAmount / subOrderCount
	avgShopDiscountAmount := parentOrder.ShopDiscountAmount / subOrderCount
	avgActualInsured := parentOrder.ActualInsured / subOrderCount

	// 并发更新所有子订单
	wg := &sync.WaitGroup{}
	wg.Add(len(subOrders))
	for i, subOrder := range subOrders {
		go func(index int, subOrder *yanxue_model.SubOrder) {
			defer wg.Done()

			oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)

			// 最后一个子订单补齐差额
			if index == len(subOrders)-1 {
				subOrder.PlatformDiscountAmount = parentOrder.PlatformDiscountAmount - (avgPlatformDiscountAmount * (subOrderCount - 1))
				subOrder.PaymentDiscountAmount = parentOrder.PaymentDiscountAmount - (avgPaymentDiscountAmount * (subOrderCount - 1))
				subOrder.ShopDiscountAmount = parentOrder.ShopDiscountAmount - (avgShopDiscountAmount * (subOrderCount - 1))
				subOrder.ActualInsured = parentOrder.ActualInsured - (avgActualInsured * (subOrderCount - 1))
			} else {
				subOrder.PlatformDiscountAmount = avgPlatformDiscountAmount
				subOrder.PaymentDiscountAmount = avgPaymentDiscountAmount
				subOrder.ShopDiscountAmount = avgShopDiscountAmount
				subOrder.ActualInsured = avgActualInsured
			}

			err := s.subOrderRepo.UpdateOneCache(context.Background(), subOrder, oldSubOrder)
			if err != nil {
				s.log.Errorf("SyncHistoryOrderFee: 更新抖音子订单失败, subOrderId=%s, err=%v", subOrder.ID, err)
			}
		}(i, subOrder)
	}

	wg.Wait()

	return nil
}

// fixSubOrderPrice 修复所有子订单的 orderPrice（解决浮点数精度问题）
// 根据父订单的 orderPrice 重新计算并分配给子订单
func (s *ShadowV1OrderUseCase) fixSubOrderPrice(ctx context.Context, orders []*yanxue_model.Order) (int, int) {
	successCount := 0
	failCount := 0

	s.log.Infof("fixSubOrderPrice: 开始修复子订单 orderPrice，父订单总数=%d", len(orders))

	// 使用信号量控制并发数量，避免数据库压力过大
	const maxConcurrency = 10
	semaphore := make(chan struct{}, maxConcurrency)

	wg := &sync.WaitGroup{}
	var mu sync.Mutex // 保护计数器

	for orderIndex, order := range orders {
		wg.Add(1)
		semaphore <- struct{}{} // 获取信号量

		go func(index int, order *yanxue_model.Order) {
			defer func() {
				<-semaphore // 释放信号量
				wg.Done()
			}()

			// 查询该父订单的所有子订单
			subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(context.Background(), order.ID)
			if err != nil {
				s.log.Errorf("fixSubOrderPrice: 查询子订单失败, parentOrderId=%s, err=%v", order.ID, err)
				mu.Lock()
				failCount++
				mu.Unlock()
				return
			}

			if len(subOrders) == 0 {
				// 没有子订单，跳过
				return
			}

			// 计算父订单的 orderPrice 转换为分（使用四舍五入避免精度问题）
			parentOrderPriceInCents := int32(order.OrderPrice*100 + 0.5)

			// 计算平均分配给每个子订单的金额
			subOrderCount := int32(len(subOrders))
			avgOrderPricePerSubOrder := parentOrderPriceInCents / subOrderCount

			s.log.Infof("fixSubOrderPrice: [%d/%d] 父订单=%s, orderPrice=%.2f元=%d分, 子订单数=%d, 平均每个=%d分",
				index+1, len(orders), order.ID, order.OrderPrice, parentOrderPriceInCents, subOrderCount, avgOrderPricePerSubOrder)

			// 更新所有子订单
			updateFailed := false
			for i, subOrder := range subOrders {
				oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)

				// 最后一个子订单补齐差额，确保总和等于父订单金额
				if i == len(subOrders)-1 {
					subOrder.OrderPrice = parentOrderPriceInCents - (avgOrderPricePerSubOrder * (subOrderCount - 1))
				} else {
					subOrder.OrderPrice = avgOrderPricePerSubOrder
				}

				err := s.subOrderRepo.UpdateOneCache(context.Background(), subOrder, oldSubOrder)
				if err != nil {
					s.log.Errorf("fixSubOrderPrice: 更新子订单失败, subOrderId=%s, oldPrice=%d, newPrice=%d, err=%v",
						subOrder.ID, oldSubOrder.OrderPrice, subOrder.OrderPrice, err)
					updateFailed = true
				} else {
					s.log.Debugf("fixSubOrderPrice: 更新子订单成功, subOrderId=%s, oldPrice=%d分, newPrice=%d分",
						subOrder.ID, oldSubOrder.OrderPrice, subOrder.OrderPrice)
				}
			}

			mu.Lock()
			if updateFailed {
				failCount++
			} else {
				successCount++
			}
			mu.Unlock()

		}(orderIndex, order)
	}

	wg.Wait()
	close(semaphore)

	s.log.Infof("fixSubOrderPrice: 修复完成, 成功=%d, 失败=%d", successCount, failCount)
	return successCount, failCount
}
