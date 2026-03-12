package biz

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

// SyncOrderSettlementTime 同步订单结算时间
// 根据渠道类型同步订单的结算时间
// - miniprogram: 小程序渠道，查询2026年1月1日之后的订单，从wechat_pay_bill表获取货款交易时间，计算T+1作为结算时间
// - douyin: 抖音渠道，查询2026年1月1日之后的订单，调用抖音接口查询券核销时间，计算核销时间+5天作为结算时间
// 异步执行，避免超时
func (s *ShadowV1OrderUseCase) SyncOrderSettlementTime(ctx context.Context, req *pb.SyncOrderSettlementTimeReq) (*pb.SyncOrderSettlementTimeReply, error) {
	resp := &pb.SyncOrderSettlementTimeReply{}

	// 使用分布式锁检查是否有其他实例正在执行（不同渠道使用不同的锁，支持并行执行）
	lockKey := cache.SyncOrderSettlementTimeLock.Key() + ":" + req.Channel
	err := s.commonRepo.LockOnce(ctx, lockKey, cache.SyncOrderSettlementTimeLock.TTL(), func() error {
		// 异步执行同步任务，避免接口超时
		go func() {
			// 创建新的 context，避免使用原 ctx 导致超时
			asyncCtx := context.Background()
			s.syncOrderSettlementTimeAsync(asyncCtx, req.Channel)
		}()

		s.log.Infof("SyncOrderSettlementTime: 任务已启动，正在后台异步执行，渠道=%s", req.Channel)
		return nil
	})

	if err != nil {
		return resp, err
	}

	return resp, nil
}

// syncOrderSettlementTimeAsync 异步同步订单结算时间
func (s *ShadowV1OrderUseCase) syncOrderSettlementTimeAsync(ctx context.Context, channel string) {
	resp := &pb.SyncOrderSettlementTimeReply{}

	var err error
	switch channel {
	case "miniprogram":
		err = s.syncMiniProgramOrderSettlementTime(ctx, resp)
	case "douyin":
		err = s.syncDouYinOrderSettlementTime(ctx, resp)
	default:
		s.log.Errorf("不支持的渠道类型: %s", channel)
		return
	}

	if err != nil {
		s.log.Errorf("SyncOrderSettlementTime: 异步执行失败，渠道=%s, err=%v", channel, err)
		return
	}

	s.log.Infof("SyncOrderSettlementTime: 异步执行完成，渠道=%s, 总数=%d, 成功=%d, 失败=%d",
		channel, resp.TotalCount, resp.SuccessCount, resp.FailCount)
}

