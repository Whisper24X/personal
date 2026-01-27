package biz

import (
	"context"
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

// SyncDouYinSettleInfo 同步抖音分账信息
func (s *ShadowV1OrderUseCase) SyncDouYinSettleInfo(ctx context.Context, req *pb.SyncDouYinSettleInfoReq) (*pb.SyncDouYinSettleInfoReply, error) {
	resp := &pb.SyncDouYinSettleInfoReply{}

	// 使用分布式锁防止重复执行
	err := s.commonRepo.LockOnce(ctx, cache.SyncDouYinSettleInfoLock.Key(), cache.SyncDouYinSettleInfoLock.TTL(), func() error {
		// 1. 查询抖音渠道ID
		channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
		if err != nil {
			s.log.Errorf("SyncDouYinSettleInfo: 查询渠道列表失败, err=%v", err)
			return errorx.DataSQLErr.WithError(err).Err()
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
			return nil
		}

		s.log.Infof("SyncDouYinSettleInfo: 找到抖音渠道ID=%s", douyinChannelId)

		// 2. 查询1个月内的抖音订单，且手续费和佣金都为空的订单
		oneMonthAgo := time.Now().AddDate(0, -1, 0)

		param := &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "channelId",
					Value: douyinChannelId,
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
				{
					Field: "createdAt",
					Value: oneMonthAgo,
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
			Page:     1,
			PageSize: 10000, // 一次最多查询10000条
		}

		orderList, _, err := s.orderRepo.FindMultiByCondition(ctx, param)
		if err != nil {
			s.log.Errorf("SyncDouYinSettleInfo: 查询订单失败, err=%v", err)
			return errorx.DataSQLErr.WithError(err).Err()
		}

		s.log.Infof("SyncDouYinSettleInfo: 查询到 %d 个抖音订单", len(orderList))

		// 3. 过滤出手续费和佣金都为空的订单
		var needSyncOrders []*yanxue_model.Order
		for _, order := range orderList {
			// 如果手续费和佣金都已经有值，则跳过
			if order.PlatformFee != 0 && order.TalentCommission != 0 {
				continue
			}
			needSyncOrders = append(needSyncOrders, order)
		}

		s.log.Infof("SyncDouYinSettleInfo: 需要同步分账信息的订单数量=%d", len(needSyncOrders))

		if len(needSyncOrders) == 0 {
			s.log.Info("SyncDouYinSettleInfo: 没有需要同步的订单")
			return nil
		}

		// 4. 串行查询分账信息（避免触发第三方限流）
		successCount := 0
		skipCount := 0
		failCount := 0

		for _, order := range needSyncOrders {
			// 4.1 先通过原始订单号查询订单信息，获取券ID列表
			orderInfoReply, err := s.httpRpc.QueryDouYinOrderInfo(ctx, &rpc.QueryDouYinOrderInfoReqParams{
				AccountId: constant.DouYinAccountId,
				OrderId:   order.OriginOrderNumber,
				PageNum:   1,
				PageSize:  100,
			})

			if err != nil {
				s.log.Errorf("SyncDouYinSettleInfo: 查询订单信息失败, orderId=%s, originOrderNumber=%s, err=%v",
					order.ID, order.OriginOrderNumber, err)
				failCount++
				continue
			}

			// 如果没有订单信息，跳过
			if len(orderInfoReply.Data.Orders) == 0 {
				s.log.Infof("SyncDouYinSettleInfo: 订单信息为空, orderId=%s, originOrderNumber=%s",
					order.ID, order.OriginOrderNumber)
				skipCount++
				continue
			}

			// 获取订单的券ID列表
			var certificateIds []string
			for _, cert := range orderInfoReply.Data.Orders[0].Certificate {
				if cert.CertificateId != "" {
					certificateIds = append(certificateIds, cert.CertificateId)
				}
			}

			if len(certificateIds) == 0 {
				s.log.Infof("SyncDouYinSettleInfo: 订单没有券ID, orderId=%s, originOrderNumber=%s",
					order.ID, order.OriginOrderNumber)
				skipCount++
				continue
			}

			// 4.2 通过券ID查询分账明细
			ledgerReply, err := s.httpRpc.QueryDouYinLedgerRecordByCert(ctx, &rpc.QueryDouYinLedgerRecordByCertReqParams{
				CertificateIds: certificateIds,
			})

			if err != nil {
				s.log.Errorf("SyncDouYinSettleInfo: 查询分账明细失败, orderId=%s, originOrderNumber=%s, err=%v",
					order.ID, order.OriginOrderNumber, err)
				failCount++
				continue
			}

			// 如果没有分账记录，跳过
			if len(ledgerReply.Data.Records) == 0 {
				s.log.Infof("SyncDouYinSettleInfo: 订单暂无分账记录, orderId=%s, originOrderNumber=%s",
					order.ID, order.OriginOrderNumber)
				skipCount++
				continue
			}

			// 4.3 汇总所有分账记录的手续费、佣金、商家优惠和保险费
			// 在通兑券场景下，一个券码可能返回两笔分账单，需要将两笔分账加总
			var totalPlatformFee int64 = 0
			var totalTalentCommission int64 = 0
			var totalMerchantTicket int64 = 0
			var totalActualInsured int64 = 0

			for _, record := range ledgerReply.Data.Records {
				totalPlatformFee += record.FundAmount.TotalMerchantPlatformService
				totalTalentCommission += record.FundAmount.TalentCommission

				// 累加商家优惠（MerchantTicket）和保险费（ActualInsured）
				totalMerchantTicket += record.Amount.MerchantTicket
				totalActualInsured += record.Amount.ActualInsured
			}

			// 5. 更新父订单的手续费、佣金、商家优惠和保险费
			oldOrder := &yanxue_model.Order{}
			*oldOrder = *order

			// 累加手续费、佣金、商家优惠和保险费
			order.PlatformFee = int32(totalPlatformFee)
			order.TalentCommission = int32(totalTalentCommission)
			order.ShopDiscountAmount = int32(totalMerchantTicket)
			order.ActualInsured = int32(totalActualInsured)
			anchorId := strconv.FormatInt(orderInfoReply.Data.Orders[0].AnchorId, 10)
			order.TalentUID = anchorId

			err = s.orderRepo.UpdateOneCache(ctx, order, oldOrder)
			if err != nil {
				s.log.Errorf("SyncDouYinSettleInfo: 更新父订单失败, orderId=%s, err=%v", order.ID, err)
				failCount++
				continue
			}

			s.log.Infof("SyncDouYinSettleInfo: 更新父订单成功, orderId=%s, platformFee=%d分, talentCommission=%d分, shopDiscountAmount=%d分, actualInsured=%d分",
				order.ID, totalPlatformFee, totalTalentCommission, totalMerchantTicket, totalActualInsured)

			// 6. 更新子订单的手续费、佣金、商家优惠和保险费（平分）
			err = s.updateSubOrderSettleInfo(ctx, order.ID, int32(totalPlatformFee), int32(totalTalentCommission), int32(totalMerchantTicket), int32(totalActualInsured), anchorId)
			if err != nil {
				s.log.Errorf("SyncDouYinSettleInfo: 更新子订单失败, orderId=%s, err=%v", order.ID, err)
				failCount++
				continue
			}

			successCount++
		}

		s.log.Infof("SyncDouYinSettleInfo: 同步完成, 成功=%d, 跳过=%d, 失败=%d",
			successCount, skipCount, failCount)

		return nil
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
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
