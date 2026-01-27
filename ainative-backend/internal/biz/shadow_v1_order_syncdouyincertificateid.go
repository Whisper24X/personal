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

	// 2. 查询抖音渠道的订单
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

	// 3. 过滤出没有 certificateId 的订单（certificateId 为 NULL 或空字符串）
	var ordersWithoutCertificateId []*yanxue_model.Order
	for _, order := range allOrders {
		if order.CertificateID == "" {
			ordersWithoutCertificateId = append(ordersWithoutCertificateId, order)
		}
	}

	s.log.Infof("SyncDouYinCertificateId: 过滤出没有certificateId的订单，共%d条", len(ordersWithoutCertificateId))

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

	// 5. 调用抖音接口查询券ID，并更新订单
	// 抖音 QPS 限制为 500，为了安全起见，我们设置为每秒最多 80 个请求
	// 使用 channel 控制并发数，并使用 ticker 控制请求速率
	const maxConcurrency = 5                                // 降低并发数
	const requestsPerSecond = 80                            // 每秒最多 80 个请求
	const requestInterval = time.Second / requestsPerSecond // 每个请求间隔 10ms

	semaphore := make(chan struct{}, maxConcurrency)
	rateLimiter := time.NewTicker(requestInterval) // 速率限制器
	defer rateLimiter.Stop()

	successCount := 0
	failCount := 0
	processedCount := 0
	totalCount := len(originOrderNumberToOrdersMap)
	wg := &sync.WaitGroup{}
	mu := &sync.Mutex{}

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
					s.log.Infof("SyncDouYinCertificateId: 处理进度 %d/%d (%.2f%%)",
						processedCount, totalCount, float64(processedCount)/float64(totalCount)*100)
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
				s.log.Errorf("SyncDouYinCertificateId: 查询抖音订单信息失败, originOrderNumber=%s, err=%v",
					originOrderNumber, err)
				mu.Lock()
				failCount++
				mu.Unlock()
				return
			}

			// 检查是否查询到订单信息
			if len(orderInfoReply.Data.Orders) == 0 {
				s.log.Warnf("SyncDouYinCertificateId: 抖音订单信息为空, originOrderNumber=%s", originOrderNumber)
				mu.Lock()
				failCount++
				mu.Unlock()
				return
			}

			orderInfo := orderInfoReply.Data.Orders[0]

			// 提取券ID列表
			var certificateIds []string
			for _, cert := range orderInfo.Certificate {
				certificateIds = append(certificateIds, cert.CertificateId)
			}

			if len(certificateIds) == 0 {
				s.log.Warnf("SyncDouYinCertificateId: 订单没有券信息, originOrderNumber=%s", originOrderNumber)
				mu.Lock()
				failCount++
				mu.Unlock()
				return
			}

			s.log.Infof("SyncDouYinCertificateId: 查询到券ID列表, originOrderNumber=%s, 券数量=%d, 券ID列表=%v",
				originOrderNumber, len(certificateIds), certificateIds)

			// 检查券数量是否与订单数量匹配
			if len(certificateIds) != len(orders) {
				s.log.Warnf("SyncDouYinCertificateId: 券数量与订单数量不匹配, originOrderNumber=%s, 券数量=%d, 订单数量=%d",
					originOrderNumber, len(certificateIds), len(orders))
				mu.Lock()
				failCount++
				mu.Unlock()
				return
			}

			// 更新订单的 certificateId
			for i, order := range orders {
				certificateId := certificateIds[i]

				// 更新父订单
				oldOrder := s.orderRepo.DeepCopy(order)
				order.CertificateID = certificateId
				err := s.orderRepo.UpdateOneCache(context.Background(), order, oldOrder)
				if err != nil {
					s.log.Errorf("SyncDouYinCertificateId: 更新订单失败, orderId=%s, certificateId=%s, err=%v",
						order.ID, certificateId, err)
					continue
				}

				s.log.Infof("SyncDouYinCertificateId: 更新订单成功, orderId=%s, orderNumber=%s, certificateId=%s",
					order.ID, order.OrderNumber, certificateId)

				// 更新子订单的 certificateId
				subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(context.Background(), order.ID)
				if err != nil {
					s.log.Errorf("SyncDouYinCertificateId: 查询子订单失败, orderId=%s, err=%v", order.ID, err)
					continue
				}

				for _, subOrder := range subOrders {
					oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)
					subOrder.CertificateID = certificateId
					err := s.subOrderRepo.UpdateOneCache(context.Background(), subOrder, oldSubOrder)
					if err != nil {
						s.log.Errorf("SyncDouYinCertificateId: 更新子订单失败, subOrderId=%s, certificateId=%s, err=%v",
							subOrder.ID, certificateId, err)
						continue
					}

					s.log.Infof("SyncDouYinCertificateId: 更新子订单成功, subOrderId=%s, subOrderNumber=%s, certificateId=%s",
						subOrder.ID, subOrder.OrderNumber, certificateId)
				}
			}

			mu.Lock()
			successCount++
			mu.Unlock()

		}(originOrderNumber, orders)
	}

	wg.Wait()
	close(semaphore)

	s.log.Infof("SyncDouYinCertificateId: 同步完成, 总数=%d, 成功=%d, 失败=%d", totalCount, successCount, failCount)
}
