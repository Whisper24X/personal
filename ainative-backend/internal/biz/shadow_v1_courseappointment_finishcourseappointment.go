package biz

import (
	"context"
	"fmt"
	"strings"

	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// FinishCourseAppointment 课程-预约-完成脚本
func (s *ShadowV1CourseAppointmentUseCase) FinishCourseAppointment(ctx context.Context, req *pb.FinishCourseAppointmentReq) (*pb.FinishCourseAppointmentReply, error) {
	resp := &pb.FinishCourseAppointmentReply{}
	err := s.commonRepo.LockOnce(ctx, cache.FinishCourseAppointmentLock.Key(), cache.FinishCourseAppointmentLock.TTL(), func() error {

		now := timeutil.NowCarbon()
		date := now.ToDateString()

		s.log.Infof("[FinishCourseAppointment] 开始执行预约完成定时任务，当前日期: %s", date)

		// 查询小于今天的预约
		list, _, err := s.courseAppointmentRepo.FindMultiByCondition(ctx, &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "date",
					Value: date,
					Exp:   condition.LT,
					Logic: condition.AND,
				},
				{
					Field: "status",
					Value: constant.CourseAppointmentStatusSuccess.String(), // 已预约
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
			},
		})
		if err != nil {
			s.log.Errorf("[FinishCourseAppointment] 查询预约记录失败: err=%v", err)
			return errorx.DataSQLErr.WithError(err).Err()
		}

		s.log.Infof("[FinishCourseAppointment] 查询到待完成的预约记录数量: %d", len(list))

		ids := make([]string, 0)
		orderIds := make([]string, 0)
		// 创建订单ID到预约记录的映射（用于后续获取预约时间）
		orderIdToAppointmentMap := make(map[string]*yanxue_model.CourseAppointment)
		for _, item := range list {
			s.log.Infof("[FinishCourseAppointment] 处理预约记录: appointmentId=%s, orderId=%s, date=%s, period=%s, status=%s",
				item.ID, item.OrderID, item.Date, item.Period, item.Status)

			ids = append(ids, item.ID)
			orderIds = append(orderIds, item.OrderID)
			// 保存订单ID到最新完成的预约记录的映射
			orderIdToAppointmentMap[item.OrderID] = item
			oldItem := s.courseAppointmentRepo.DeepCopy(item)
			item.Status = constant.CourseAppointmentStatusCompleted.String()
			err = s.courseAppointmentRepo.UpdateOneCacheWithZero(ctx, item, oldItem)
			if err != nil {
				s.log.Errorf("[FinishCourseAppointment] 更新预约状态为已完成失败: appointmentId=%s, err=%v", item.ID, err)
				return errorx.DataSQLErr.WithError(err).Err()
			}
			s.log.Infof("[FinishCourseAppointment] 预约状态更新为已完成: appointmentId=%s", item.ID)
		}

		// 订单ID去重
		orderIds = lo.Uniq(orderIds)
		s.log.Infof("[FinishCourseAppointment] 涉及的订单数量（去重后）: %d", len(orderIds))

		for _, orderId := range orderIds {
			s.log.Infof("[FinishCourseAppointment] 开始处理订单: orderId=%s", orderId)

			err := s.bffRepo.FinishOrderItem(ctx, orderId)
			if err != nil {
				s.log.Errorf("[FinishCourseAppointment] FinishOrderItem失败: orderId=%s, error=%v", orderId, err)
			}

			// 更新订单和子订单的ServiceStatus
			appointment := orderIdToAppointmentMap[orderId]
			err = s.updateOrderServiceStatusOnComplete(ctx, orderId, appointment)
			if err != nil {
				s.log.Errorf("[FinishCourseAppointment] 完成预约后更新订单服务状态失败: orderId=%s, err=%v", orderId, err)
				// 错误不中断主流程
			} else {
				s.log.Infof("[FinishCourseAppointment] 订单服务状态更新成功: orderId=%s", orderId)
			}
		}

		resp.Ids = ids
		s.log.Infof("[FinishCourseAppointment] 预约完成定时任务执行完成，共处理预约记录: %d 条，涉及订单: %d 个", len(ids), len(orderIds))
		return nil
	})
	if err != nil {
		s.log.Errorf("[FinishCourseAppointment] 执行失败: err=%v", err)
		return nil, err
	}
	return resp, nil
}

