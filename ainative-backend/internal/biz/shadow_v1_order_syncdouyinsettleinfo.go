package biz

import (
	"context"
	"strconv"
	"sync"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

// SyncDouYinSettleInfo 同步抖音分账信息
func (s *ShadowV1OrderUseCase) SyncDouYinSettleInfo(ctx context.Context, req *pb.SyncDouYinSettleInfoReq) (*pb.SyncDouYinSettleInfoReply, error) {
	resp := &pb.SyncDouYinSettleInfoReply{}

	// 使用分布式锁防止重复执行
	err := s.commonRepo.LockOnce(ctx, cache.SyncDouYinSettleInfoLock.Key(), cache.SyncDouYinSettleInfoLock.TTL(), func() error {
		// 异步执行同步任务，避免接口超时
		go func() {
			// 创建新的 context，避免使用原 ctx 导致超时
			asyncCtx := context.Background()
			s.syncDouYinSettleInfoAsync(asyncCtx)
		}()

		s.log.Infof("SyncDouYinSettleInfo: 任务已启动，正在后台异步执行")
		return nil
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}

// syncDouYinSettleInfoAsync 异步同步抖音分账信息的具体实现
func (s *ShadowV1OrderUseCase) syncDouYinSettleInfoAsync(ctx context.Context) {
	// 1. 查询抖音渠道ID
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		s.log.Errorf("SyncDouYinSettleInfo: 查询渠道列表失败, err=%v", err)
		return
	}

	var douyinChannelId string
	for _, channel := range channelList {
		if channel.Name == constant.ChannelTypeDY {
			douyinChannelId = channel.ID
			break
		}
	}

	if douyinChannelId == "" {
		s.log.Warn("SyncDouYinSettleInfo: 未找到抖音渠道")
		return
	}

	s.log.Infof("SyncDouYinSettleInfo: 找到抖音渠道ID=%s", douyinChannelId)

	// 2. 分页查询2026年1月1日之后的所有抖音订单
	startTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	const pageSize = 1000 // 每页查询1000条
	var allOrders []*yanxue_model.Order
	pageNum := int32(1)

	for {
		orders, reply, err := s.orderRepo.FindMultiByCondition(ctx, &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "channelId",
					Value: douyinChannelId,
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
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
					Order: condition.DESC,
				},
			},
			Page:     pageNum,
			PageSize: pageSize,
		})

		if err != nil {
			s.log.Errorf("SyncDouYinSettleInfo: 查询订单失败, pageNum=%d, err=%v", pageNum, err)
			return
		}

		allOrders = append(allOrders, orders...)
		s.log.Infof("SyncDouYinSettleInfo: 已查询订单数据, 当前页=%d, 当前页数量=%d, 累计数量=%d, 总数=%d",
			pageNum, len(orders), len(allOrders), reply.Total)

		// 如果已经查询完所有数据，退出循环
		if len(allOrders) >= int(reply.Total) {
			break
		}

		pageNum++
	}

	s.log.Infof("SyncDouYinSettleInfo: 查询到 %d 个抖音订单", len(allOrders))

	// 3. 不再过滤订单，所有订单都尝试同步
	// 移除了之前的过滤逻辑，现在不管有没有手续费和佣金都会更新
	needSyncOrders := allOrders

	s.log.Infof("SyncDouYinSettleInfo: 需要同步分账信息的订单数量=%d", len(needSyncOrders))

	if len(needSyncOrders) == 0 {
		s.log.Info("SyncDouYinSettleInfo: 没有需要同步的订单")
		return
	}

	// 4. 串行查询分账信息，添加限流控制（每秒最多100个请求）
	// 每个订单需要2个API请求（QueryDouYinOrderInfo + QueryDouYinLedgerRecordByCert）
	// 所以每秒最多处理50个订单
	const requestsPerSecond = 100                           // 每秒最多100个请求
	const requestInterval = time.Second / requestsPerSecond // 每个请求间隔10ms
	rateLimiter := time.NewTicker(requestInterval)
	defer rateLimiter.Stop()

	successCount := 0
	partialSuccessCount := 0 // 部分成功（只更新了部分数据）
	skipCount := 0
	failCount := 0
	processedCount := 0
	totalCount := len(needSyncOrders)

	// 用于记录失败原因
	type failureInfo struct {
		orderID     string
		orderNumber string
		reason      string
	}
	var failures []failureInfo
	var failuresMu sync.Mutex

	for _, order := range needSyncOrders {
		// 限流：等待速率限制器
		<-rateLimiter.C

		s.log.Infof("SyncDouYinSettleInfo: 开始处理订单, orderId=%s, orderNumber=%s, originOrderNumber=%s, 进度=%d/%d",
			order.ID, order.OrderNumber, order.OriginOrderNumber, processedCount, totalCount)

		// 用于记录本订单更新了哪些字段
		var updatedFields []string
		hasAnyUpdate := false

		// 4.1 先通过原始订单号查询订单信息，获取券ID列表和达人ID
		<-rateLimiter.C // 限流
		orderInfoReply, err := s.httpRpc.QueryDouYinOrderInfo(ctx, &rpc.QueryDouYinOrderInfoReqParams{
			AccountId: constant.DouYinAccountId,
			OrderId:   order.OriginOrderNumber,
			PageNum:   1,
			PageSize:  100,
		})

		var certificateIds []string
		var anchorId string

		if err != nil {
			s.log.Warnf("SyncDouYinSettleInfo: 查询订单信息失败, orderId=%s, originOrderNumber=%s, err=%v",
				order.ID, order.OriginOrderNumber, err)
			failuresMu.Lock()
			failures = append(failures, failureInfo{
				orderID:     order.ID,
				orderNumber: order.OrderNumber,
				reason:      "查询订单信息失败: " + err.Error(),
			})
			failuresMu.Unlock()
			failCount++
			continue
		} else if len(orderInfoReply.Data.Orders) == 0 {
			s.log.Warnf("SyncDouYinSettleInfo: 订单信息为空, orderId=%s, originOrderNumber=%s",
				order.ID, order.OriginOrderNumber)
			failuresMu.Lock()
			failures = append(failures, failureInfo{
				orderID:     order.ID,
				orderNumber: order.OrderNumber,
				reason:      "订单信息为空",
			})
			failuresMu.Unlock()
			skipCount++
			continue
		} else {
			// 成功获取订单信息，提取券ID和达人ID
			for _, cert := range orderInfoReply.Data.Orders[0].Certificate {
				if cert.CertificateId != "" {
					certificateIds = append(certificateIds, cert.CertificateId)
				}
			}
			anchorId = strconv.FormatInt(orderInfoReply.Data.Orders[0].AnchorId, 10)
		}

		// 4.2 通过券ID查询分账明细（如果有券ID）
		var totalPlatformFee int64 = 0
		var totalTalentCommission int64 = 0
		var totalMerchantTicket int64 = 0
		var totalActualInsured int64 = 0
		hasLedgerData := false

		if len(certificateIds) > 0 {
			<-rateLimiter.C // 限流
			ledgerReply, err := s.httpRpc.QueryDouYinLedgerRecordByCert(ctx, &rpc.QueryDouYinLedgerRecordByCertReqParams{
				CertificateIds: certificateIds,
			})

			if err != nil {
				s.log.Warnf("SyncDouYinSettleInfo: 查询分账明细失败（不影响达人ID更新）, orderId=%s, originOrderNumber=%s, err=%v",
					order.ID, order.OriginOrderNumber, err)
			} else if len(ledgerReply.Data.Records) == 0 {
				s.log.Warnf("SyncDouYinSettleInfo: 订单暂无分账记录（不影响达人ID更新）, orderId=%s, originOrderNumber=%s",
					order.ID, order.OriginOrderNumber)
			} else {
				// 4.3 汇总所有分账记录的手续费、佣金、商家优惠和保险费
				// 在通兑券场景下，一个券码可能返回两笔分账单，需要将两笔分账加总
				for _, record := range ledgerReply.Data.Records {
					totalPlatformFee += record.FundAmount.TotalMerchantPlatformService
					totalTalentCommission += record.FundAmount.TalentCommission
					totalMerchantTicket += record.Amount.MerchantTicket
					totalActualInsured += record.Amount.ActualInsured
				}
				hasLedgerData = true
				s.log.Infof("SyncDouYinSettleInfo: 获取到分账数据, orderId=%s, platformFee=%d分, talentCommission=%d分, shopDiscount=%d分, actualInsured=%d分",
					order.ID, totalPlatformFee, totalTalentCommission, totalMerchantTicket, totalActualInsured)
			}
		} else {
			s.log.Warnf("SyncDouYinSettleInfo: 订单没有券ID（不影响达人ID更新）, orderId=%s, originOrderNumber=%s",
				order.ID, order.OriginOrderNumber)
		}

		// 5. 更新父订单 - 能获取到什么数据就更新什么数据
		oldOrder := s.orderRepo.DeepCopy(order)

		// 更新分账数据（如果有）
		if hasLedgerData {
			order.PlatformFee = int32(totalPlatformFee)
			order.TalentCommission = int32(totalTalentCommission)
			order.ShopDiscountAmount = int32(totalMerchantTicket)
			order.ActualInsured = int32(totalActualInsured)
			updatedFields = append(updatedFields, "platformFee", "talentCommission", "shopDiscountAmount", "actualInsured")
			hasAnyUpdate = true
		}

		// 更新达人ID（如果有）
		if anchorId != "" && anchorId != "0" {
			order.TalentUID = anchorId
			updatedFields = append(updatedFields, "talentUID")
			hasAnyUpdate = true
		}

		// 如果有任何更新，执行数据库更新
		if hasAnyUpdate {
			err = s.orderRepo.UpdateOneCache(ctx, order, oldOrder)
			if err != nil {
				s.log.Errorf("SyncDouYinSettleInfo: 更新父订单失败, orderId=%s, err=%v", order.ID, err)
				failuresMu.Lock()
				failures = append(failures, failureInfo{
					orderID:     order.ID,
					orderNumber: order.OrderNumber,
					reason:      "更新父订单失败: " + err.Error(),
				})
				failuresMu.Unlock()
				failCount++
				continue
			}

			s.log.Infof("SyncDouYinSettleInfo: 更新父订单成功, orderId=%s, 更新字段=%v", order.ID, updatedFields)

			// 6. 更新子订单（如果有分账数据）
			if hasLedgerData {
				err = s.updateSubOrderSettleInfo(ctx, order.ID, int32(totalPlatformFee), int32(totalTalentCommission), int32(totalMerchantTicket), int32(totalActualInsured), anchorId)
				if err != nil {
					s.log.Errorf("SyncDouYinSettleInfo: 更新子订单失败, orderId=%s, err=%v", order.ID, err)
					failuresMu.Lock()
					failures = append(failures, failureInfo{
						orderID:     order.ID,
						orderNumber: order.OrderNumber,
						reason:      "更新子订单失败: " + err.Error(),
					})
					failuresMu.Unlock()
					// 父订单更新成功但子订单失败，算部分成功
					partialSuccessCount++
					continue
				}
			}

			// 完全成功
			successCount++
		} else {
			s.log.Warnf("SyncDouYinSettleInfo: 订单没有可更新的数据, orderId=%s", order.ID)
			failuresMu.Lock()
			failures = append(failures, failureInfo{
				orderID:     order.ID,
				orderNumber: order.OrderNumber,
				reason:      "没有可更新的数据",
			})
			failuresMu.Unlock()
			skipCount++
		}

		// 每处理50个订单输出一次进度
		if processedCount%50 == 0 || processedCount == totalCount {
			s.log.Infof("SyncDouYinSettleInfo: 处理进度 %d/%d (%.2f%%), 完全成功=%d, 部分成功=%d, 跳过=%d, 失败=%d",
				processedCount, totalCount, float64(processedCount)/float64(totalCount)*100,
				successCount, partialSuccessCount, skipCount, failCount)
		}
	}

	s.log.Infof("SyncDouYinSettleInfo: 同步完成, 总数=%d, 完全成功=%d, 部分成功=%d, 跳过=%d, 失败=%d",
		totalCount, successCount, partialSuccessCount, skipCount, failCount)

	// 输出失败订单详情
	if len(failures) > 0 {
		s.log.Warnf("SyncDouYinSettleInfo: 失败/跳过订单详情（共%d个）:", len(failures))
		for _, f := range failures {
			s.log.Warnf("  - orderId=%s, orderNumber=%s, 原因=%s", f.orderID, f.orderNumber, f.reason)
		}
	}
}

