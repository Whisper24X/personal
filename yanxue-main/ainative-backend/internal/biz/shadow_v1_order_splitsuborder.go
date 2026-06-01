package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// SplitSubOrder 拆分子订单（异步执行）
func (s *ShadowV1OrderUseCase) SplitSubOrder(ctx context.Context, req *pb.SplitSubOrderReq) (*pb.SplitSubOrderReply, error) {
	resp := &pb.SplitSubOrderReply{}

	// 异步执行处理逻辑，避免接口超时
	go func() {
		// 使用 context.Background() 创建新的上下文，避免使用已超时的请求上下文
		bgCtx := context.Background()

		s.log.Infof("SplitSubOrder: 开始异步处理订单拆分任务, startTime=%s", req.GetStartTime())

		// 1. 查询所有没有子订单的父订单
		ordersWithoutSubOrders, err := s.findOrdersWithoutSubOrders(bgCtx, req.GetStartTime())
		if err != nil {
			s.log.Errorf("SplitSubOrder: 查询没有子订单的父订单失败, err=%v", err)
			return
		}

		s.log.Infof("SplitSubOrder: 找到 %d 个没有子订单的父订单", len(ordersWithoutSubOrders))

		successCount := 0
		failCount := 0

		// 2. 遍历每个订单，拆分子订单
		for _, order := range ordersWithoutSubOrders {
			// 拆分子订单
			err = s.SplitOrderToSubOrders(bgCtx, order.ID)
			if err != nil {
				s.log.Errorf("SplitSubOrder: 拆分子订单失败, orderId=%s, err=%v", order.ID, err)
				failCount++
				continue
			}

			// 3. 如果父订单是已退款状态，需要更新子订单状态
			if order.Status == string(constant.OrderStatusRefunded) {
				err = s.updateSubOrderRefundStatus(bgCtx, order.ID)
				if err != nil {
					s.log.Errorf("SplitSubOrder: 更新子订单退款状态失败, orderId=%s, err=%v", order.ID, err)
					// 不影响成功计数，因为拆单已经成功
				}
			}

			successCount++
			s.log.Infof("SplitSubOrder: 订单处理成功, orderId=%s", order.ID)
		}

		s.log.Infof("SplitSubOrder: 异步处理完成, 总数=%d, 成功=%d, 失败=%d",
			len(ordersWithoutSubOrders), successCount, failCount)
	}()

	// 立即返回，告知任务已启动
	resp.TotalCount = 0
	resp.SuccessCount = 0
	resp.FailCount = 0

	s.log.Infof("SplitSubOrder: 任务已启动，正在后台异步执行")

	return resp, nil
}

// findOrdersWithoutSubOrders 查询所有没有子订单的父订单
func (s *ShadowV1OrderUseCase) findOrdersWithoutSubOrders(ctx context.Context, startTime string) ([]*yanxue_model.Order, error) {
	// 构建查询条件
	req := &condition.Req{
		Page:     1,
		PageSize: 10000, // 设置一个较大的值，确保能查询到所有订单
		Query:    []*condition.QueryParam{},
	}

	// 如果指定了开始时间，添加时间过滤条件
	if startTime != "" {
		// 解析时间字符串
		t, err := time.Parse("2006-01-02 15:04:05", startTime)
		if err != nil {
			s.log.Errorf("findOrdersWithoutSubOrders: 解析开始时间失败, startTime=%s, err=%v", startTime, err)
			return nil, err
		}

		// 添加创建时间过滤条件（大于等于 startTime）
		req.Query = append(req.Query, &condition.QueryParam{
			Field: "createdAt",
			Value: t,
			Exp:   condition.GTE,
			Logic: condition.AND,
		})
	}

	// 查询订单
	allOrders, _, err := s.orderRepo.FindMultiByCondition(ctx, req)
	if err != nil {
		return nil, err
	}

	// 过滤出没有子订单的订单
	var ordersWithoutSubOrders []*yanxue_model.Order
	for _, order := range allOrders {
		// 查询该订单的子订单
		subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, order.ID)
		if err != nil {
			s.log.Errorf("findOrdersWithoutSubOrders: 查询子订单失败, orderId=%s, err=%v", order.ID, err)
			continue
		}

		// 如果没有子订单，则加入列表
		if len(subOrders) == 0 {
			ordersWithoutSubOrders = append(ordersWithoutSubOrders, order)
		}
	}

	return ordersWithoutSubOrders, nil
}

