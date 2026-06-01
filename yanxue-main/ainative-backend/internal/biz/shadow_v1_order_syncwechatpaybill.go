package biz

import (
	"context"
	"strings"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// OrderBillInfo 订单账单信息
type OrderBillInfo struct {
	TotalHandlingFee float64   // 总手续费
	HasRefund        bool      // 是否有退款账单
	BillCount        int       // 账单数量
	PayFee           float64   // 货款手续费
	RefundFee        float64   // 退款手续费
	PayTradeTime     time.Time // 货款交易时间（用于计算结算时间）
}

// SyncWechatPayBill 同步微信支付账单
// 优化逻辑：
// 1. 查询本月度内截止到昨天的所有交易日期（去重）
// 2. 计算本月第1天到昨天之间缺失的日期
// 3. 对缺失的日期进行数据同步
func (s *ShadowV1OrderUseCase) SyncWechatPayBill(ctx context.Context, req *pb.SyncWechatPayBillReq) (*pb.SyncWechatPayBillReply, error) {
	resp := &pb.SyncWechatPayBillReply{}

	// 使用分布式锁防止并发执行
	err := s.commonRepo.LockOnce(ctx, cache.SyncWechatPayBillLock.Key(), cache.SyncWechatPayBillLock.TTL(), func() error {
		now := time.Now()
		// 昨天的日期
		yesterday := now.AddDate(0, 0, -1)
		// 本月第一天（0点）
		firstDayOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		// 昨天的结束时间（23:59:59）
		yesterdayEnd := time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 23, 59, 59, 999999999, yesterday.Location())

		s.log.Infof("开始同步微信支付账单，查询时间范围：%s 至 %s",
			firstDayOfMonth.Format("2006-01-02"), yesterdayEnd.Format("2006-01-02"))

		// 查询本月已有的交易日期列表（去重）
		existingBills, err := s.wechatPayBillRepo.FindListByTradeTimeRange(ctx, firstDayOfMonth, yesterdayEnd)
		if err != nil {
			s.log.Errorf("查询已有交易日期失败: %v", err)
			return errorx.DataSQLErr.WithError(err).Err()
		}

		// 提取已有的日期列表（去重）
		existingDateMap := make(map[string]bool)
		for _, bill := range existingBills {
			dateStr := bill.TradeTime.Format("2006-01-02")
			existingDateMap[dateStr] = true
		}

		s.log.Infof("本月已有交易日期数量：%d", len(existingDateMap))

		// 计算本月第1天到昨天之间的所有日期
		var missingDates []string
		currentDate := firstDayOfMonth
		for currentDate.Before(now) || currentDate.Equal(yesterday) {
			dateStr := currentDate.Format("2006-01-02")
			// 如果该日期不在已有日期列表中，则认为是缺失的
			if !existingDateMap[dateStr] {
				missingDates = append(missingDates, dateStr)
			}
			// 移动到下一天
			currentDate = currentDate.AddDate(0, 0, 1)
		}

		if len(missingDates) == 0 {
			s.log.Infof("本月没有缺失的交易日期，无需同步")
			return nil
		}

		s.log.Infof("本月缺失的交易日期数量：%d，日期列表：%v", len(missingDates), missingDates)

		// 循环同步缺失日期的账单数据
		totalSyncedCount := 0
		successCount := 0
		failCount := 0

		for _, dateStr := range missingDates {
			s.log.Infof("开始同步日期 %s 的微信支付账单", dateStr)

			// 下载微信支付账单（带重试机制）
			var filePath string
			var err error
			maxRetries := 3
			retrySuccess := false

			for retry := 0; retry < maxRetries; retry++ {
				if retry > 0 {
					s.log.Warnf("下载日期 %s 的微信支付账单失败，进行第 %d 次重试", dateStr, retry)
					// 重试前等待一小段时间
					time.Sleep(time.Second * 2)
				}

				filePath, err = s.wechatPayRepo.WechatPayDownloadTradeBill(ctx, dateStr)
				if err == nil {
					retrySuccess = true
					break
				}

				// 如果是私钥解码错误，记录详细日志
				if strings.Contains(err.Error(), "decode private key") {
					s.log.Errorf("下载日期 %s 的微信支付账单失败（私钥解码错误），重试 %d/%d: %v",
						dateStr, retry+1, maxRetries, err)
				} else {
					s.log.Errorf("下载日期 %s 的微信支付账单失败，重试 %d/%d: %v",
						dateStr, retry+1, maxRetries, err)
				}
			}

			if !retrySuccess {
				s.log.Errorf("下载日期 %s 的微信支付账单最终失败（已重试 %d 次）: %v", dateStr, maxRetries, err)
				failCount++
				continue
			}

			s.log.Infof("下载日期 %s 的微信支付账单成功", dateStr)

			// 解析CSV文件
			billDataList, err := s.wechatPayRepo.ParseWechatPayBillFromCSV(ctx, filePath)
			if err != nil {
				s.log.Errorf("解析日期 %s 的微信支付账单失败: %v", dateStr, err)
				failCount++
				continue
			}

			// 如果该日期没有账单数据，跳过
			if len(billDataList) == 0 {
				s.log.Infof("日期 %s 没有微信支付账单数据", dateStr)
				successCount++
				continue
			}

			// 提取订单ID列表
			var orderIds []string
			for _, item := range billDataList {
				// 账单中的orderNumber对应的是orderId
				orderId, _ := StringToUUID(item.OrderNumber)
				orderIds = append(orderIds, orderId)
			}

			// 查询订单信息
			orderList, err := s.orderRepo.FindMultiByIDS(ctx, orderIds)
			if err != nil {
				s.log.Errorf("查询日期 %s 的订单信息失败: %v", dateStr, err)
				failCount++
				continue
			}

			orderIdToChannelOrderNumberMap := make(map[string]string)
			for _, order := range orderList {
				orderIdToChannelOrderNumberMap[UUIDTo32String(order.ID)] = order.OrderNumber
			}

			// 填充渠道订单编号
			for i := 0; i < len(billDataList); i++ {
				// 账单中的渠道订单编号对应order表的订单编号
				billDataList[i].ChannelOrderID = orderIdToChannelOrderNumberMap[billDataList[i].OrderNumber]
			}

			// 批量创建账单记录
			err = s.wechatPayBillRepo.CreateBatch(ctx, billDataList, 200)
			if err != nil {
				s.log.Errorf("创建日期 %s 的账单记录失败: %v", dateStr, err)
				failCount++
				continue
			}

			totalSyncedCount += len(billDataList)
			successCount++
			s.log.Infof("同步日期 %s 的微信支付账单成功，共 %d 条记录，进度=%d/%d",
				dateStr, len(billDataList), successCount+failCount, len(missingDates))
		}

		s.log.Infof("微信支付账单同步完成，总日期数=%d，成功=%d，失败=%d，总账单数=%d",
			len(missingDates), successCount, failCount, totalSyncedCount)

		return nil
	})

	if err != nil {
		return resp, err
	}

	return resp, nil
}

