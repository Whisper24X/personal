package biz

import (
	"context"
	"sync"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

// SyncDouYinCertificateId 同步抖音订单的券ID
// 查询抖音渠道的订单（没有 certificateId 的），通过调用抖音接口查询券ID，然后赋值到订单表和子订单表
// 异步执行，避免超时
func (s *ShadowV1OrderUseCase) SyncDouYinCertificateId(ctx context.Context, req *pb.SyncDouYinCertificateIdReq) (*pb.SyncDouYinCertificateIdReply, error) {
	resp := &pb.SyncDouYinCertificateIdReply{}

	// 使用分布式锁检查是否有其他实例正在执行
	err := s.commonRepo.LockOnce(ctx, cache.SyncDouYinCertificateIdLock.Key(), cache.SyncDouYinCertificateIdLock.TTL(), func() error {
		// 异步执行同步任务，避免接口超时
		go func() {
			// 创建新的 context，避免使用原 ctx 导致超时
			asyncCtx := context.Background()
			s.syncDouYinCertificateIdAsync(asyncCtx)
		}()

		s.log.Infof("SyncDouYinCertificateId: 任务已启动，正在后台异步执行")
		return nil
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}

// syncDouYinCertificateIdAsync 异步同步抖音订单的券ID
func (s *ShadowV1OrderUseCase) syncDouYinCertificateIdAsync(ctx context.Context) {
	// 1. 查询抖音渠道ID
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		s.log.Errorf("SyncDouYinCertificateId: 查询渠道列表失败, err=%v", err)
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
		s.log.Errorf("SyncDouYinCertificateId: 未找到抖音渠道")
		return
	}

	s.log.Infof("SyncDouYinCertificateId: 抖音渠道ID=%s", douYinChannelId)

	// 2. 分页查询抖音渠道的所有订单，然后在内存中过滤 certificateId 为空的订单
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
			},
		})

		if err != nil {
			s.log.Errorf("SyncDouYinCertificateId: 查询订单失败, pageNum=%d, err=%v", pageNum, err)
			return
		}

		allOrders = append(allOrders, orders...)
		s.log.Infof("SyncDouYinCertificateId: 已查询订单数据, 当前页=%d, 当前页数量=%d, 累计数量=%d, 总数=%d",
			pageNum, len(orders), len(allOrders), reply.Total)

		// 如果已经查询完所有数据，退出循环
		if len(allOrders) >= int(reply.Total) {
			break
		}

		pageNum++
	}

	s.log.Infof("SyncDouYinCertificateId: 查询到抖音渠道订单，共%d条", len(allOrders))

	// 3. 过滤出 certificateId 为空（空字符串或NULL）的订单
	var ordersWithoutCertificateId []*yanxue_model.Order
	for _, order := range allOrders {
		if order.CertificateID == "" {
			ordersWithoutCertificateId = append(ordersWithoutCertificateId, order)
		}
	}

	s.log.Infof("SyncDouYinCertificateId: 过滤出需要同步的订单，共%d条", len(ordersWithoutCertificateId))

	if len(ordersWithoutCertificateId) == 0 {
		s.log.Infof("SyncDouYinCertificateId: 没有需要同步的订单")
		return
	}

	// 4. 按 originOrderNumber 分组订单
	originOrderNumberToOrdersMap := make(map[string][]*yanxue_model.Order)
	for _, order := range ordersWithoutCertificateId {
		originOrderNumberToOrdersMap[order.OriginOrderNumber] = append(originOrderNumberToOrdersMap[order.OriginOrderNumber], order)
	}

	s.log.Infof("SyncDouYinCertificateId: 按 originOrderNumber 分组，共%d个原始订单", len(originOrderNumberToOrdersMap))

	// 5. 并发调用抖音接口查询券ID，并更新订单
	// 使用并发控制和限流
	const maxConcurrency = 10                               // 并发数
	const requestsPerSecond = 100                           // 每秒最多100个请求
	const requestInterval = time.Second / requestsPerSecond // 每个请求间隔10ms

	semaphore := make(chan struct{}, maxConcurrency)
	rateLimiter := time.NewTicker(requestInterval) // 速率限制器
	defer rateLimiter.Stop()

	successCount := 0
	partialSuccessCount := 0 // 部分成功（父订单更新成功但子订单失败）
	failCount := 0
	processedCount := 0
	totalCount := len(originOrderNumberToOrdersMap)
	wg := &sync.WaitGroup{}
	mu := &sync.Mutex{}

	// 用于记录失败原因
	type failureInfo struct {
		originOrderNumber string
		reason            string
	}
	var failures []failureInfo
	var failuresMu sync.Mutex

	s.log.Infof("SyncDouYinCertificateId: 开始并发处理，最大并发数=%d, 请求速率=%d req/s", maxConcurrency, requestsPerSecond)

	for originOrderNumber, orders := range originOrderNumberToOrdersMap {
		// 等待速率限制器（每个请求间隔 10ms）
		<-rateLimiter.C

		wg.Add(1)
		// 获取信号量，控制并发数
		semaphore <- struct{}{}

		go func(originOrderNumber string, orders []*yanxue_model.Order) {
			defer func() {
				// 释放信号量
				<-semaphore
				wg.Done()

				// 更新进度
				mu.Lock()
				processedCount++
				if processedCount%50 == 0 || processedCount == totalCount {
					s.log.Infof("SyncDouYinCertificateId: 处理进度 %d/%d (%.2f%%), 完全成功=%d, 部分成功=%d, 失败=%d",
						processedCount, totalCount, float64(processedCount)/float64(totalCount)*100,
						successCount, partialSuccessCount, failCount)
				}
				mu.Unlock()
			}()

			// 调用 QueryDouYinOrderInfo 查询订单信息
			orderInfoReply, err := s.httpRpc.QueryDouYinOrderInfo(ctx, &rpc.QueryDouYinOrderInfoReqParams{
				AccountId: constant.DouYinAccountId,
				OrderId:   originOrderNumber,
				PageNum:   1,
				PageSize:  100,
			})

			if err != nil {
				reason := "查询抖音订单信息失败: " + err.Error()
				s.log.Errorf("SyncDouYinCertificateId: %s, originOrderNumber=%s", reason, originOrderNumber)
				mu.Lock()
				failCount++
				mu.Unlock()
				failuresMu.Lock()
				failures = append(failures, failureInfo{originOrderNumber: originOrderNumber, reason: reason})
				failuresMu.Unlock()
				return
			}

			// 检查是否查询到订单信息
			if len(orderInfoReply.Data.Orders) == 0 {
				reason := "抖音订单信息为空"
				s.log.Warnf("SyncDouYinCertificateId: %s, originOrderNumber=%s", reason, originOrderNumber)
				mu.Lock()
				failCount++
				mu.Unlock()
				failuresMu.Lock()
				failures = append(failures, failureInfo{originOrderNumber: originOrderNumber, reason: reason})
				failuresMu.Unlock()
				return
			}

			orderInfo := orderInfoReply.Data.Orders[0]

			// 提取券ID列表
			var certificateIds []string
			for _, cert := range orderInfo.Certificate {
				if cert.CertificateId != "" {
					certificateIds = append(certificateIds, cert.CertificateId)
				}
			}

			if len(certificateIds) == 0 {
				reason := "订单没有券信息"
				s.log.Warnf("SyncDouYinCertificateId: %s, originOrderNumber=%s", reason, originOrderNumber)
				mu.Lock()
				failCount++
				mu.Unlock()
				failuresMu.Lock()
				failures = append(failures, failureInfo{originOrderNumber: originOrderNumber, reason: reason})
				failuresMu.Unlock()
				return
			}

			s.log.Infof("SyncDouYinCertificateId: 查询到券ID列表, originOrderNumber=%s, 券数量=%d, 订单数量=%d",
				originOrderNumber, len(certificateIds), len(orders))

			// 取最小值，避免券数量与订单数量不匹配导致失败
			minCount := len(certificateIds)
			if minCount > len(orders) {
				minCount = len(orders)
			}

			if len(certificateIds) != len(orders) {
				s.log.Warnf("SyncDouYinCertificateId: 券数量与订单数量不完全匹配, originOrderNumber=%s, 券数量=%d, 订单数量=%d, 将更新前%d个订单",
					originOrderNumber, len(certificateIds), len(orders), minCount)
			}

			// 记录更新结果
			parentOrderSuccess := 0
			parentOrderFail := 0
			subOrderSuccess := 0
			subOrderFail := 0

			// 更新订单的 certificateId
			for i := 0; i < minCount; i++ {
				certificateId := certificateIds[i]
				order := orders[i]

				// 更新父订单
				oldOrder := s.orderRepo.DeepCopy(order)
				order.CertificateID = certificateId
				err := s.orderRepo.UpdateOneCache(ctx, order, oldOrder)
				if err != nil {
					s.log.Errorf("SyncDouYinCertificateId: 更新父订单失败, orderId=%s, certificateId=%s, err=%v",
						order.ID, certificateId, err)
					parentOrderFail++
					continue
				}

				parentOrderSuccess++
				s.log.Infof("SyncDouYinCertificateId: 更新父订单成功, orderId=%s, orderNumber=%s, certificateId=%s",
					order.ID, order.OrderNumber, certificateId)

				// 更新子订单的 certificateId
				subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, order.ID)
				if err != nil {
					s.log.Errorf("SyncDouYinCertificateId: 查询子订单失败, orderId=%s, err=%v", order.ID, err)
					subOrderFail++
					continue
				}

				for _, subOrder := range subOrders {
					oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)
					subOrder.CertificateID = certificateId
					err := s.subOrderRepo.UpdateOneCache(ctx, subOrder, oldSubOrder)
					if err != nil {
						s.log.Errorf("SyncDouYinCertificateId: 更新子订单失败, subOrderId=%s, certificateId=%s, err=%v",
							subOrder.ID, certificateId, err)
						subOrderFail++
						continue
					}

					subOrderSuccess++
					s.log.Infof("SyncDouYinCertificateId: 更新子订单成功, subOrderId=%s, subOrderNumber=%s, certificateId=%s",
						subOrder.ID, subOrder.OrderNumber, certificateId)
				}
			}

			// 统计结果
			mu.Lock()
			if parentOrderFail == 0 && subOrderFail == 0 && parentOrderSuccess == minCount {
				// 完全成功
				successCount++
			} else if parentOrderSuccess > 0 {
				// 部分成功
				partialSuccessCount++
				reason := "部分成功: 父订单成功=" + string(rune(parentOrderSuccess)) + ", 父订单失败=" + string(rune(parentOrderFail)) + ", 子订单失败=" + string(rune(subOrderFail))
				failuresMu.Lock()
				failures = append(failures, failureInfo{originOrderNumber: originOrderNumber, reason: reason})
				failuresMu.Unlock()
			} else {
				// 完全失败
				failCount++
				reason := "所有订单更新失败"
				failuresMu.Lock()
				failures = append(failures, failureInfo{originOrderNumber: originOrderNumber, reason: reason})
				failuresMu.Unlock()
			}
			mu.Unlock()

		}(originOrderNumber, orders)
	}

	wg.Wait()
	close(semaphore)

	s.log.Infof("SyncDouYinCertificateId: 同步完成, 总数=%d, 完全成功=%d, 部分成功=%d, 失败=%d",
		totalCount, successCount, partialSuccessCount, failCount)

	// 输出失败订单详情
	if len(failures) > 0 {
		s.log.Warnf("SyncDouYinCertificateId: 失败/部分成功订单详情（共%d个）:", len(failures))
		for _, f := range failures {
			s.log.Warnf("  - originOrderNumber=%s, 原因=%s", f.originOrderNumber, f.reason)
		}
	}
}
