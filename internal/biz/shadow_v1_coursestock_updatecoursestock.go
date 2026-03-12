package biz

import (
	"context"

	"github.com/spf13/cast"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateCourseStock -更新一条数据
func (s *ShadowV1CourseStockUseCase) UpdateCourseStock(ctx context.Context, req *pb.UpdateCourseStockReq) (*pb.UpdateCourseStockReply, error) {
	resp := &pb.UpdateCourseStockReply{}
	adminId := meta.GetAdminID(ctx)
	courseStock, err := s.courseStockRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询这个课程的预约人数
	datePeriodToCount, err := s.courseAppointmentRepo.DatePeriodToCountByCourseIdDates(ctx, []string{courseStock.CourseID}, []string{courseStock.Date})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 判断预约人数是否大于库存
	if req.GetStock() < datePeriodToCount[courseStock.CourseID+courseStock.Date+courseStock.Period] {
		return nil, errorx.CourseStockLessThanAppointment.WithFmtMsg(cast.ToString(datePeriodToCount[courseStock.CourseID+courseStock.Date+courseStock.Period])).Err()
	}
	oldCourseStock := s.courseStockRepo.DeepCopy(courseStock)
	courseStock.Stock = req.GetStock()
	courseStock.UpdatedBy = adminId
	err = s.courseStockRepo.UpdateOneCacheWithZero(ctx, courseStock, oldCourseStock)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