// updateOrderPlatformFee 更新父订单和子订单的平台手续费和结算时间
func (s *ShadowV1OrderUseCase) updateOrderPlatformFee(ctx context.Context, orderIdToHandlingFeeMap map[string]float64, orderNumberToBillInfoMap map[string]*OrderBillInfo, orderList []*yanxue_model.Order) error {
	// 构建 orderId -> orderNumber 映射
	orderIdToNumberMap := make(map[string]string)
	for _, order := range orderList {
		orderIdToNumberMap[order.ID] = order.OrderNumber
	}

	for orderId, handlingFee := range orderIdToHandlingFeeMap {
		// 手续费从元转换为分
		platformFeeInCents := int32(handlingFee*100 + 0.5) // 元转分，四舍五入

		// 更新父订单的平台手续费和结算时间
		order, err := s.orderRepo.FindOneByID(ctx, orderId)
		if err != nil {
			s.log.Errorf("查询订单失败，orderId=%s, err=%v", orderId, err)
			continue
		}

		oldOrder := s.orderRepo.DeepCopy(order)
		// 直接更新手续费（不再累加）
		oldPlatformFee := order.PlatformFee
		order.PlatformFee = platformFeeInCents

		// 更新结算时间：货款交易时间的T+1
		orderNumber := orderIdToNumberMap[orderId]
		if billInfo, exists := orderNumberToBillInfoMap[orderNumber]; exists && !billInfo.PayTradeTime.IsZero() {
			// 计算结算时间：交易时间T+1（加1天）
			settlementTime := billInfo.PayTradeTime.AddDate(0, 0, 1)
			order.SettlementTime = settlementTime
			s.log.Infof("更新订单结算时间，orderId=%s, 交易时间=%s, 结算时间=%s",
				orderId, billInfo.PayTradeTime.Format("2006-01-02 15:04:05"), settlementTime.Format("2006-01-02 15:04:05"))
		}

		err = s.orderRepo.UpdateOneCacheWithZero(ctx, order, oldOrder)
		if err != nil {
			s.log.Errorf("更新父订单手续费和结算时间失败，orderId=%s, err=%v", orderId, err)
			continue
		}

		s.log.Infof("更新父订单手续费成功，orderId=%s, 原手续费=%d分, 新手续费=%d分",
			orderId, oldPlatformFee, order.PlatformFee)

		// 查询该订单的所有子订单
		subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, orderId)
		if err != nil {
			s.log.Errorf("查询子订单失败，orderId=%s, err=%v", orderId, err)
			continue
		}

		if len(subOrders) == 0 {
			s.log.Warnf("订单没有子订单，orderId=%s", orderId)
			continue
		}

		// 使用父订单的手续费来平均分配到子订单
		totalPlatformFee := order.PlatformFee
		subOrderCount := int32(len(subOrders))
		avgPlatformFeePerSubOrder := totalPlatformFee / subOrderCount

		for i, subOrder := range subOrders {
			oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)
			subOrderPlatformFee := avgPlatformFeePerSubOrder

			// 最后一个子订单补齐差额
			if i == len(subOrders)-1 {
				subOrderPlatformFee = totalPlatformFee - (avgPlatformFeePerSubOrder * (subOrderCount - 1))
			}

			subOrder.PlatformFee = subOrderPlatformFee
			// 同步父订单的结算时间到子订单
			subOrder.SettlementTime = order.SettlementTime
			err = s.subOrderRepo.UpdateOneCacheWithZero(ctx, subOrder, oldSubOrder)
			if err != nil {
				s.log.Errorf("更新子订单手续费和结算时间失败，subOrderId=%s, err=%v", subOrder.ID, err)
				continue
			}

			s.log.Infof("更新子订单手续费和结算时间成功，subOrderId=%s, platformFee=%d分", subOrder.ID, subOrderPlatformFee)
		}
	}

	return nil
}

