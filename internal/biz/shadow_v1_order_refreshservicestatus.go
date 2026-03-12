package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// RefreshServiceStatus 刷服务状态数据（异步执行）
func (s *ShadowV1OrderUseCase) RefreshServiceStatus(ctx context.Context, req *pb.RefreshServiceStatusReq) (*pb.RefreshServiceStatusReply, error) {
	resp := &pb.RefreshServiceStatusReply{}

	// 异步执行处理逻辑，避免接口超时
	go func() {
		// 使用 context.Background() 创建新的上下文，避免使用已超时的请求上下文
		bgCtx := context.Background()

		s.log.Infof("RefreshServiceStatus: 开始异步处理服务状态刷新任务, startTime=%s", req.GetStartTime())

		// 1. 查询需要刷新状态的订单
		orders, err := s.findOrdersToRefresh(bgCtx, req.GetStartTime())
		if err != nil {
			s.log.Errorf("RefreshServiceStatus: 查询订单失败, err=%v", err)
			return
		}

		s.log.Infof("RefreshServiceStatus: 找到 %d 个需要刷新状态的订单", len(orders))

		successCount := 0
		failCount := 0

		// 2. 遍历每个订单，刷新状态
		for _, order := range orders {
			err := s.refreshOrderStatus(bgCtx, order)
			if err != nil {
				s.log.Errorf("RefreshServiceStatus: 刷新订单状态失败, orderId=%s, err=%v", order.ID, err)
				failCount++
				continue
			}

			successCount++
			s.log.Infof("RefreshServiceStatus: 订单状态刷新成功, orderId=%s", order.ID)
		}

		s.log.Infof("RefreshServiceStatus: 异步处理完成, 总数=%d, 成功=%d, 失败=%d",
			len(orders), successCount, failCount)
	}()

	// 立即返回，告知任务已启动
	resp.TotalCount = 0
	resp.SuccessCount = 0
	resp.FailCount = 0

	s.log.Infof("RefreshServiceStatus: 任务已启动，正在后台异步执行")

	return resp, nil
}

// findOrdersToRefresh 查询需要刷新状态的订单
func (s *ShadowV1OrderUseCase) findOrdersToRefresh(ctx context.Context, startTime string) ([]*yanxue_model.Order, error) {
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
			s.log.Errorf("findOrdersToRefresh: 解析开始时间失败, startTime=%s, err=%v", startTime, err)
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

	// 过滤出需要刷新状态的订单（status 为 pending/success/completed/refunded）
	var ordersToRefresh []*yanxue_model.Order
	for _, order := range allOrders {
		status := order.Status
		if status == constant.OrderStatusPending.String() ||
			status == constant.OrderStatusSuccess.String() ||
			status == constant.OrderStatusCompleted.String() ||
			status == constant.OrderStatusRefunded.String() {
			ordersToRefresh = append(ordersToRefresh, order)
		}
	}

	return ordersToRefresh, nil
}

