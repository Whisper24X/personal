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

		// 查询今天，并小于课程结束时间的预约
		now := timeutil.NowCarbon()
		date := now.ToDateString()
		periodEndTime := fmt.Sprintf("%d:%d", now.Hour(), now.Minute()) //20:07
		// 查询小于今天的
		list1, _, err := s.courseAppointmentRepo.FindMultiByCondition(ctx, &condition.Req{
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
			return errorx.DataSQLErr.WithError(err).Err()
		}
		list2, _, err := s.courseAppointmentRepo.FindMultiByCondition(ctx, &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "date",
					Value: date,
					Exp:   condition.EQ,
					Logic: condition.AND,
				},
				{
					Field: "periodEndTime",
					Value: periodEndTime,
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
			return errorx.DataSQLErr.WithError(err).Err()
		}
		list := append(list1, list2...)
		ids := make([]string, 0)
		orderIds := make([]string, 0)
		// 创建订单ID到预约记录的映射（用于后续获取预约时间）
		orderIdToAppointmentMap := make(map[string]*yanxue_model.CourseAppointment)
		for _, item := range list {
			ids = append(ids, item.ID)
			orderIds = append(orderIds, item.OrderID)
			// 保存订单ID到最新完成的预约记录的映射
			orderIdToAppointmentMap[item.OrderID] = item
			oldItem := s.courseAppointmentRepo.DeepCopy(item)
			item.Status = constant.CourseAppointmentStatusCompleted.String()
			err = s.courseAppointmentRepo.UpdateOneCacheWithZero(ctx, item, oldItem)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
		}
		// 订单ID去重
		orderIds = lo.Uniq(orderIds)
		for _, orderId := range orderIds {
			err := s.bffRepo.FinishOrderItem(ctx, orderId)
			if err != nil {
				s.log.Errorf("FinishOrderItem orderId: %s  error: %v", orderId, err)
			}

			// 更新订单和子订单的ServiceStatus
			appointment := orderIdToAppointmentMap[orderId]
			err = s.updateOrderServiceStatusOnComplete(ctx, orderId, appointment)
			if err != nil {
				s.log.Errorf("完成预约后更新订单服务状态失败: orderId=%s, err=%v", orderId, err)
				// 错误不中断主流程
			}
		}
		resp.Ids = ids
		return nil
	})
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// updateOrderServiceStatusOnComplete 完成预约时更新订单和子订单的ServiceStatus
// 判断该订单下的所有子订单是否都已完成，如果都完成，则更新父订单ServiceStatus为已完成
// 同时更新一条ServiceStatus为已预约的子订单的ServiceStatus为已完成，并设置参营时间
func (s *ShadowV1CourseAppointmentUseCase) updateOrderServiceStatusOnComplete(ctx context.Context, orderId string, appointment *yanxue_model.CourseAppointment) error {
	// 1. 查询父订单
	order, err := s.orderRepo.FindOneCacheByID(ctx, orderId)
	if err != nil {
		return err
	}
	if order == nil || order.ID == "" {
		s.log.Warnf("订单不存在，orderId=%s", orderId)
		return nil
	}

	// 2. 查询该订单的所有子订单
	subOrders, err := s.subOrderRepo.FindMultiCacheByParentOrderID(ctx, orderId)
	if err != nil {
		return err
	}

	// 如果没有子订单，直接返回（老订单兼容）
	if len(subOrders) == 0 {
		s.log.Infof("订单没有子订单，跳过ServiceStatus更新，orderId=%s", orderId)
		return nil
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
		return err
	}

	// 4. 统计已完成的预约数量
	completedAppointmentCount := 0
	for _, appointment := range courseAppointments {
		if appointment.Status == constant.CourseAppointmentStatusCompleted.String() {
			completedAppointmentCount++
		}
	}

	// 5.1 找到一个已预约状态的子订单，将其改为已完成
	var updatedSubOrder *yanxue_model.SubOrder
	for _, subOrder := range subOrders {
		if subOrder.ServiceStatus == string(constant.OrderStatusSuccess) { // 已预约
			oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)
			subOrder.ServiceStatus = string(constant.OrderStatusCompleted) // 已完成

			// 设置参营时间为预约的日期+时间段（字符串格式）
			if appointment != nil {
				campTime := formatAppointmentTime(appointment.Date, appointment.Period)
				subOrder.CampTime = campTime
				s.log.Infof("完成预约：设置子订单参营时间，subOrderId=%s, campTime=%s", subOrder.ID, campTime)
			}

			err = s.subOrderRepo.UpdateOneCache(ctx, subOrder, oldSubOrder)
			if err != nil {
				s.log.Errorf("更新子订单ServiceStatus失败，subOrderId=%s, err=%v", subOrder.ID, err)
				continue
			}
			updatedSubOrder = subOrder
			s.log.Infof("完成预约：更新子订单ServiceStatus为已完成，subOrderId=%s", subOrder.ID)
			break
		}
	}

	// 5.2 检查是否所有子订单都已完成
	allSubOrdersCompleted := true
	for _, subOrder := range subOrders {
		if updatedSubOrder != nil && subOrder.ID == updatedSubOrder.ID {
			continue // 跳过刚更新的
		}
		if subOrder.ServiceStatus != string(constant.OrderStatusCompleted) {
			allSubOrdersCompleted = false
			break
		}
	}

	// 5.3 如果所有子订单都已完成，更新父订单ServiceStatus为已完成
	if allSubOrdersCompleted && order.ServiceStatus != constant.OrderStatusCompleted.String() {
		oldOrder := s.orderRepo.DeepCopy(order)
		order.ServiceStatus = constant.OrderStatusCompleted.String()
		err = s.orderRepo.UpdateOneCacheWithZero(ctx, order, oldOrder)
		if err != nil {
			return err
		}
		s.log.Infof("完成预约：更新父订单ServiceStatus为已完成，orderId=%s", orderId)
	}

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