// updateOrderServiceStatusOnComplete 完成预约时更新订单和子订单的ServiceStatus
// 判断该订单下的所有子订单是否都已完成，如果都完成，则更新父订单ServiceStatus为已完成
// 同时更新一条ServiceStatus为已预约的子订单的ServiceStatus为已完成，并设置参营时间
func (s *ShadowV1CourseAppointmentUseCase) updateOrderServiceStatusOnComplete(ctx context.Context, orderId string, appointment *yanxue_model.CourseAppointment) error {
	s.log.Infof("[updateOrderServiceStatusOnComplete] 开始更新订单服务状态: orderId=%s", orderId)

	// 1. 查询父订单
	order, err := s.orderRepo.FindOneCacheByID(ctx, orderId)
	if err != nil {
		s.log.Errorf("[updateOrderServiceStatusOnComplete] 查询父订单失败: orderId=%s, err=%v", orderId, err)
		return err
	}
	if order == nil || order.ID == "" {
		s.log.Warnf("[updateOrderServiceStatusOnComplete] 订单不存在: orderId=%s", orderId)
		return nil
	}

	s.log.Infof("[updateOrderServiceStatusOnComplete] 父订单信息: orderId=%s, orderNumber=%s, currentServiceStatus=%s",
		order.ID, order.OrderNumber, order.ServiceStatus)

	// 2. 查询该订单的所有子订单
	subOrders, err := s.subOrderRepo.FindMultiCacheByParentOrderID(ctx, orderId)
	if err != nil {
		s.log.Errorf("[updateOrderServiceStatusOnComplete] 查询子订单失败: orderId=%s, err=%v", orderId, err)
		return err
	}

	// 如果没有子订单，直接返回（老订单兼容）
	if len(subOrders) == 0 {
		s.log.Infof("[updateOrderServiceStatusOnComplete] 订单没有子订单，跳过ServiceStatus更新: orderId=%s", orderId)
		return nil
	}

	s.log.Infof("[updateOrderServiceStatusOnComplete] 查询到子订单数量: %d, orderId=%s", len(subOrders), orderId)

	// 记录所有子订单的状态
	for _, subOrder := range subOrders {
		s.log.Infof("[updateOrderServiceStatusOnComplete] 子订单状态: subOrderId=%s, orderNumber=%s, serviceStatus=%s, campTime=%s",
			subOrder.ID, subOrder.OrderNumber, subOrder.ServiceStatus, subOrder.CampTime)
	}

	// 3. 查询该订单的所有预约记录
	courseAppointments, _, err := s.courseAppointmentRepo.FindMultiCacheByCondition(ctx, &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "orderId",
				Value: orderId,
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
		},
	})
	if err != nil {
		s.log.Errorf("[updateOrderServiceStatusOnComplete] 查询预约记录失败: orderId=%s, err=%v", orderId, err)
		return err
	}

	// 4. 统计已完成的预约数量
	completedAppointmentCount := 0
	for _, appointment := range courseAppointments {
		if appointment.Status == constant.CourseAppointmentStatusCompleted.String() {
			completedAppointmentCount++
		}
	}

	s.log.Infof("[updateOrderServiceStatusOnComplete] 预约统计: orderId=%s, 总预约数=%d, 已完成预约数=%d",
		orderId, len(courseAppointments), completedAppointmentCount)

	// 5.1 找到一个已预约状态的子订单，将其改为已完成
	var updatedSubOrder *yanxue_model.SubOrder
	for _, subOrder := range subOrders {
		if subOrder.ServiceStatus == string(constant.OrderStatusSuccess) { // 已预约
			s.log.Infof("[updateOrderServiceStatusOnComplete] 找到待完成的子订单: subOrderId=%s, orderNumber=%s",
				subOrder.ID, subOrder.OrderNumber)

			oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)
			subOrder.ServiceStatus = string(constant.OrderStatusCompleted) // 已完成

			// 设置参营时间为预约的日期+时间段（字符串格式）
			if appointment != nil {
				campTime := formatAppointmentTime(appointment.Date, appointment.Period)
				subOrder.CampTime = campTime
				s.log.Infof("[updateOrderServiceStatusOnComplete] 设置子订单参营时间: subOrderId=%s, campTime=%s, appointmentDate=%s, appointmentPeriod=%s",
					subOrder.ID, campTime, appointment.Date, appointment.Period)
			}

			err = s.subOrderRepo.UpdateOneCache(ctx, subOrder, oldSubOrder)
			if err != nil {
				s.log.Errorf("[updateOrderServiceStatusOnComplete] 更新子订单ServiceStatus失败: subOrderId=%s, err=%v", subOrder.ID, err)
				continue
			}
			updatedSubOrder = subOrder
			s.log.Infof("[updateOrderServiceStatusOnComplete] 子订单状态更新为已完成: subOrderId=%s, orderNumber=%s, campTime=%s",
				subOrder.ID, subOrder.OrderNumber, subOrder.CampTime)
			break
		}
	}

	if updatedSubOrder == nil {
		s.log.Warnf("[updateOrderServiceStatusOnComplete] 未找到待完成的子订单: orderId=%s", orderId)
	}

	// 5.2 检查是否所有子订单都已完成
	allSubOrdersCompleted := true
	pendingSubOrderCount := 0
	completedSubOrderCount := 0

	for _, subOrder := range subOrders {
		if updatedSubOrder != nil && subOrder.ID == updatedSubOrder.ID {
			completedSubOrderCount++
			continue // 跳过刚更新的
		}
		if subOrder.ServiceStatus != string(constant.OrderStatusCompleted) {
			allSubOrdersCompleted = false
			pendingSubOrderCount++
			s.log.Infof("[updateOrderServiceStatusOnComplete] 子订单未完成: subOrderId=%s, serviceStatus=%s",
				subOrder.ID, subOrder.ServiceStatus)
		} else {
			completedSubOrderCount++
		}
	}

	s.log.Infof("[updateOrderServiceStatusOnComplete] 子订单完成情况: orderId=%s, 已完成=%d, 未完成=%d, 总数=%d, 全部完成=%v",
		orderId, completedSubOrderCount, pendingSubOrderCount, len(subOrders), allSubOrdersCompleted)

	// 5.3 如果所有子订单都已完成，更新父订单ServiceStatus为已完成
	if allSubOrdersCompleted && order.ServiceStatus != constant.OrderStatusCompleted.String() {
		s.log.Infof("[updateOrderServiceStatusOnComplete] 所有子订单已完成，准备更新父订单状态: orderId=%s, currentStatus=%s",
			orderId, order.ServiceStatus)

		oldOrder := s.orderRepo.DeepCopy(order)
		order.ServiceStatus = constant.OrderStatusCompleted.String()
		err = s.orderRepo.UpdateOneCacheWithZero(ctx, order, oldOrder)
		if err != nil {
			s.log.Errorf("[updateOrderServiceStatusOnComplete] 更新父订单ServiceStatus失败: orderId=%s, err=%v", orderId, err)
			return err
		}
		s.log.Infof("[updateOrderServiceStatusOnComplete] 父订单状态更新为已完成: orderId=%s, orderNumber=%s",
			orderId, order.OrderNumber)
	} else if !allSubOrdersCompleted {
		s.log.Infof("[updateOrderServiceStatusOnComplete] 仍有子订单未完成，父订单状态保持不变: orderId=%s, currentStatus=%s",
			orderId, order.ServiceStatus)
	} else {
		s.log.Infof("[updateOrderServiceStatusOnComplete] 父订单状态已是已完成，无需更新: orderId=%s", orderId)
	}

	s.log.Infof("[updateOrderServiceStatusOnComplete] 订单服务状态更新完成: orderId=%s", orderId)
	return nil
}

// formatAppointmentTime 格式化预约时间为字符串
// 参数:
//
//	date: 日期字符串，格式为 "2025-11-04" 或 "2025-11-04到2025-11-12"
//	period: 时间段字符串，格式为空或 "11:00-12:00"
//
// 返回值:
//
//	格式化后的预约时间字符串，如 "2025-11-04 11:00" 或 "2025-11-04"
func formatAppointmentTime(date, period string) string {
	// 提取起始日期
	var startDate string
	if strings.Contains(date, "到") {
		// 处理日期范围，取第一个日期
		parts := strings.Split(date, "到")
		if len(parts) >= 2 {
			startDate = strings.TrimSpace(parts[0])
		} else {
			startDate = strings.TrimSpace(date)
		}
	} else {
		// 单个日期
		startDate = strings.TrimSpace(date)
	}

	// 处理时间段
	if period != "" {
		// 提取起始时间
		timeParts := strings.Split(period, "-")
		if len(timeParts) >= 2 {
			startTime := strings.TrimSpace(timeParts[0])
			// 组合日期和时间
			return fmt.Sprintf("%s %s", startDate, startTime)
		}
	}

	// 如果没有时间段或时间段格式不正确，只返回日期
	return startDate
}
