package biz

import (
	"context"
	"fmt"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	yanxue_model "gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// FixRefundAmount 修复退款金额
func (s *ShadowV1OrderUseCase) FixRefundAmount(ctx context.Context, req *pb.FixRefundAmountReq) (*pb.FixRefundAmountReply, error) {
	resp := &pb.FixRefundAmountReply{}

	// 使用分布式锁检查是否有其他实例正在执行
	err := s.commonRepo.LockOnce(ctx, cache.FixRefundAmountLock.Key(), cache.FixRefundAmountLock.TTL(), func() error {
		// 异步执行修复任务，避免接口超时
		go func() {
			// 创建新的 context，避免使用原 ctx 导致超时
			asyncCtx := context.Background()
			s.fixRefundAmountAsync(asyncCtx)
		}()

		s.log.Infof("FixRefundAmount: 任务已启动，正在后台异步执行")
		return nil
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}

// fixRefundAmountAsync 异步修复退款金额的具体实现
func (s *ShadowV1OrderUseCase) fixRefundAmountAsync(ctx context.Context) {
	s.log.Infof("FixRefundAmount: 开始异步修复退款金额")
	startTime := time.Now()

	// 1. 查询2026年1月1日之后的已退款订单
	startDate := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	// 分页查询所有已退款订单
	const pageSize = 1000
	var allRefundedOrders []*yanxue_model.Order
	pageNum := int32(1)

	for {
		orders, reply, err := s.orderRepo.FindMultiByCondition(ctx, &condition.Req{
			Page:     pageNum,
			PageSize: pageSize,
			Query: []*condition.QueryParam{
				{
					Field: "paymentTime",
					Value: startDate,
					Exp:   condition.GTE,
					Logic: condition.AND,
				},
				{
					Field: "status",
					Value: constant.OrderStatusRefunded.String(),
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
			},
		})
		if err != nil {
			s.log.Errorf("FixRefundAmount: 查询已退款订单失败, pageNum=%d, err=%v", pageNum, err)
			return
		}

		allRefundedOrders = append(allRefundedOrders, orders...)
		s.log.Infof("FixRefundAmount: 查询已退款订单进度, 当前页=%d, 本页数量=%d, 累计数量=%d",
			pageNum, len(orders), len(allRefundedOrders))

		if reply.Total <= pageNum*pageSize {
			break
		}
		pageNum++
	}

	s.log.Infof("FixRefundAmount: 查询到已退款订单总数=%d", len(allRefundedOrders))

	if len(allRefundedOrders) == 0 {
		s.log.Infof("FixRefundAmount: 没有找到需要修复的订单")
		return
	}

	// 2. 检查每个父订单的退款金额是否与子订单退款金额总和一致
	var mismatchedOrders []*yanxue_model.Order
	mismatchedOrdersMap := make(map[string]int32) // orderId -> 子订单退款金额总和

	for _, order := range allRefundedOrders {
		// 查询该订单的所有子订单
		subOrders, _, err := s.subOrderRepo.FindMultiByCondition(ctx, &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "parentOrderId",
					Value: order.ID,
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
			},
		})
		if err != nil {
			s.log.Errorf("FixRefundAmount: 查询子订单失败, orderId=%s, err=%v", order.ID, err)
			continue
		}

		// 计算子订单退款金额总和
		var subOrdersRefundSum int32
		for _, subOrder := range subOrders {
			subOrdersRefundSum += subOrder.RefundAmount
		}

		// 检查是否一致
		if order.RefundAmount != subOrdersRefundSum {
			mismatchedOrders = append(mismatchedOrders, order)
			mismatchedOrdersMap[order.ID] = subOrdersRefundSum
			s.log.Warnf("FixRefundAmount: 发现退款金额不一致的订单, orderId=%s, orderNumber=%s, 父订单退款金额=%d, 子订单退款金额总和=%d, 差额=%d",
				order.ID, order.OrderNumber, order.RefundAmount, subOrdersRefundSum, order.RefundAmount-subOrdersRefundSum)
		}
	}

	s.log.Infof("FixRefundAmount: 发现退款金额不一致的订单数量=%d", len(mismatchedOrders))

	if len(mismatchedOrders) == 0 {
		s.log.Infof("FixRefundAmount: 所有订单的退款金额都一致，无需修复")
		return
	}

	// 3. 修复不一致的订单
	successCount := 0
	failCount := 0

	for i, order := range mismatchedOrders {
		s.log.Infof("FixRefundAmount: 开始修复订单退款金额, 进度=%d/%d, orderId=%s, orderNumber=%s",
			i+1, len(mismatchedOrders), order.ID, order.OrderNumber)

		// 重新分配退款金额到子订单
		err := DistributeRefundToSubOrders(
			ctx,
			order.ID,
			order.RefundAmount,
			order.RefundID,
			order.RefundReason,
			order.RefundTime,
			s.subOrderRepo,
			s.log,
		)

		if err != nil {
			failCount++
			reason := fmt.Sprintf("重新分配退款金额失败: %v", err)
			s.log.Errorf("FixRefundAmount: %s, orderId=%s, orderNumber=%s, 父订单退款金额=%d, 子订单退款金额总和=%d",
				reason, order.ID, order.OrderNumber, order.RefundAmount, mismatchedOrdersMap[order.ID])
		} else {
			successCount++
			s.log.Infof("FixRefundAmount: 订单退款金额修复成功, orderId=%s, orderNumber=%s, 退款金额=%d",
				order.ID, order.OrderNumber, order.RefundAmount)
		}
	}

	duration := time.Since(startTime)
	s.log.Infof("FixRefundAmount: 修复退款金额完成, 总数=%d, 成功=%d, 失败=%d, 耗时=%v",
		len(mismatchedOrders), successCount, failCount, duration)
}
