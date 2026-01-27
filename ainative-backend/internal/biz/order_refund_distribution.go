package biz

import (
	"context"
	"sort"
	"time"

	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// DistributeRefundToSubOrders 将退款金额分配到子订单
// 参数:
//
//	ctx: 上下文
//	parentOrderId: 父订单ID
//	refundAmountInCents: 退款金额（单位：分）
//	refundID: 退款单ID（从父订单获取）
//	refundReason: 退款原因（从父订单获取）
//	refundTime: 退款时间（从父订单获取）
//	subOrderRepo: 子订单仓库
//
// 返回:
//
//	error: 错误信息
//
// 退款分配规则:
// 1. 按照ServiceStatus判断退款优先级：【待预约】> 【已预约】>【已完成】
// 2. 若同ServiceStatus下存在多条子订单，则按照创建时间顺序退款（先创建的先退）
// 3. 如果金额可以完全覆盖子订单金额，则状态改为"已退款"，否则为"部分退款"
// 4. 同步更新子订单的退款时间、退款单ID和退款原因
func DistributeRefundToSubOrders(
	ctx context.Context,
	parentOrderId string,
	refundAmountInCents int32,
	refundID string,
	refundReason string,
	refundTime time.Time,
	subOrderRepo SubOrderRepo,
	log interface {
		Infof(format string, args ...interface{})
	},
) error {
	// 1. 查询所有子订单
	subOrders, err := subOrderRepo.FindMultiByParentOrderID(ctx, parentOrderId)
	if err != nil {
		return err
	}

	// 如果没有子订单，直接返回
	if len(subOrders) == 0 {
		log.Infof("订单没有子订单，跳过退款分配，parentOrderId=%s", parentOrderId)
		return nil
	}

	// 2. 过滤掉已经退款的子订单
	var availableSubOrders []*yanxue_model.SubOrder
	for _, subOrder := range subOrders {
		if subOrder.Status != string(constant.OrderStatusRefunded) {
			availableSubOrders = append(availableSubOrders, subOrder)
		}
	}

	if len(availableSubOrders) == 0 {
		log.Infof("所有子订单都已退款，跳过退款分配，parentOrderId=%s", parentOrderId)
		return nil
	}

	// 3. 按照优先级排序子订单
	sortSubOrdersByRefundPriority(availableSubOrders)

	// 4. 分配退款金额
	remainingRefund := refundAmountInCents
	for _, subOrder := range availableSubOrders {
		if remainingRefund <= 0 {
			break
		}

		oldSubOrder := subOrderRepo.DeepCopy(subOrder)

		// 计算本次退款金额（退款只会退一次，直接按订单金额分配）
		refundForThisSubOrder := remainingRefund
		if refundForThisSubOrder > subOrder.OrderPrice {
			refundForThisSubOrder = subOrder.OrderPrice
		}

		// 直接赋值子订单退款金额（不累加）
		subOrder.RefundAmount = refundForThisSubOrder
		remainingRefund -= refundForThisSubOrder

		// 更新子订单退款相关信息（从父订单同步）
		subOrder.RefundID = refundID
		subOrder.RefundReason = refundReason
		subOrder.RefundTime = refundTime

		// 更新子订单状态
		if subOrder.RefundAmount >= subOrder.OrderPrice {
			// 完全退款
			subOrder.Status = string(constant.OrderStatusRefunded)
			log.Infof("子订单完全退款，subOrderId=%s, refundAmount=%d分, orderPrice=%d分, refundID=%s",
				subOrder.ID, subOrder.RefundAmount, subOrder.OrderPrice, refundID)
		} else {
			// 部分退款
			subOrder.Status = string(constant.OrderStatusPartialRefunded)
			log.Infof("子订单部分退款，subOrderId=%s, refundAmount=%d分, orderPrice=%d分, refundID=%s",
				subOrder.ID, subOrder.RefundAmount, subOrder.OrderPrice, refundID)
		}

		// 保存子订单
		err = subOrderRepo.UpdateOneCache(ctx, subOrder, oldSubOrder)
		if err != nil {
			log.Infof("更新子订单退款信息失败，subOrderId=%s, err=%v", subOrder.ID, err)
			return err
		}
	}

	log.Infof("退款分配完成，parentOrderId=%s, totalRefund=%d分, remaining=%d分",
		parentOrderId, refundAmountInCents, remainingRefund)

	return nil
}

// sortSubOrdersByRefundPriority 按照退款优先级排序子订单
// 优先级规则：
// 1. 按照ServiceStatus：待预约 > 已预约 > 已完成
// 2. 同ServiceStatus下按照创建时间升序（先创建的先退）
func sortSubOrdersByRefundPriority(subOrders []*yanxue_model.SubOrder) {
	sort.Slice(subOrders, func(i, j int) bool {
		// 获取ServiceStatus优先级
		priorityI := getServiceStatusRefundPriority(subOrders[i].ServiceStatus)
		priorityJ := getServiceStatusRefundPriority(subOrders[j].ServiceStatus)

		// 优先级不同，按优先级排序
		if priorityI != priorityJ {
			return priorityI < priorityJ // 优先级值越小越优先
		}

		// 优先级相同，按创建时间升序
		return subOrders[i].CreatedAt.Before(subOrders[j].CreatedAt)
	})
}

// getServiceStatusRefundPriority 获取ServiceStatus的退款优先级
// 返回值越小，优先级越高
// ServiceStatus字段存储的是OrderStatus枚举值的字符串形式
func getServiceStatusRefundPriority(serviceStatus string) int {
	switch serviceStatus {
	case string(constant.OrderStatusPending): // 待预约
		return 1
	case string(constant.OrderStatusSuccess): // 已预约
		return 2
	case string(constant.OrderStatusCompleted): // 已完成
		return 3
	default:
		return 999 // 其他状态优先级最低
	}
}