// updateSubOrderRefundStatus 更新子订单的退款状态
// 根据子订单的实付金额和退款金额判断状态
func (s *ShadowV1OrderUseCase) updateSubOrderRefundStatus(ctx context.Context, parentOrderId string) error {
	// 1. 查询该父订单的所有子订单
	subOrders, err := s.subOrderRepo.FindMultiCacheByParentOrderID(ctx, parentOrderId)
	if err != nil {
		s.log.Errorf("updateSubOrderRefundStatus: 查询子订单失败, parentOrderId=%s, err=%v", parentOrderId, err)
		return err
	}

	if len(subOrders) == 0 {
		s.log.Warnf("updateSubOrderRefundStatus: 没有找到子订单, parentOrderId=%s", parentOrderId)
		return nil
	}

	s.log.Infof("updateSubOrderRefundStatus: 开始更新子订单退款状态, parentOrderId=%s, 子订单数=%d", parentOrderId, len(subOrders))

	// 2. 遍历每个子订单，判断并更新状态
	updateCount := 0
	for _, subOrder := range subOrders {
		needUpdate := false
		newStatus := subOrder.Status

		// 判断退款状态（使用 OrderPrice 实付金额与 RefundAmount 退款金额比较）
		// 实付金额 <= 退款金额 → 已退款
		if subOrder.OrderPrice <= subOrder.RefundAmount {
			newStatus = string(constant.OrderStatusRefunded)
			needUpdate = true
			s.log.Infof("updateSubOrderRefundStatus: 子订单全额退款, subOrderId=%s, orderNumber=%s, orderPrice=%d, refundAmount=%d",
				subOrder.ID, subOrder.OrderNumber, subOrder.OrderPrice, subOrder.RefundAmount)
		} else if subOrder.RefundAmount > 0 {
			// 实付金额 > 退款金额 且 退款金额 > 0 → 部分退款
			newStatus = string(constant.OrderStatusPartialRefunded)
			needUpdate = true
			s.log.Infof("updateSubOrderRefundStatus: 子订单部分退款, subOrderId=%s, orderNumber=%s, orderPrice=%d, refundAmount=%d",
				subOrder.ID, subOrder.OrderNumber, subOrder.OrderPrice, subOrder.RefundAmount)
		}

		// 3. 如果需要更新，则更新子订单状态（只更新 Status，不更新 ServiceStatus）
		if needUpdate {
			// 深拷贝原始数据
			oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)

			// 只更新 Status 字段
			subOrder.Status = newStatus

			err = s.subOrderRepo.UpdateOneCache(ctx, subOrder, oldSubOrder)
			if err != nil {
				s.log.Errorf("updateSubOrderRefundStatus: 更新子订单状态失败, subOrderId=%s, err=%v", subOrder.ID, err)
				continue
			}

			updateCount++
			s.log.Infof("updateSubOrderRefundStatus: 子订单状态更新成功, subOrderId=%s, orderNumber=%s, newStatus=%s, serviceStatus保持不变=%s",
				subOrder.ID, subOrder.OrderNumber, newStatus, subOrder.ServiceStatus)
		}
	}

	s.log.Infof("updateSubOrderRefundStatus: 子订单退款状态更新完成, parentOrderId=%s, 更新数=%d/%d",
		parentOrderId, updateCount, len(subOrders))

	return nil
}
