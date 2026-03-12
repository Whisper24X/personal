package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetCourseStockList -列表数据查询
func (s *ShadowV1CourseStockUseCase) GetCourseStockList(ctx context.Context, req *pb.GetCourseStockListReq) (*pb.GetCourseStockListReply, error) {
	resp := &pb.GetCourseStockListReply{}
	param := &condition.Req{
		Page:     req.GetPage(),
		PageSize: req.GetPageSize(),
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "date",
				Order: condition.DESC,
			},
			{
				Field: "period",
				Order: condition.ASC,
			},
		},
	}
	if req.GetCourseId() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "courseId",
			Value: req.GetCourseId(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	if req.GetStartDate() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "date",
			Value: req.GetStartDate(),
			Exp:   condition.GTE,
			Logic: condition.AND,
		})
	}
	if req.GetEndDate() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "date",
			Value: req.GetEndDate(),
			Exp:   condition.LTE,
			Logic: condition.AND,
		})
	}
	if req.GetStatus() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "status",
			Value: req.GetStatus(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	if req.GetCourseType() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "courseType",
			Value: req.GetCourseType(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	list, p, err := s.courseStockRepo.FindMultiCacheByCondition(ctx, param)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = p.Total
	if len(list) > 0 {
		adminIds := make([]string, 0)
		courseIds := make([]string, 0)
		dates := make([]string, 0)
		for _, courseStock := range list {
			adminIds = append(adminIds, courseStock.UpdatedBy)
			courseIds = append(courseIds, courseStock.CourseID)
			dates = append(dates, courseStock.Date)
		}
		adminMap, err := s.sysAdminRepo.AdminIdToName(ctx, adminIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		courseIdToName, err := s.courseRepo.CourseIdToName(ctx, courseIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		datePeriodToCount, err := s.courseAppointmentRepo.DatePeriodToCountByCourseIdDates(ctx, courseIds, dates)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		for _, courseStock := range list {
			courseStockInfo, err := s.courseStockRepo.DTOShadowCourseStock(courseStock)
			if err != nil {
				return nil, errorx.DataFormattingError.WithError(err).Err()
			}
			courseStockInfo.StockSuccess = datePeriodToCount[courseStock.CourseID+courseStock.Date+courseStock.Period]
			courseStockInfo.StockRemain = courseStock.Stock - courseStockInfo.StockSuccess
			courseStockInfo.UpdatedByName = adminMap[courseStock.UpdatedBy]
			courseStockInfo.CourseName = courseIdToName[courseStock.CourseID]
			resp.List = append(resp.List, courseStockInfo)
		}
	}
	return resp, nil
}
