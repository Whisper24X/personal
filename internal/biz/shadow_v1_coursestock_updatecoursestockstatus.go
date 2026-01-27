package biz

import (
	"context"

	"github.com/samber/lo"
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
		dates := make([]string, 0)
		periods := make([]string, 0)
		for _, courseStock := range courseStockList {
			dates = append(dates, courseStock.Date)
			periods = append(periods, courseStock.Period)
		}
		dates = lo.Uniq(dates)
		periods = lo.Uniq(periods)

		areadyCourseAppointmentList, _, err := s.courseAppointmentRepo.FindMultiByCondition(ctx, &condition.Req{
			Query: []*condition.QueryParam{
				{
					Field: "date",
					Value: dates,
					Exp:   condition.IN,
					Logic: condition.AND,
				},
				{
					Field: "period",
					Value: periods,
					Exp:   condition.IN,
					Logic: condition.AND,
				},
				{
					Field: "status",
					Value: []string{constant.CourseAppointmentStatusCompleted.String(), constant.CourseAppointmentStatusSuccess.String()},
					Exp:   condition.IN,
					Logic: condition.AND,
				},
			},
		})
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		datePeriods := make([]string, 0)
		for _, v := range areadyCourseAppointmentList {
			datePeriods = append(datePeriods, v.Date+v.Period)
		}
		for _, v := range courseStockList {
			if lo.Contains(datePeriods, v.Date+v.Period) {
				return nil, errorx.CourseStockHasAppointment.WithFmtMsg(v.Date, v.Period).Err()
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