// syncMiniProgramOrderSettlementTime 同步小程序渠道订单的结算时间
func (s *ShadowV1OrderUseCase) syncMiniProgramOrderSettlementTime(ctx context.Context, resp *pb.SyncOrderSettlementTimeReply) error {
	// 查询2026年1月1日之后的小程序渠道订单
	startTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.Local)

	s.log.Infof("开始同步小程序渠道订单结算时间，起始时间：%s", startTime.Format("2006-01-02 15:04:05"))

	// 查询所有渠道，找到小程序渠道ID
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		s.log.Errorf("查询渠道列表失败: %v", err)
		return errorx.DataSQLErr.WithError(err).Err()
	}

	miniProgramChannelId := ""
	for _, channel := range channelList {
		if channel.Name == constant.ChannelTypeXCX {
			miniProgramChannelId = channel.ID
			break
		}
	}

	if miniProgramChannelId == "" {
		s.log.Errorf("未找到小程序渠道")
		return errorx.ChannelNotExists.WithFmtMsg("小程序").Err()
	}

	// 构建查询条件：查询2026年1月1日之后的已支付订单（排除待支付和已关闭状态）
	param := &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "channelId",
				Value: miniProgramChannelId,
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
			{
				Field: "paymentTime",
				Value: startTime,
				Exp:   condition.GTE,
				Logic: condition.AND,
			},
		},
		Order: []*condition.OrderParam{
			{
				Field: "paymentTime",
				Order: condition.ASC,
			},
		},
	}

	// 分页查询订单
	pageSize := int32(500)
	page := int32(1)
	totalCount := int32(0)
	successCount := int32(0)
	failCount := int32(0)

	for {
		param.Page = page
		param.PageSize = pageSize

		orderList, total, err := s.orderRepo.FindMultiByCondition(ctx, param)
		if err != nil {
			s.log.Errorf("查询订单失败: %v", err)
			return errorx.DataSQLErr.WithError(err).Err()
		}

		if len(orderList) == 0 {
			break
		}

		s.log.Infof("查询到第 %d 页订单，共 %d 条，总数=%d", page, len(orderList), total)

		// 过滤掉待支付和已关闭的订单
		var validOrderList []*yanxue_model.Order
		for _, order := range orderList {
			if order.Status != string(constant.OrderStatusPendingPayment) && order.Status != string(constant.OrderStatusClosed) {
				validOrderList = append(validOrderList, order)
			}
		}

		if len(validOrderList) == 0 {
			s.log.Infof("第 %d 页没有有效订单，跳过", page)
			// 继续下一页
			if int32(len(orderList)) < pageSize {
				break
			}
			page++
			continue
		}

		s.log.Infof("第 %d 页有效订单数：%d", page, len(validOrderList))

		// 提取订单ID列表（使用UUIDTo32String转换为32位字符串用于查询账单）
		var orderIds32 []string
		for _, order := range validOrderList {
			orderIds32 = append(orderIds32, UUIDTo32String(order.ID))
		}

		// 查询这些订单对应的微信支付账单（货款类型）
		// wechat_pay_bill.orderNumber 对应 order.id（使用UUIDTo32String转换）
		billParam := &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "orderNumber",
					Value: orderIds32,
					Exp:   condition.IN,
					Logic: condition.AND,
				},
				{
					Field: "transactionType",
					Value: constant.TransactionTypePay,
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
			},
			Order: []*condition.OrderParam{
				{
					Field: "tradeTime",
					Order: condition.ASC,
				},
			},
		}

		billList, _, err := s.wechatPayBillRepo.FindMultiByCondition(ctx, billParam)
		if err != nil {
			s.log.Errorf("查询微信支付账单失败: %v", err)
			return errorx.DataSQLErr.WithError(err).Err()
		}

		// 构建 orderId32 -> 货款交易时间 映射
		orderId32ToPayTradeTimeMap := make(map[string]time.Time)
		for _, bill := range billList {
			if bill.OrderNumber == "" {
				continue
			}
			// 记录最早的货款交易时间
			if existingTime, exists := orderId32ToPayTradeTimeMap[bill.OrderNumber]; !exists || bill.TradeTime.Before(existingTime) {
				orderId32ToPayTradeTimeMap[bill.OrderNumber] = bill.TradeTime
			}
		}

		s.log.Infof("查询到 %d 条货款账单记录，对应 %d 个订单", len(billList), len(orderId32ToPayTradeTimeMap))

		// 更新订单和子订单的结算时间
		for _, order := range validOrderList {
			totalCount++

			orderId32 := UUIDTo32String(order.ID)
			payTradeTime, exists := orderId32ToPayTradeTimeMap[orderId32]
			if !exists {
				s.log.Warnf("订单未找到货款账单，跳过，orderId=%s, orderNumber=%s", order.ID, order.OrderNumber)
				failCount++
				continue
			}

			// 计算结算时间：交易时间T+1
			settlementTime := payTradeTime.AddDate(0, 0, 1)

			// 更新父订单
			oldOrder := s.orderRepo.DeepCopy(order)
			order.SettlementTime = settlementTime
			err = s.orderRepo.UpdateOneCacheWithZero(ctx, order, oldOrder)
			if err != nil {
				s.log.Errorf("更新父订单结算时间失败，orderId=%s, err=%v", order.ID, err)
				failCount++
				continue
			}

			s.log.Infof("更新父订单结算时间成功，orderId=%s, orderNumber=%s, 交易时间=%s, 结算时间=%s",
				order.ID, order.OrderNumber, payTradeTime.Format("2006-01-02 15:04:05"), settlementTime.Format("2006-01-02 15:04:05"))

			// 查询并更新子订单
			subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, order.ID)
			if err != nil {
				s.log.Errorf("查询子订单失败，orderId=%s, err=%v", order.ID, err)
				continue
			}

			for _, subOrder := range subOrders {
				oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)
				subOrder.SettlementTime = settlementTime
				err = s.subOrderRepo.UpdateOneCacheWithZero(ctx, subOrder, oldSubOrder)
				if err != nil {
					s.log.Errorf("更新子订单结算时间失败，subOrderId=%s, err=%v", subOrder.ID, err)
					continue
				}
				s.log.Infof("更新子订单结算时间成功，subOrderId=%s", subOrder.ID)
			}

			successCount++
		}

		// 如果已处理完所有订单，退出循环
		if int32(len(orderList)) < pageSize {
			break
		}

		page++
	}

	resp.TotalCount = totalCount
	resp.SuccessCount = successCount
	resp.FailCount = failCount

	s.log.Infof("同步小程序渠道订单结算时间完成，总数=%d，成功=%d，失败=%d", totalCount, successCount, failCount)
	return nil
}