// refreshOrderStatus 刷新订单状态（从 SplitSubOrder 移过来的逻辑）
func (s *ShadowV1OrderUseCase) refreshOrderStatus(ctx context.Context, order *yanxue_model.Order) error {
	oldOrder := s.orderRepo.DeepCopy(order)
	needUpdate := false

	currentStatus := order.Status
	currentServiceStatus := order.ServiceStatus

	// 根据当前状态刷新
	switch currentStatus {
	case constant.OrderStatusPending.String(): // 待预约
		// status 刷成支付成功（pending）
		order.Status = constant.OrderStatusPending.String()
		// 根据子订单状态重新计算 ServiceStatus
		newServiceStatus := s.calculateParentServiceStatusFromSubOrders(ctx, order.ID)
		if newServiceStatus != currentServiceStatus {
			order.ServiceStatus = newServiceStatus
			s.log.Infof("refreshOrderStatus: 订单 ServiceStatus 需要更新, orderId=%s, 旧值=%s, 新值=%s",
				order.ID, currentServiceStatus, newServiceStatus)
		}
		needUpdate = true
		s.log.Infof("refreshOrderStatus: 订单状态从待预约刷新, orderId=%s", order.ID)

	case constant.OrderStatusSuccess.String(): // 已预约
		// status 刷成支付成功（pending）
		order.Status = constant.OrderStatusPending.String()
		// 根据子订单状态重新计算 ServiceStatus
		newServiceStatus := s.calculateParentServiceStatusFromSubOrders(ctx, order.ID)
		if newServiceStatus != currentServiceStatus {
			order.ServiceStatus = newServiceStatus
			s.log.Infof("refreshOrderStatus: 订单 ServiceStatus 需要更新, orderId=%s, 旧值=%s, 新值=%s",
				order.ID, currentServiceStatus, newServiceStatus)
		}
		needUpdate = true
		s.log.Infof("refreshOrderStatus: 订单状态从已预约刷新, orderId=%s", order.ID)

	case constant.OrderStatusCompleted.String(): // 已完成
		// status 刷成支付成功（pending）
		order.Status = constant.OrderStatusPending.String()
		// 根据子订单状态重新计算 ServiceStatus
		newServiceStatus := s.calculateParentServiceStatusFromSubOrders(ctx, order.ID)
		if newServiceStatus != currentServiceStatus {
			order.ServiceStatus = newServiceStatus
			s.log.Infof("refreshOrderStatus: 订单 ServiceStatus 需要更新, orderId=%s, 旧值=%s, 新值=%s",
				order.ID, currentServiceStatus, newServiceStatus)
		}
		needUpdate = true
		s.log.Infof("refreshOrderStatus: 订单状态从已完成刷新, orderId=%s", order.ID)

	case constant.OrderStatusRefunded.String(): // 已退款
		// status 保持已退款状态不变
		order.Status = constant.OrderStatusRefunded.String()
		// 根据子订单状态重新计算 ServiceStatus
		newServiceStatus := s.calculateParentServiceStatusFromSubOrders(ctx, order.ID)
		if newServiceStatus != currentServiceStatus {
			order.ServiceStatus = newServiceStatus
			s.log.Infof("refreshOrderStatus: 订单 ServiceStatus 需要更新, orderId=%s, 旧值=%s, 新值=%s",
				order.ID, currentServiceStatus, newServiceStatus)
		}
		needUpdate = true
		s.log.Infof("refreshOrderStatus: 订单状态从已退款刷新, orderId=%s", order.ID)

	default:
		// 其他状态不处理
		s.log.Infof("refreshOrderStatus: 订单状态无需刷新, orderId=%s, status=%s",
			order.ID, currentStatus)
	}

	// 如果需要更新，则更新订单
	if needUpdate {
		err := s.orderRepo.UpdateOneCache(ctx, order, oldOrder)
		if err != nil {
			s.log.Errorf("refreshOrderStatus: 更新订单状态失败, orderId=%s, err=%v", order.ID, err)
			return err
		}
		s.log.Infof("refreshOrderStatus: 订单状态更新成功, orderId=%s, status: %s->%s, serviceStatus: %s->%s",
			order.ID, currentStatus, order.Status, currentServiceStatus, order.ServiceStatus)
	}

	return nil
}

