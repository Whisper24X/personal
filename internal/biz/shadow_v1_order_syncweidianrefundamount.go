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

// SyncWeiDianRefundAmount 同步微店渠道已退款订单的退款金额（2026年1月1日起）
func (s *ShadowV1OrderUseCase) SyncWeiDianRefundAmount(ctx context.Context, req *pb.SyncWeiDianRefundAmountReq) (*pb.SyncWeiDianRefundAmountReply, error) {
	resp := &pb.SyncWeiDianRefundAmountReply{}

	// 使用分布式锁，避免重复执行
	err := s.commonRepo.LockOnce(ctx, cache.SyncWeiDianRefundAmountLock.Key(), cache.SyncWeiDianRefundAmountLock.TTL(), func() error {
		// 异步执行同步任务
		go func() {
			// 使用 context.Background() 避免请求超时影响后台任务
			bgCtx := context.Background()
			s.log.Infof("SyncWeiDianRefundAmount: 开始异步同步微店退款金额")

			// 执行同步逻辑
			err := s.syncWeiDianRefundAmountAsync(bgCtx)
			if err != nil {
				s.log.Errorf("SyncWeiDianRefundAmount: 异步同步失败, err=%v", err)
			} else {
				s.log.Infof("SyncWeiDianRefundAmount: 异步同步完成")
			}
		}()

		s.log.Infof("SyncWeiDianRefundAmount: 已启动异步任务")
		return nil
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}

// syncWeiDianRefundAmountAsync 异步同步微店退款金额的具体实现
func (s *ShadowV1OrderUseCase) syncWeiDianRefundAmountAsync(ctx context.Context) error {
	// 1. 获取微店访问令牌
	accessToken, err := s.getWeiDianAccessToken(ctx)
	if err != nil {
		s.log.Errorf("SyncWeiDianRefundAmount: 获取微店访问令牌失败, err=%v", err)
		return err
	}

	s.log.Infof("SyncWeiDianRefundAmount: 成功获取微店访问令牌")

	// 2. 查询微店渠道ID
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}

	var wdChannelId string
	for _, channel := range channelList {
		if channel.Name == constant.ChannelTypeWD {
			wdChannelId = channel.ID
			break
		}
	}

	if wdChannelId == "" {
		s.log.Errorf("SyncWeiDianRefundAmount: 未找到微店渠道")
		return errorx.DataRecordNotFound.Err()
	}

	s.log.Infof("SyncWeiDianRefundAmount: 微店渠道ID=%s", wdChannelId)

	// 3. 查询2026年1月1日开始的微店渠道已退款订单
	startTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.Local)
	param := &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "channelId",
				Value: wdChannelId,
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
				Field: "status",
				Value: []string{
					constant.OrderStatusRefunded.String(),
					constant.OrderStatusPartialRefunded.String(),
				},
				Exp:   condition.IN,
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

	refundedOrders, _, err := s.orderRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}

	s.log.Infof("SyncWeiDianRefundAmount: 查询到微店已退款订单总数=%d", len(refundedOrders))

	if len(refundedOrders) == 0 {
		s.log.Infof("SyncWeiDianRefundAmount: 没有需要同步的订单")
		return nil
	}

	// 4. 按 OriginOrderNumber 分组订单（同一笔微店订单可能拆分成多个父订单）
	originOrderMap := make(map[string][]*yanxue_model.Order)
	for _, order := range refundedOrders {
		originOrderMap[order.OriginOrderNumber] = append(originOrderMap[order.OriginOrderNumber], order)
	}

	s.log.Infof("SyncWeiDianRefundAmount: 按原始订单号分组，共 %d 个原始订单", len(originOrderMap))

	// 5. 串行处理订单
	successCount := 0
	failCount := 0
	totalOrders := len(refundedOrders)
	processedOrders := 0

	// 遍历每个原始订单号
	for originOrderNumber, orders := range originOrderMap {
		// 查询微店订单详情，获取退款金额
		orderDetail, err := s.httpRpc.QueryWeiDianOrderDetail(ctx, &rpc.QueryWeiDianOrderDetailReqParams{
			OrderId: originOrderNumber,
		}, accessToken)

		if err != nil {
			s.log.Errorf("SyncWeiDianRefundAmount: 查询微店订单详情失败, originOrderNumber=%s, err=%v", originOrderNumber, err)
			failCount += len(orders)
			processedOrders += len(orders)
			s.log.Infof("SyncWeiDianRefundAmount: 进度 %d/%d (成功=%d, 失败=%d)", processedOrders, totalOrders, successCount, failCount)
			continue
		}

		// 计算实际退款金额（单位：分）
		var totalRefundAmount int32 = 0
		var refundNo string
		for _, item := range orderDetail.Result.Items {
			if item.RefundInfo.RefundFee != "" {
				// 退款金额单位为元，需要转换为分
				refundFeeFloat, parseErr := strconv.ParseFloat(item.RefundInfo.RefundFee, 64)
				if parseErr != nil {
					s.log.Errorf("SyncWeiDianRefundAmount: 解析退款金额失败, originOrderNumber=%s, refundFee=%s, err=%v",
						originOrderNumber, item.RefundInfo.RefundFee, parseErr)
					continue
				}
				totalRefundAmount += int32(refundFeeFloat*100 + 0.5) // 元转分，四舍五入
			}
			// 获取退款单号（取第一个有效的退款单号）
			if refundNo == "" && item.RefundInfo.RefundNo != "" {
				refundNo = item.RefundInfo.RefundNo
			}
		}

		// 如果没有获取到退款金额，记录警告
		if totalRefundAmount == 0 {
			s.log.Warnf("SyncWeiDianRefundAmount: 未获取到退款金额, originOrderNumber=%s", originOrderNumber)
		}

		s.log.Infof("SyncWeiDianRefundAmount: 微店订单总退款金额, originOrderNumber=%s, totalRefundAmount=%d分, 父订单数=%d",
			originOrderNumber, totalRefundAmount, len(orders))

		// 从 QueryWeiDianRefundDetail 接口获取退款时间
		var refundTime *time.Time
		if refundNo != "" {
			refundDetail, err := s.httpRpc.QueryWeiDianRefundDetail(ctx, &rpc.QueryWeiDianRefundDetailReq{
				RefundNo: refundNo,
			}, accessToken)
			if err != nil {
				s.log.Errorf("SyncWeiDianRefundAmount: 查询微店退款详情失败, originOrderNumber=%s, refundNo=%s, err=%v", originOrderNumber, refundNo, err)
			} else if refundDetail.Result.RefundBasicInfo.FinishTime > 0 {
				// 解析退款时间：FinishTime 是毫秒级时间戳
				parsedTime := time.Unix(0, refundDetail.Result.RefundBasicInfo.FinishTime*int64(time.Millisecond))
				refundTime = &parsedTime
				s.log.Infof("SyncWeiDianRefundAmount: 获取退款时间, originOrderNumber=%s, refundNo=%s, refundTime=%s",
					originOrderNumber, refundNo, refundTime.Format("2006-01-02 15:04:05"))
			}
		}

		// 计算每个父订单的退款金额（平均分配，最后一个补齐差额）
		orderCount := int32(len(orders))
		avgRefundAmount := totalRefundAmount / orderCount

		s.log.Infof("SyncWeiDianRefundAmount: 微店订单退款金额分配, originOrderNumber=%s, 平均退款=%d分, 订单数=%d",
			originOrderNumber, avgRefundAmount, orderCount)

		// 处理每个父订单
		for i, order := range orders {
			// 计算当前订单的退款金额
			var orderRefundAmount int32
			if i == len(orders)-1 {
				// 最后一个订单补齐差额
				orderRefundAmount = totalRefundAmount - (avgRefundAmount * (orderCount - 1))
			} else {
				orderRefundAmount = avgRefundAmount
			}

			s.log.Infof("SyncWeiDianRefundAmount: 微店父订单退款金额, orderId=%s, orderNumber=%s, 旧退款金额=%d分, 新退款金额=%d分",
				order.ID, order.OrderNumber, order.RefundAmount, orderRefundAmount)

			// 更新父订单的退款金额和退款时间
			oldOrder := s.orderRepo.DeepCopy(order)
			order.RefundAmount = orderRefundAmount
			// 只有在成功获取到退款时间时才更新
			if refundTime != nil {
				order.RefundTime = *refundTime
			}

			err = s.orderRepo.UpdateOneCache(ctx, order, oldOrder)
			if err != nil {
				s.log.Errorf("SyncWeiDianRefundAmount: 更新父订单失败, orderId=%s, err=%v", order.ID, err)
				failCount++
				continue
			}

			// 分配退款金额到子订单
			err = DistributeRefundToSubOrders(
				ctx,
				order.ID,
				orderRefundAmount,
				order.RefundID,
				order.RefundReason,
				order.RefundTime,
				s.subOrderRepo,
				s.log,
			)
			if err != nil {
				s.log.Errorf("SyncWeiDianRefundAmount: 分配退款金额到子订单失败, orderId=%s, err=%v", order.ID, err)
				failCount++
				continue
			}

			successCount++
			processedOrders++
			s.log.Infof("SyncWeiDianRefundAmount: 微店订单退款金额同步成功, orderId=%s, orderNumber=%s, 进度=%d/%d (成功=%d, 失败=%d)",
				order.ID, order.OrderNumber, processedOrders, totalOrders, successCount, failCount)
		}
	}

	s.log.Infof("SyncWeiDianRefundAmount: 微店退款金额同步完成, 总数=%d, 成功=%d, 失败=%d", totalOrders, successCount, failCount)
	return nil
}

// getWeiDianAccessToken 获取微店访问令牌
func (s *ShadowV1OrderUseCase) getWeiDianAccessToken(ctx context.Context) (string, error) {
	// 先从缓存获取
	token, err := s.orderRepo.CacheWeiDianAccessTokenGet(ctx)
	if err != nil {
		return "", err
	}

	// 如果缓存中有，直接返回
	if token != "" {
		return token, nil
	}

	// 如果缓存中没有，从API获取
	accessToken, err := s.httpRpc.GetWeiDianAccessToken(ctx)
	if err != nil {
		return "", err
	}

	if accessToken == "" {
		return "", errorx.APIInternalErr.Err()
	}

	// 设置到缓存
	err = s.orderRepo.CacheWeiDianAccessTokenSet(ctx, accessToken)
	if err != nil {
		s.log.Errorf("SyncWeiDianRefundAmount: 设置微店访问令牌缓存失败, err=%v", err)
	}

	return accessToken, nil
}
