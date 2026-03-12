package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_dao"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateCourseStockStatus 课程库存-更新一条数据状态
func (s *ShadowV1CourseStockUseCase) UpdateCourseStockStatus(ctx context.Context, req *pb.UpdateCourseStockStatusReq) (*pb.UpdateCourseStockStatusReply, error) {
	resp := &pb.UpdateCourseStockStatusReply{}
	adminId := meta.GetAdminID(ctx)
	courseStockList, err := s.courseStockRepo.FindMultiByIDS(ctx, req.GetIds())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(courseStockList) == 0 {
		return nil, errorx.DataRecordNotFound.Err()
	}
	// 下架课程不能存在预约
	if req.GetStatus() == constant.CourseStockStatusPutOff.String() {
		// 构建要检查的 date+period 组合，并提取所有唯一的日期
		datePeriodSet := make(map[string]bool)
		dateSet := make(map[string]bool)
		for _, courseStock := range courseStockList {
			datePeriodKey := courseStock.Date + "|" + courseStock.Period
			datePeriodSet[datePeriodKey] = true
			dateSet[courseStock.Date] = true
		}

		// 将日期集合转换为切片
		dates := make([]string, 0, len(dateSet))
		for date := range dateSet {
			dates = append(dates, date)
		}

		// 先通过日期过滤，再查询有效状态的预约（已预约、已完成）
		areadyCourseAppointmentList, _, err := s.courseAppointmentRepo.FindMultiByCondition(ctx, &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "date",
					Value: dates,
					Exp:   condition.IN,
					Logic: condition.AND,
				},
				{
					Field: "status",
					Value: []string{
						constant.CourseAppointmentStatusCompleted.String(),
						constant.CourseAppointmentStatusSuccess.String(),
					},
					Exp:   condition.IN,
					Logic: condition.AND,
				},
			},
		})
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}

		// 检查预约记录中是否有与要下架的时间段精确匹配的
		for _, appointment := range areadyCourseAppointmentList {
			datePeriodKey := appointment.Date + "|" + appointment.Period
			if datePeriodSet[datePeriodKey] {
				// 找到了精确匹配的预约，不允许下架
				s.log.Warnf("UpdateCourseStockStatus: 课程库存下架失败，该时间段存在预约, date=%s, period=%s, appointmentId=%s, appointmentStatus=%s",
					appointment.Date, appointment.Period, appointment.ID, appointment.Status)
				return nil, errorx.CourseStockHasAppointment.WithFmtMsg(appointment.Date, appointment.Period).Err()
			}
		}
	}
	err = s.commonRepo.Transaction(ctx, func(tx *yanxue_dao.Query) error {
		for _, courseStock := range courseStockList {
			// 更新状态
			oldCourseStock := s.courseStockRepo.DeepCopy(courseStock)
			courseStock.Status = req.GetStatus()
			courseStock.UpdatedBy = adminId
			err = s.courseStockRepo.UpdateOneCacheWithZeroByTx(ctx, tx, courseStock, oldCourseStock)
			if err != nil {
				return errorx.DataSQLErr.WithError(err).Err()
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return resp, nil
}
