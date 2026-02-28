package biz

import (
	"context"
	"sync"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// UpdateOrderDetail 订单-修改订单详情
func (s *ShadowV1OrderUseCase) UpdateOrderDetail(ctx context.Context, req *pb.UpdateOrderDetailReq) (*pb.UpdateOrderDetailReply, error) {
	resp := &pb.UpdateOrderDetailReply{}
	adminId := meta.GetAdminID(ctx)
	// 操作类型（记录操作日志）
	operationType := ""

	// 校验参数
	// 校验手机号
	if req.GetPhone() != "" {
		operationType = constant.OperationTypeOrderUpdatePhone
		if !IsValidPhoneNumber(req.GetPhone()) {
			return resp, errorx.ParamPhoneInvalid.Err()
		}
	}
	// 校验状态
	if req.GetStatus() != "" {
		operationType = constant.OperationTypeOrderUpdateStatus
		if req.GetStatus() != string(constant.OrderStatusRefunded) {
			return resp, errorx.OrderStatusNotAllowed.Err()
		}
	}

	orderInfo, err := s.orderRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if orderInfo == nil || orderInfo.ID == "" {
		return resp, errorx.OrderNotExists.Err()
	}

	// 如果是从退款失败扭转到已退款，需要填备注
	if orderInfo.Status == string(constant.OrderStatusFailedRefund) &&
		req.GetStatus() == string(constant.OrderStatusRefunded) {
		operationType = constant.OperationTypeOrderUpdateStatusToRefund
		if req.GetRemark() == "" {
			return resp, errorx.ParamValidationErr.Err()
		}
	}

	// 只有待预约状态可以修改手机号
	if req.GetPhone() != "" && orderInfo.ServiceStatus != string(constant.OrderStatusPending) &&
		orderInfo.ServiceStatus != string(constant.OrderStatusSuccess) {
		return resp, errorx.OrderChangePhoneNotAllowed.Err()
	}
	oldOrderInfo := s.orderRepo.DeepCopy(orderInfo)
	if req.GetStatus() != "" {
		orderInfo.Status = req.GetStatus()

		// 如果状态改为已退款，自动将退款金额设置为实付金额（OrderPrice）
		if req.GetStatus() == string(constant.OrderStatusRefunded) {
			// OrderPrice 是 float32，需要转换为分（int32）
			orderInfo.RefundAmount = int32(orderInfo.OrderPrice*100 + 0.5)
			s.log.Infof("UpdateOrderDetail: 订单状态改为已退款，自动设置退款金额=实付金额, orderId=%s, orderNumber=%s, orderPrice=%.2f元, refundAmount=%d分",
				orderInfo.ID, orderInfo.OrderNumber, orderInfo.OrderPrice, orderInfo.RefundAmount)
		}
	}
	if req.GetPhone() != "" {
		// 手机号加密
		ph, err := cryptutil.YcPhoneEncrypt(req.GetPhone())
		if err != nil {
			return resp, errorx.ParamPhoneInvalid.Err()
		}
		orderInfo.Ph = ph
	}
	orderInfo.UpdatedBy = adminId

	err = s.orderRepo.UpdateOneCache(ctx, orderInfo, oldOrderInfo)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 同步更新子订单的手机号、订单状态和退款金额
	if req.GetPhone() != "" || req.GetStatus() != "" {
		go func(newOrder *yanxue_model.Order, oldOrder *yanxue_model.Order, phone string, status string) {
			s.syncUpdateSubOrdersPhoneAndStatus(context.Background(), newOrder, oldOrder, phone, status)
		}(orderInfo, oldOrderInfo, req.GetPhone(), req.GetStatus())
	}

	// 写操作日志
	newData, _ := jsonutil.Marshal(orderInfo)
	oldData, _ := jsonutil.Marshal(oldOrderInfo)
	_ = s.sysDataLogRepo.CreateOneCache(ctx, &yanxue_model.SysDataLog{
		OperationType: operationType,
		OperatorID:    req.GetId(),
		OldData:       oldData,
		NewData:       newData,
		UpdatedBy:     adminId,
		Module:        constant.ModuleTypeOrder,
		Remark:        req.GetRemark(),
	})

	// 如果是退款，则需要发飞书通知
	if orderInfo.Status == string(constant.OrderStatusRefunded) {
		// 发送退款飞书通知
		go func(order *yanxue_model.Order) {
			s.SendOrderRefundNotification(context.Background(), order)
		}(orderInfo)
	}
	resp.IsSucceed = true

	return resp, nil
}

// syncUpdateSubOrdersPhoneAndStatus 同步更新子订单的手机号和订单状态
func (s *ShadowV1OrderUseCase) syncUpdateSubOrdersPhoneAndStatus(ctx context.Context, newOrder *yanxue_model.Order, oldOrder *yanxue_model.Order, phone string, status string) {
	// 查询该父订单的所有子订单
	subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, newOrder.ID)
	if err != nil {
		s.log.Errorf("syncUpdateSubOrdersPhoneAndStatus: 查询子订单失败, parentOrderId=%s, err=%v", newOrder.ID, err)
		return
	}

	if len(subOrders) == 0 {
		s.log.Infof("syncUpdateSubOrdersPhoneAndStatus: 父订单没有子订单, parentOrderId=%s", newOrder.ID)
		return
	}

	s.log.Infof("syncUpdateSubOrdersPhoneAndStatus: 开始同步更新子订单, parentOrderId=%s, 子订单数量=%d, phone=%s, status=%s",
		newOrder.ID, len(subOrders), phone, status)

	// 如果状态改为已退款，需要按比例分配退款金额到子订单
	var refundAmountPerSubOrder []int32
	if status == string(constant.OrderStatusRefunded) && newOrder.RefundAmount > 0 {
		subOrderCount := int32(len(subOrders))
		avgRefundAmount := newOrder.RefundAmount / subOrderCount

		// 计算每个子订单的退款金额（最后一个补齐差额）
		for i := 0; i < len(subOrders); i++ {
			if i == len(subOrders)-1 {
				// 最后一个子订单补齐差额
				remainingAmount := newOrder.RefundAmount - (avgRefundAmount * (subOrderCount - 1))
				refundAmountPerSubOrder = append(refundAmountPerSubOrder, remainingAmount)
			} else {
				refundAmountPerSubOrder = append(refundAmountPerSubOrder, avgRefundAmount)
			}
		}

		s.log.Infof("syncUpdateSubOrdersPhoneAndStatus: 父订单退款金额=%d分, 平均每个子订单=%d分",
			newOrder.RefundAmount, avgRefundAmount)
	}

	// 并发更新所有子订单
	wg := &sync.WaitGroup{}
	wg.Add(len(subOrders))
	for i, subOrder := range subOrders {
		go func(index int, subOrder *yanxue_model.SubOrder) {
			defer wg.Done()

			oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)

			// 更新手机号
			if phone != "" {
				subOrder.Ph = newOrder.Ph
				s.log.Infof("syncUpdateSubOrdersPhoneAndStatus: 更新子订单手机号, subOrderId=%s, subOrderNumber=%s",
					subOrder.ID, subOrder.OrderNumber)
			}

			// 更新订单状态
			if status != "" {
				subOrder.Status = newOrder.Status
				s.log.Infof("syncUpdateSubOrdersPhoneAndStatus: 更新子订单状态, subOrderId=%s, subOrderNumber=%s, status=%s",
					subOrder.ID, subOrder.OrderNumber, status)

				// 如果状态改为已退款，同步更新退款金额
				if status == string(constant.OrderStatusRefunded) && len(refundAmountPerSubOrder) > index {
					subOrder.RefundAmount = refundAmountPerSubOrder[index]
					s.log.Infof("syncUpdateSubOrdersPhoneAndStatus: 更新子订单退款金额, subOrderId=%s, subOrderNumber=%s, refundAmount=%d分",
						subOrder.ID, subOrder.OrderNumber, subOrder.RefundAmount)
				}
			}

			// 更新操作人
			subOrder.UpdatedBy = newOrder.UpdatedBy

			// 执行更新
			err := s.subOrderRepo.UpdateOneCache(context.Background(), subOrder, oldSubOrder)
			if err != nil {
				s.log.Errorf("syncUpdateSubOrdersPhoneAndStatus: 更新子订单失败, subOrderId=%s, err=%v", subOrder.ID, err)
				return
			}

			s.log.Infof("syncUpdateSubOrdersPhoneAndStatus: 更新子订单成功, subOrderId=%s, subOrderNumber=%s",
				subOrder.ID, subOrder.OrderNumber)
		}(i, subOrder)
	}

	wg.Wait()

	s.log.Infof("syncUpdateSubOrdersPhoneAndStatus: 子订单同步更新完成, parentOrderId=%s", newOrder.ID)
}