// syncDouYinOrderSettlementTime 同步抖音渠道订单的结算时间
// 只处理服务状态为 completed 且存在未赋值结算时间（结算时间小于2025-01-01）的子订单的订单
func (s *ShadowV1OrderUseCase) syncDouYinOrderSettlementTime(ctx context.Context, resp *pb.SyncOrderSettlementTimeReply) error {
	// 查询2026年1月1日之后的抖音渠道订单
	startTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.Local)
	// 结算时间判断基准：2025年1月1日
	settlementTimeThreshold := time.Date(2025, 1, 1, 0, 0, 0, 0, time.Local)

	s.log.Infof("开始同步抖音渠道订单结算时间，起始时间：%s，结算时间阈值：%s",
		startTime.Format("2006-01-02 15:04:05"),
		settlementTimeThreshold.Format("2006-01-02 15:04:05"))

	// 查询所有渠道，找到抖音渠道ID
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		s.log.Errorf("查询渠道列表失败: %v", err)
		return errorx.DataSQLErr.WithError(err).Err()
	}

	douYinChannelId := ""
	for _, channel := range channelList {
		if channel.Name == constant.ChannelTypeDY {
			douYinChannelId = channel.ID
			break
		}
	}

	if douYinChannelId == "" {
		s.log.Errorf("未找到抖音渠道")
		return errorx.ChannelNotExists.WithFmtMsg("抖音").Err()
	}

	// 构建查询条件：查询2026年1月1日之后创建的订单，且服务状态为 completed
	param := &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "channelId",
				Value: douYinChannelId,
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
			{
				Field: "createdAt",
				Value: startTime,
				Exp:   condition.GTE,
				Logic: condition.AND,
			},
			{
				Field: "serviceStatus",
				Value: string(constant.OrderStatusCompleted),
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
		},
		Order: []*condition.OrderParam{
			{
				Field: "paymentTime",
				Order: condition.ASC,
			},
		},
	}

	// 分页查询订单
	pageSize := int32(500)
	page := int32(1)
	totalCount := int32(0)
	successCount := int32(0)
	failCount := int32(0)
	skipCount := int32(0) // 跳过的订单数（不满足条件）

	// 用于记录失败详情
	type FailureDetail struct {
		OrderID           string
		OrderNumber       string
		OriginOrderNumber string
		Reason            string
	}
	var failureDetails []FailureDetail

	for {
		param.Page = page
		param.PageSize = pageSize

		orderList, total, err := s.orderRepo.FindMultiByCondition(ctx, param)
		if err != nil {
			s.log.Errorf("查询订单失败: %v", err)
			return errorx.DataSQLErr.WithError(err).Err()
		}

		if len(orderList) == 0 {
			break
		}

		s.log.Infof("查询到第 %d 页订单，共 %d 条，总数=%d", page, len(orderList), total)

		// 过滤掉待支付和已关闭的订单
		var validOrderList []*yanxue_model.Order
		for _, order := range orderList {
			if order.Status != string(constant.OrderStatusPendingPayment) && order.Status != string(constant.OrderStatusClosed) &&
				order.Status != string(constant.OrderStatusRefunded) {
				validOrderList = append(validOrderList, order)
			}
		}

		if len(validOrderList) == 0 {
			s.log.Infof("第 %d 页没有有效订单，跳过", page)
			// 继续下一页
			if int32(len(orderList)) < pageSize {
				break
			}
			page++
			continue
		}

		s.log.Infof("第 %d 页有效订单数：%d", page, len(validOrderList))

		// 处理每个订单
		for _, order := range validOrderList {
			totalCount++

			// 先查询该订单的所有子订单，检查是否有需要更新的子订单
			subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, order.ID)
			if err != nil {
				reason := fmt.Sprintf("查询子订单失败: %v", err)
				s.log.Errorf("订单处理失败，orderId=%s, orderNumber=%s, 原因=%s", order.ID, order.OrderNumber, reason)
				failureDetails = append(failureDetails, FailureDetail{
					OrderID:           order.ID,
					OrderNumber:       order.OrderNumber,
					OriginOrderNumber: order.OriginOrderNumber,
					Reason:            reason,
				})
				failCount++
				continue
			}

			if len(subOrders) == 0 {
				reason := "订单没有子订单"
				s.log.Warnf("订单跳过，orderId=%s, orderNumber=%s, 原因=%s", order.ID, order.OrderNumber, reason)
				skipCount++
				continue
			}

			// 检查是否存在需要更新结算时间的子订单（结算时间小于2025-01-01）
			hasUnsetSettlementTime := false
			for _, subOrder := range subOrders {
				if subOrder.SettlementTime.IsZero() || subOrder.SettlementTime.Before(settlementTimeThreshold) {
					hasUnsetSettlementTime = true
					break
				}
			}

			if !hasUnsetSettlementTime {
				reason := "所有子订单的结算时间均已设置且大于等于2025-01-01"
				s.log.Infof("订单跳过，orderId=%s, orderNumber=%s, 原因=%s", order.ID, order.OrderNumber, reason)
				skipCount++
				continue
			}

			s.log.Infof("订单符合处理条件，orderId=%s, orderNumber=%s, serviceStatus=%s, 子订单数=%d",
				order.ID, order.OrderNumber, order.ServiceStatus, len(subOrders))

			// 调用抖音接口查询券状态（使用 OriginOrderNumber 作为抖音订单ID）
			certReply, err := s.httpRpc.QueryDouYinCertificate(ctx, &rpc.QueryDouYinCertificateReqParams{
				OrderId: order.OriginOrderNumber,
			})

			if err != nil {
				reason := fmt.Sprintf("调用抖音接口查询券状态失败: %v", err)
				s.log.Errorf("订单处理失败，orderId=%s, orderNumber=%s, originOrderNumber=%s, 原因=%s",
					order.ID, order.OrderNumber, order.OriginOrderNumber, reason)
				failureDetails = append(failureDetails, FailureDetail{
					OrderID:           order.ID,
					OrderNumber:       order.OrderNumber,
					OriginOrderNumber: order.OriginOrderNumber,
					Reason:            reason,
				})
				failCount++
				continue
			}

			// 检查是否有券信息
			if len(certReply.Data.Certificates) == 0 {
				reason := "抖音接口返回的券信息为空"
				s.log.Warnf("订单处理失败，orderId=%s, orderNumber=%s, originOrderNumber=%s, 原因=%s",
					order.ID, order.OrderNumber, order.OriginOrderNumber, reason)
				failureDetails = append(failureDetails, FailureDetail{
					OrderID:           order.ID,
					OrderNumber:       order.OrderNumber,
					OriginOrderNumber: order.OriginOrderNumber,
					Reason:            reason,
				})
				failCount++
				continue
			}

			// 构建 certificateId -> 子订单 映射（只包含需要更新的子订单）
			certIdToSubOrderMap := make(map[string]*yanxue_model.SubOrder)
			var subOrdersWithoutCertId []*yanxue_model.SubOrder

			for _, subOrder := range subOrders {
				// 只处理结算时间小于2025-01-01的子订单
				if subOrder.SettlementTime.IsZero() || subOrder.SettlementTime.Before(settlementTimeThreshold) {
					if subOrder.CertificateID != "" {
						certIdToSubOrderMap[subOrder.CertificateID] = subOrder
					} else {
						subOrdersWithoutCertId = append(subOrdersWithoutCertId, subOrder)
					}
				}
			}

			if len(certIdToSubOrderMap) == 0 && len(subOrdersWithoutCertId) == 0 {
				reason := "没有需要更新的子订单（所有子订单结算时间均已设置）"
				s.log.Infof("订单跳过，orderId=%s, orderNumber=%s, 原因=%s", order.ID, order.OrderNumber, reason)
				skipCount++
				continue
			}

			s.log.Infof("订单处理中，orderId=%s, 券数量=%d, 有券ID的待更新子订单数=%d, 无券ID的待更新子订单数=%d",
				order.ID, len(certReply.Data.Certificates), len(certIdToSubOrderMap), len(subOrdersWithoutCertId))

			// 记录是否有子订单被更新
			subOrderUpdated := false
			var earliestSettlementTime time.Time
			updatedSubOrderCount := 0

			// 遍历所有券的核销记录
			type CertificateInfo struct {
				CertificateId int64
				VerifyTime    int64
			}
			unmatchedCerts := make([]*CertificateInfo, 0)

			for _, cert := range certReply.Data.Certificates {
				// 获取券ID（转换为字符串）
				certIdStr := strconv.FormatInt(cert.CertificateId, 10)

				// 查找对应的子订单
				subOrder, found := certIdToSubOrderMap[certIdStr]
				if !found {
					// 提取核销时间用于后续按顺序匹配
					var verifyTime int64
					if cert.Verify.VerifyTime > 0 {
						verifyTime = cert.Verify.VerifyTime
					} else if len(cert.VerifyRecords) > 0 {
						verifyTime = cert.VerifyRecords[0].VerifyTime
					}

					certInfo := &CertificateInfo{
						CertificateId: cert.CertificateId,
						VerifyTime:    verifyTime,
					}
					unmatchedCerts = append(unmatchedCerts, certInfo)
					s.log.Infof("券ID未找到对应子订单，将稍后按顺序匹配，certificateId=%d, orderId=%s", cert.CertificateId, order.ID)
					continue
				}

				// 获取核销时间
				var verifyTime int64
				if cert.Verify.VerifyTime > 0 {
					verifyTime = cert.Verify.VerifyTime
				} else if len(cert.VerifyRecords) > 0 {
					verifyTime = cert.VerifyRecords[0].VerifyTime
				}

				if verifyTime == 0 {
					s.log.Warnf("券未找到核销时间，跳过，certificateId=%d, subOrderId=%s", cert.CertificateId, subOrder.ID)
					continue
				}

				// 将秒级时间戳转换为time.Time
				verifyTimeObj := time.Unix(verifyTime, 0)

				// 计算结算时间：核销时间+5天
				settlementTime := verifyTimeObj.AddDate(0, 0, 5)

				// 更新子订单的结算时间
				oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)
				subOrder.SettlementTime = settlementTime
				err = s.subOrderRepo.UpdateOneCacheWithZero(ctx, subOrder, oldSubOrder)
				if err != nil {
					s.log.Errorf("更新子订单结算时间失败，subOrderId=%s, err=%v", subOrder.ID, err)
					continue
				}

				s.log.Infof("更新子订单结算时间成功（按券ID匹配），subOrderId=%s, certificateId=%d, 核销时间=%s, 结算时间=%s",
					subOrder.ID, cert.CertificateId, verifyTimeObj.Format("2006-01-02 15:04:05"), settlementTime.Format("2006-01-02 15:04:05"))

				subOrderUpdated = true
				updatedSubOrderCount++

				// 记录最早的结算时间，用于更新父订单
				if earliestSettlementTime.IsZero() || settlementTime.Before(earliestSettlementTime) {
					earliestSettlementTime = settlementTime
				}
			}

			// 对于未匹配的券，如果有没有 certificateId 的子订单，按顺序匹配
			if len(unmatchedCerts) > 0 && len(subOrdersWithoutCertId) > 0 {
				s.log.Infof("开始按顺序匹配未匹配的券，未匹配券数：%d，无券ID子订单数：%d，orderId=%s",
					len(unmatchedCerts), len(subOrdersWithoutCertId), order.ID)

				matchCount := len(unmatchedCerts)
				if matchCount > len(subOrdersWithoutCertId) {
					matchCount = len(subOrdersWithoutCertId)
				}

				for i := 0; i < matchCount; i++ {
					certInfo := unmatchedCerts[i]
					subOrder := subOrdersWithoutCertId[i]

					if certInfo.VerifyTime == 0 {
						s.log.Warnf("券未找到核销时间，跳过，certificateId=%d, subOrderId=%s", certInfo.CertificateId, subOrder.ID)
						continue
					}

					// 将秒级时间戳转换为time.Time
					verifyTimeObj := time.Unix(certInfo.VerifyTime, 0)

					// 计算结算时间：核销时间+5天
					settlementTime := verifyTimeObj.AddDate(0, 0, 5)

					// 更新子订单的结算时间和 certificateId
					oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)
					subOrder.SettlementTime = settlementTime
					subOrder.CertificateID = strconv.FormatInt(certInfo.CertificateId, 10)
					err = s.subOrderRepo.UpdateOneCacheWithZero(ctx, subOrder, oldSubOrder)
					if err != nil {
						s.log.Errorf("更新子订单结算时间失败，subOrderId=%s, err=%v", subOrder.ID, err)
						continue
					}

					s.log.Infof("更新子订单结算时间成功（按顺序匹配），subOrderId=%s, certificateId=%d, 核销时间=%s, 结算时间=%s",
						subOrder.ID, certInfo.CertificateId, verifyTimeObj.Format("2006-01-02 15:04:05"), settlementTime.Format("2006-01-02 15:04:05"))

					subOrderUpdated = true
					updatedSubOrderCount++

					// 记录最早的结算时间，用于更新父订单
					if earliestSettlementTime.IsZero() || settlementTime.Before(earliestSettlementTime) {
						earliestSettlementTime = settlementTime
					}
				}
			}

			// 如果有子订单被更新，则更新父订单的结算时间为最早的子订单结算时间
			if subOrderUpdated && !earliestSettlementTime.IsZero() {
				oldOrder := s.orderRepo.DeepCopy(order)
				order.SettlementTime = earliestSettlementTime
				err = s.orderRepo.UpdateOneCacheWithZero(ctx, order, oldOrder)
				if err != nil {
					reason := fmt.Sprintf("更新父订单结算时间失败: %v", err)
					s.log.Errorf("订单处理失败，orderId=%s, orderNumber=%s, 原因=%s", order.ID, order.OrderNumber, reason)
					failureDetails = append(failureDetails, FailureDetail{
						OrderID:           order.ID,
						OrderNumber:       order.OrderNumber,
						OriginOrderNumber: order.OriginOrderNumber,
						Reason:            reason,
					})
					failCount++
					continue
				}

				s.log.Infof("订单处理成功，orderId=%s, orderNumber=%s, 更新子订单数=%d, 父订单结算时间=%s",
					order.ID, order.OrderNumber, updatedSubOrderCount, earliestSettlementTime.Format("2006-01-02 15:04:05"))

				successCount++
			} else {
				reason := "订单没有已核销的券或未找到核销时间"
				s.log.Warnf("订单处理失败，orderId=%s, orderNumber=%s, 原因=%s", order.ID, order.OrderNumber, reason)
				failureDetails = append(failureDetails, FailureDetail{
					OrderID:           order.ID,
					OrderNumber:       order.OrderNumber,
					OriginOrderNumber: order.OriginOrderNumber,
					Reason:            reason,
				})
				failCount++
			}
		}

		// 如果已处理完所有订单，退出循环
		if int32(len(orderList)) < pageSize {
			break
		}

		page++
	}

	resp.TotalCount = totalCount
	resp.SuccessCount = successCount
	resp.FailCount = failCount

	// 输出详细的失败信息
	if len(failureDetails) > 0 {
		s.log.Warnf("========== 同步失败订单详情（共%d个）==========", len(failureDetails))
		for i, detail := range failureDetails {
			s.log.Warnf("[失败%d] 订单ID=%s, 订单号=%s, 抖音订单号=%s, 失败原因=%s",
				i+1, detail.OrderID, detail.OrderNumber, detail.OriginOrderNumber, detail.Reason)
		}
		s.log.Warnf("========== 失败订单详情结束 ==========")
	}

	s.log.Infof("同步抖音渠道订单结算时间完成，总处理=%d，成功=%d，失败=%d，跳过=%d（不满足条件）",
		totalCount, successCount, failCount, skipCount)
	s.log.Infof("处理条件：serviceStatus=completed 且 存在结算时间<2025-01-01的子订单")

	return nil
}
