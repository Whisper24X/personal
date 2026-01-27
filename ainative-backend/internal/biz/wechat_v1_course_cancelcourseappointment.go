package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	ctxn "gitlab.yc345.tv/backend/yanxue/internal/pkg/middleware/ctx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// CancelCourseAppointment 课程-取消预约
func (w *WechatV1CourseUseCase) CancelCourseAppointment(ctx context.Context, req *pb.CancelCourseAppointmentReq) (*pb.CancelCourseAppointmentReply, error) {
	resp := &pb.CancelCourseAppointmentReply{}
	courseAppointment, err := w.courseAppointmentRepo.FindOneCacheByID(ctx, req.GetId())
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
	// 只能取消未来的日期的预约，上课日期距离当前日期的时间小于 3 天不能取消
	nowCarbon := timeutil.NowCarbon().StartOfDay()
	courseDateCarbon := timeutil.Carbon().Parse(courseAppointment.Date).StartOfDay()
	// 判断上课日期距离当前日期的时间小于 3 天不能取消
	if nowCarbon.DiffInDays(courseDateCarbon) < 3 {
		return nil, errorx.CourseAppointmentCancelTimeNotAllowed.Err()
	}
	oldCourseAppointment := w.courseAppointmentRepo.DeepCopy(courseAppointment)
	courseAppointment.Status = constant.CourseAppointmentStatusCancel.String()
	err = w.courseAppointmentRepo.UpdateOneCacheWithZero(ctx, courseAppointment, oldCourseAppointment)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 🆕 更新订单和子订单的ServiceStatus
	err = w.updateOrderServiceStatusOnCancel(ctx, courseAppointment.OrderID)
	if err != nil {
		w.log.Errorf("更新订单ServiceStatus失败，orderId=%s, err=%v", courseAppointment.OrderID, err)
		// 更新失败不影响主流程，继续执行
	}

	neverDoneCtx := ctxn.NewNeverDoneCtx(ctx)
	go func() {
		err := w.bffRepo.CancelOrder(neverDoneCtx, courseAppointment.OrderID)
		if err != nil {
			w.log.Errorf("CancelOrder orderId: %s error: %v", courseAppointment.OrderID, err)
		}
	}()
	return resp, nil
}

// updateOrderServiceStatusOnCancel 取消预约时更新订单和子订单的ServiceStatus
// 将一个已预约的子订单的ServiceStatus改为待预约，并将父订单ServiceStatus改为待预约
func (w *WechatV1CourseUseCase) updateOrderServiceStatusOnCancel(ctx context.Context, orderId string) error {
	// 1. 查询父订单
	order, err := w.orderRepo.FindOneCacheByID(ctx, orderId)
	if err != nil {
		return err
	}
	if order == nil || order.ID == "" {
		w.log.Warnf("订单不存在，orderId=%s", orderId)
		return nil
	}

	// 2. 直接更新父订单ServiceStatus为待预约（只要取消一个预约，父订单就应该变为待预约）
	if order.ServiceStatus == constant.OrderStatusSuccess.String() {
		oldOrder := w.orderRepo.DeepCopy(order)
		order.ServiceStatus = constant.OrderStatusPending.String()
		err = w.orderRepo.UpdateOneCacheWithZero(ctx, order, oldOrder)
		if err != nil {
			return err
		}
		w.log.Infof("取消预约：更新父订单ServiceStatus为待预约，orderId=%s", orderId)
	}

	// 3. 查询该订单的所有子订单
	subOrders, err := w.subOrderRepo.FindMultiCacheByParentOrderID(ctx, orderId)
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
			oldSubOrder := w.subOrderRepo.DeepCopy(subOrder)
			subOrder.ServiceStatus = string(constant.OrderStatusPending)
			err = w.subOrderRepo.UpdateOneCache(ctx, subOrder, oldSubOrder)
			if err != nil {
				w.log.Errorf("更新子订单ServiceStatus失败，subOrderId=%s, err=%v", subOrder.ID, err)
				continue
			}
			w.log.Infof("取消预约：更新子订单ServiceStatus为待预约，subOrderId=%s", subOrder.ID)
			break
		}
	}

	return nil
}
