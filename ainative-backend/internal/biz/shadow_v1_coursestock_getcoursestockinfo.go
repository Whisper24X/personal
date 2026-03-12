package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetCourseStockInfo -单条数据查询
func (s *ShadowV1CourseStockUseCase) GetCourseStockInfo(ctx context.Context, req *pb.GetCourseStockInfoReq) (*pb.GetCourseStockInfoReply, error) {
	resp := &pb.GetCourseStockInfoReply{}
	courseStock, err := s.courseStockRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	courseInfo, err := s.courseStockRepo.DTOShadowCourseStock(courseStock)
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}
	adminMap, err := s.sysAdminRepo.AdminIdToName(ctx, []string{courseStock.UpdatedBy})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	courseIdToName, err := s.courseRepo.CourseIdToName(ctx, []string{courseStock.CourseID})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	datePeriodToCount, err := s.courseAppointmentRepo.DatePeriodToCountByCourseIdDates(ctx, []string{courseStock.CourseID}, []string{courseStock.Date})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	courseInfo.StockSuccess = datePeriodToCount[courseStock.CourseID+courseStock.Date+courseStock.Period]
	courseInfo.StockRemain = courseStock.Stock - courseInfo.StockSuccess
	courseInfo.UpdatedByName = adminMap[courseInfo.UpdatedBy]
	courseInfo.CourseName = courseIdToName[courseStock.CourseID]
	resp.Info = courseInfo
	return resp, nil
}
