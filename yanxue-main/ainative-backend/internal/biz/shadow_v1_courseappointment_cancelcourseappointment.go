package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	ctxn "gitlab.yc345.tv/backend/yanxue/internal/pkg/middleware/ctx"
)

// CancelCourseAppointment 课程-预约-取消预约
func (s *ShadowV1CourseAppointmentUseCase) CancelCourseAppointment(ctx context.Context, req *pb.CancelCourseAppointmentReq) (*pb.CancelCourseAppointmentReply, error) {
	resp := &pb.CancelCourseAppointmentReply{}
	adminId := meta.GetAdminID(ctx)
	courseAppointment, err := s.courseAppointmentRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if courseAppointment == nil || courseAppointment.ID == "" {
		return nil, errorx.DataSQLErr.Err()
	}
	// 只能取消已预约状态
	if courseAppointment.Status != constant.CourseAppointmentStatusSuccess.String() {
		return nil, errorx.CourseAppointmentStatusNotAllowed.Err()
	}
	oldCourseAppointment := s.courseAppointmentRepo.DeepCopy(courseAppointment)
	courseAppointment.Status = constant.CourseAppointmentStatusCancel.String()
	courseAppointment.UpdatedBy = adminId
	err = s.courseAppointmentRepo.UpdateOneCacheWithZero(ctx, courseAppointment, oldCourseAppointment)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 更新订单和子订单的ServiceStatus
	err = s.updateOrderServiceStatusOnCancel(ctx, courseAppointment.OrderID)
	if err != nil {
		s.log.Errorf("更新订单ServiceStatus失败，orderId=%s, err=%v", courseAppointment.OrderID, err)
		// 更新失败不影响主流程，继续执行
	}

	neverDoneCtx := ctxn.NewNeverDoneCtx(ctx)
	go func() {
		err := s.bffRepo.CancelOrder(neverDoneCtx, courseAppointment.OrderID)
		if err != nil {
			s.log.Errorf("CancelOrder orderId: %s error: %v", courseAppointment.OrderID, err)
		}
	}()
	return resp, nil
}

// updateOrderServiceStatusOnCancel 取消预约时更新订单和子订单的ServiceStatus
// 将一个已预约的子订单的ServiceStatus改为待预约，并将父订单ServiceStatus改为待预约
func (s *ShadowV1CourseAppointmentUseCase) updateOrderServiceStatusOnCancel(ctx context.Context, orderId string) error {
	// 1. 查询父订单
	order, err := s.orderRepo.FindOneCacheByID(ctx, orderId)
	if err != nil {
		return err
	}
	if order == nil || order.ID == "" {
		s.log.Warnf("订单不存在，orderId=%s", orderId)
		return nil
	}

	// 2. 直接更新父订单ServiceStatus为待预约（只要取消一个预约，父订单就应该变为待预约）
	if order.ServiceStatus == constant.OrderStatusSuccess.String() {
		oldOrder := s.orderRepo.DeepCopy(order)
		order.ServiceStatus = constant.OrderStatusPending.String()
		err = s.orderRepo.UpdateOneCacheWithZero(ctx, order, oldOrder)
		if err != nil {
			return err
		}
		s.log.Infof("取消预约：更新父订单ServiceStatus为待预约，orderId=%s", orderId)
	}

	// 3. 查询该订单的所有子订单
	subOrders, err := s.subOrderRepo.FindMultiCacheByParentOrderID(ctx, orderId)
	if err != nil {
		return err
	}

	// 如果没有子订单，直接返回
	if len(subOrders) == 0 {
		return nil
	}

	// 4. 找到一个已预约状态的子订单，将其改为待预约
	for _, subOrder := range subOrders {
		if subOrder.ServiceStatus == string(constant.OrderStatusSuccess) {
			oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)
			subOrder.ServiceStatus = string(constant.OrderStatusPending)
			err = s.subOrderRepo.UpdateOneCache(ctx, subOrder, oldSubOrder)
			if err != nil {
				s.log.Errorf("更新子订单ServiceStatus失败，subOrderId=%s, err=%v", subOrder.ID, err)
				continue
			}
			s.log.Infof("取消预约：更新子订单ServiceStatus为待预约，subOrderId=%s", subOrder.ID)
			break
		}
	}

	return nil
}