// SyncWechatPayBillPlatformFee 定时任务：同步微信支付账单手续费
// 优化逻辑：
// 1. 查询最近15天内的所有账单（货款 + 退款）
// 2. 按 ChannelOrderID 分组并累加手续费
// 3. 如果有退款账单，强制重新计算手续费
// 4. 如果没有退款账单，只更新手续费为空的订单
func (s *ShadowV1OrderUseCase) SyncWechatPayBillPlatformFee(ctx context.Context) error {
	// 使用分布式锁防止并发执行
	return s.commonRepo.LockOnce(ctx, cache.SyncWechatPayBillPlatformFeeLock.Key(), cache.SyncWechatPayBillPlatformFeeLock.TTL(), func() error {
		// 计算最近15天的时间范围
		now := time.Now()
		startTime := now.AddDate(0, 0, -15)
		// 设置为当天的开始时间（0点）
		startTime = time.Date(startTime.Year(), startTime.Month(), startTime.Day(), 0, 0, 0, 0, startTime.Location())
		// 结束时间为当前时间
		endTime := now

		s.log.Infof("开始同步微信支付账单手续费，查询时间范围：%s 至 %s", startTime.Format("2006-01-02 15:04:05"), endTime.Format("2006-01-02 15:04:05"))

		// 构建查询条件：同时查询货款和退款账单
		param := &condition.Req{
			Query: []*condition.QueryParam{},
			Order: []*condition.OrderParam{
				{
					Field: "tradeTime",
					Order: condition.DESC,
				},
			},
		}

		// 交易时间范围：最近15天
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "tradeTime",
			Value: startTime,
			Exp:   condition.GTE,
			Logic: condition.AND,
		})
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "tradeTime",
			Value: endTime,
			Exp:   condition.LTE,
			Logic: condition.AND,
		})

		// 手续费不为0
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "handlingFee",
			Value: 0,
			Exp:   condition.NEQ,
			Logic: condition.AND,
		})

		// 查询所有类型的账单（货款 + 退款）
		allBillList, _, err := s.wechatPayBillRepo.FindMultiByCondition(ctx, param)
		if err != nil {
			s.log.Errorf("查询微信支付账单失败: %v", err)
			return errorx.DataSQLErr.WithError(err).Err()
		}

		if len(allBillList) == 0 {
			s.log.Infof("未查询到符合条件的微信支付账单")
			return nil
		}

		s.log.Infof("查询到 %d 条符合条件的微信支付账单", len(allBillList))

		// 按 ChannelOrderID 分组账单
		// channelOrderId 对应 order 表的 orderNumber
		orderNumberToBillInfoMap := make(map[string]*OrderBillInfo)
		for _, bill := range allBillList {
			if bill.ChannelOrderID == "" || bill.HandlingFee == 0 {
				continue
			}

			if _, exists := orderNumberToBillInfoMap[bill.ChannelOrderID]; !exists {
				orderNumberToBillInfoMap[bill.ChannelOrderID] = &OrderBillInfo{
					TotalHandlingFee: 0,
					HasRefund:        false,
					BillCount:        0,
					PayFee:           0,
					RefundFee:        0,
					PayTradeTime:     time.Time{},
				}
			}

			info := orderNumberToBillInfoMap[bill.ChannelOrderID]
			info.TotalHandlingFee += bill.HandlingFee
			info.BillCount++

			// 判断是否是退款账单
			if bill.TransactionType == constant.TransactionTypeRefund {
				info.HasRefund = true
				info.RefundFee += bill.HandlingFee
			} else if bill.TransactionType == constant.TransactionTypePay {
				info.PayFee += bill.HandlingFee
				// 记录货款的交易时间（用于计算结算时间T+1）
				if info.PayTradeTime.IsZero() || bill.TradeTime.Before(info.PayTradeTime) {
					info.PayTradeTime = bill.TradeTime
				}
			}
		}

		if len(orderNumberToBillInfoMap) == 0 {
			s.log.Warnf("未找到有效的订单编号和手续费映射")
			return nil
		}

		s.log.Infof("找到 %d 个订单的账单信息", len(orderNumberToBillInfoMap))

		// 统计有退款账单的订单数量
		refundOrderCount := 0
		for _, info := range orderNumberToBillInfoMap {
			if info.HasRefund {
				refundOrderCount++
			}
		}
		s.log.Infof("其中有 %d 个订单包含退款账单，需要强制更新手续费", refundOrderCount)

		// 根据订单编号查询订单ID
		var orderNumbers []string
		for orderNumber := range orderNumberToBillInfoMap {
			orderNumbers = append(orderNumbers, orderNumber)
		}

		// 查询订单信息
		orderList, err := s.orderRepo.FindMultiByOrderNumbers(ctx, orderNumbers)
		if err != nil {
			s.log.Errorf("查询订单失败: %v", err)
			return errorx.DataSQLErr.WithError(err).Err()
		}

		// 构建订单ID到手续费的映射
		// 规则：
		// 1. 如果有退款账单，强制更新手续费（不管原手续费是否为0）
		// 2. 如果没有退款账单，只更新手续费为空的订单（PlatformFee == 0）
		orderIdToHandlingFeeMap := make(map[string]float64)
		skippedCount := 0
		forceUpdateCount := 0

		for _, order := range orderList {
			billInfo, exists := orderNumberToBillInfoMap[order.OrderNumber]
			if !exists {
				continue
			}

			// 如果有退款账单，强制更新手续费
			if billInfo.HasRefund {
				orderIdToHandlingFeeMap[order.ID] = billInfo.TotalHandlingFee
				forceUpdateCount++
				s.log.Infof("订单包含退款账单，强制更新手续费，orderId=%s, orderNumber=%s, "+
					"原手续费=%d分, 新手续费=%.2f元(%.0f分), 货款手续费=%.2f元, 退款手续费=%.2f元, 账单数=%d",
					order.ID, order.OrderNumber, order.PlatformFee,
					billInfo.TotalHandlingFee, billInfo.TotalHandlingFee*100,
					billInfo.PayFee, billInfo.RefundFee, billInfo.BillCount)
			} else {
				// 没有退款账单，只更新手续费为空的订单
				if order.PlatformFee != 0 {
					s.log.Infof("订单手续费已存在且无退款账单，跳过更新，orderId=%s, orderNumber=%s, existingPlatformFee=%d分",
						order.ID, order.OrderNumber, order.PlatformFee)
					skippedCount++
					continue
				}
				orderIdToHandlingFeeMap[order.ID] = billInfo.TotalHandlingFee
			}
		}

		if len(orderIdToHandlingFeeMap) == 0 {
			s.log.Warnf("未找到需要更新手续费的订单（已跳过 %d 个手续费不为空且无退款的订单）", skippedCount)
			return nil
		}

		s.log.Infof("准备更新 %d 个订单的手续费和结算时间（强制更新=%d，常规更新=%d，跳过=%d）",
			len(orderIdToHandlingFeeMap), forceUpdateCount, len(orderIdToHandlingFeeMap)-forceUpdateCount, skippedCount)

		// 更新父订单和子订单的手续费和结算时间
		err = s.updateOrderPlatformFee(ctx, orderIdToHandlingFeeMap, orderNumberToBillInfoMap, orderList)
		if err != nil {
			s.log.Errorf("更新订单手续费和结算时间失败: %v", err)
			return err
		}

		s.log.Infof("同步微信支付账单手续费和结算时间成功，共更新 %d 个订单", len(orderIdToHandlingFeeMap))
		return nil
	})
}