// updateSubOrderSettleInfo 更新子订单的手续费、佣金、商家优惠和保险费
func (s *ShadowV1OrderUseCase) updateSubOrderSettleInfo(ctx context.Context, parentOrderId string, totalRake int32, totalCommission int32, totalMerchantTicket int32, totalActualInsured int32, talentUID string) error {
	// 查询子订单
	subOrders, err := s.subOrderRepo.FindMultiCacheByParentOrderID(ctx, parentOrderId)
	if err != nil {
		return err
	}

	if len(subOrders) == 0 {
		s.log.Infof("updateSubOrderSettleInfo: 订单没有子订单, parentOrderId=%s", parentOrderId)
		return nil
	}

	// 平分手续费、佣金、商家优惠和保险费
	subOrderCount := int32(len(subOrders))
	avgRake := totalRake / subOrderCount
	avgCommission := totalCommission / subOrderCount
	avgMerchantTicket := totalMerchantTicket / subOrderCount
	avgActualInsured := totalActualInsured / subOrderCount

	// 更新每个子订单
	for i, subOrder := range subOrders {
		oldSubOrder := &yanxue_model.SubOrder{}
		*oldSubOrder = *subOrder

		// 更新手续费、佣金、商家优惠和保险费
		subOrder.PlatformFee = avgRake
		subOrder.TalentCommission = avgCommission
		subOrder.ShopDiscountAmount = avgMerchantTicket
		subOrder.ActualInsured = avgActualInsured
		subOrder.TalentUID = talentUID

		// 最后一个子订单补齐差额
		if i == len(subOrders)-1 {
			subOrder.PlatformFee = totalRake - (avgRake * (subOrderCount - 1))
			subOrder.TalentCommission = totalCommission - (avgCommission * (subOrderCount - 1))
			subOrder.ShopDiscountAmount = totalMerchantTicket - (avgMerchantTicket * (subOrderCount - 1))
			subOrder.ActualInsured = totalActualInsured - (avgActualInsured * (subOrderCount - 1))
		}

		err = s.subOrderRepo.UpdateOneCache(ctx, subOrder, oldSubOrder)
		if err != nil {
			s.log.Errorf("updateSubOrderSettleInfo: 更新子订单失败, subOrderId=%s, err=%v", subOrder.ID, err)
			return err
		}
	}

	s.log.Infof("updateSubOrderSettleInfo: 更新子订单成功, parentOrderId=%s, 子订单数=%d, avgShopDiscount=%d分, avgActualInsured=%d分",
		parentOrderId, len(subOrders), avgMerchantTicket, avgActualInsured)

	return nil
}