// checkAllAppointmentsUsed 检查订单的预约次数是否全部用完
// 判断逻辑：如果所有子订单的 ServiceStatus 都是"已预约"或"已完成"，则说明预约次数全部用完
func (s *ShadowV1OrderUseCase) checkAllAppointmentsUsed(ctx context.Context, orderId string) bool {
	// 查询该订单的所有子订单
	subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, orderId)
	if err != nil {
		s.log.Errorf("checkAllAppointmentsUsed: 查询子订单失败, orderId=%s, err=%v", orderId, err)
		// 查询失败时，默认返回 false（未全部用完）
		return false
	}

	// 如果没有子订单，说明预约次数未全部用完
	if len(subOrders) == 0 {
		s.log.Infof("checkAllAppointmentsUsed: 订单没有子订单，预约次数未全部用完, orderId=%s", orderId)
		return false
	}

	// 统计已预约或已完成的子订单数量
	usedCount := 0
	for _, subOrder := range subOrders {
		if subOrder.ServiceStatus == string(constant.OrderStatusSuccess) || // 已预约
			subOrder.ServiceStatus == string(constant.OrderStatusCompleted) { // 已完成
			usedCount++
		}
	}

	// 如果已预约或已完成的子订单数量等于子订单总数，说明预约次数全部用完
	allUsed := usedCount == len(subOrders)
	s.log.Infof("checkAllAppointmentsUsed: 订单预约次数检查, orderId=%s, 子订单总数=%d, 已预约/已完成数量=%d, 是否全部用完=%v",
		orderId, len(subOrders), usedCount, allUsed)

	return allUsed
}

// calculateParentServiceStatusFromSubOrders 根据子订单的 ServiceStatus 计算父订单的 ServiceStatus
// 规则：
// 1. 如果有一个子订单是"待预约"，则父订单的 ServiceStatus 为"待预约"
// 2. 如果所有子订单都是"已完成"，则父订单的 ServiceStatus 为"已完成"
// 3. 否则（即至少有一个是"已预约"，但没有"待预约"的），父订单的 ServiceStatus 为"已预约"
func (s *ShadowV1OrderUseCase) calculateParentServiceStatusFromSubOrders(ctx context.Context, orderId string) string {
	// 查询该订单的所有子订单
	subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, orderId)
	if err != nil {
		s.log.Errorf("calculateParentServiceStatusFromSubOrders: 查询子订单失败, orderId=%s, err=%v", orderId, err)
		// 查询失败时，默认返回"待预约"
		return string(constant.OrderStatusPending)
	}

	// 如果没有子订单，返回"待预约"
	if len(subOrders) == 0 {
		s.log.Infof("calculateParentServiceStatusFromSubOrders: 订单没有子订单，返回待预约, orderId=%s", orderId)
		return string(constant.OrderStatusPending)
	}

	// 统计各种状态的子订单数量
	pendingCount := 0   // 待预约
	successCount := 0   // 已预约
	completedCount := 0 // 已完成

	for _, subOrder := range subOrders {
		switch subOrder.ServiceStatus {
		case string(constant.OrderStatusPending): // 待预约
			pendingCount++
		case string(constant.OrderStatusSuccess): // 已预约
			successCount++
		case string(constant.OrderStatusCompleted): // 已完成
			completedCount++
		}
	}

	s.log.Infof("calculateParentServiceStatusFromSubOrders: 订单子订单状态统计, orderId=%s, 子订单总数=%d, 待预约=%d, 已预约=%d, 已完成=%d",
		orderId, len(subOrders), pendingCount, successCount, completedCount)

	// 规则1: 如果有一个子订单是"待预约"，则父订单的 ServiceStatus 为"待预约"
	if pendingCount > 0 {
		s.log.Infof("calculateParentServiceStatusFromSubOrders: 存在待预约子订单，父订单ServiceStatus设置为待预约, orderId=%s", orderId)
		return string(constant.OrderStatusPending)
	}

	// 规则2: 如果所有子订单都是"已完成"，则父订单的 ServiceStatus 为"已完成"
	if completedCount == len(subOrders) {
		s.log.Infof("calculateParentServiceStatusFromSubOrders: 所有子订单都是已完成，父订单ServiceStatus设置为已完成, orderId=%s", orderId)
		return string(constant.OrderStatusCompleted)
	}

	// 规则3: 否则（即至少有一个是"已预约"，但没有"待预约"的），父订单的 ServiceStatus 为"已预约"
	s.log.Infof("calculateParentServiceStatusFromSubOrders: 至少有一个已预约子订单且没有待预约，父订单ServiceStatus设置为已预约, orderId=%s", orderId)
	return string(constant.OrderStatusSuccess)
}
