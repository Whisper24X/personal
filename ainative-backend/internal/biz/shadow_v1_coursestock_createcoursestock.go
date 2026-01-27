package biz

import (
	"context"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// CreateSingleCourseStock 创建单日营课程库存
func (s *ShadowV1CourseStockUseCase) CreateSingleCourseStock(ctx context.Context, req *pb.CreateCourseStockReq) (*pb.CreateCourseStockReply, error) {
	resp := &pb.CreateCourseStockReply{
		Id: "",
	}
	adminId := meta.GetAdminID(ctx)
	// 检查日期是否重复
	dates := req.GetDates()
	periods := req.GetPeriods()
	if len(periods) <= 0 || len(periods) >= 6 {
		return nil, errors.New(http.StatusBadRequest, "-1", "日期时间段最少一个，最多不超过五个！")
	}
	datePeriodMap := make(map[string]bool)
	for _, date := range dates {
		for _, period := range periods {
			if _, ok := datePeriodMap[date+period]; ok {
				return nil, errorx.CourseStockDatePeriodDuplicate.WithFmtMsg(date, period).Err()
			}
			datePeriodMap[date+period] = true
		}
	}
	// 查询课程是否存在
	course, err := s.courseRepo.FindOneCacheByID(ctx, req.GetCourseId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if course == nil || course.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	// 查询当前日期配置的课程
	courseStockHas, _, err := s.courseStockRepo.FindMultiCacheByCondition(ctx, &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "courseId",
				Value: req.GetCourseId(),
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
			{
				Field: "date",
				Value: req.GetDates(),
				Exp:   condition.IN,
				Logic: condition.AND,
			},
			{
				Field: "period",
				Value: req.GetPeriods(),
				Exp:   condition.IN,
				Logic: condition.AND,
			},
		},
	})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(courseStockHas) > 0 {
		return nil, errorx.CourseStockPeriodHasSet.WithFmtMsg(course.CourseName, courseStockHas[0].Date, courseStockHas[0].Period).Err()
	}
	courseStocks := make([]*yanxue_model.CourseStock, 0)
	for _, date := range req.GetDates() {
		for _, period := range req.GetPeriods() {
			courseStock := &yanxue_model.CourseStock{
				CourseID:   course.ID,
				Date:       date,
				Period:     period,
				Stock:      req.GetStock(),
				Status:     constant.CourseStockStatusPutOff.String(),
				UpdatedBy:  adminId,
				CourseType: req.GetCourseType(),
			}
			courseStocks = append(courseStocks, courseStock)
		}
	}
	err = s.courseStockRepo.CreateBatchCache(ctx, courseStocks, 100)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}

// CreateMultiCourseStock 创建多日营课程库存
func (s *ShadowV1CourseStockUseCase) CreateMultiCourseStock(ctx context.Context, req *pb.CreateCourseStockReq) (*pb.CreateCourseStockReply, error) {
	resp := &pb.CreateCourseStockReply{
		Id: "",
	}
	adminId := meta.GetAdminID(ctx)
	// 检查日期是否重复
	dates := req.GetDates()
	datePeriodMap := make(map[string]bool)
	for _, date := range dates {
		if _, ok := datePeriodMap[date]; ok {
			return nil, errorx.CourseStockDatePeriodDuplicate.WithFmtMsg(date).Err()
		}
		datePeriodMap[date] = true
	}
	// 查询课程是否存在
	course, err := s.courseRepo.FindOneCacheByID(ctx, req.GetCourseId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if course == nil || course.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	// 查询当前日期配置的课程
	courseStockHas, _, err := s.courseStockRepo.FindMultiCacheByCondition(ctx, &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "courseId",
				Value: req.GetCourseId(),
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
			{
				Field: "date",
				Value: req.GetDates(),
				Exp:   condition.IN,
				Logic: condition.AND,
			},
		},
	})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(courseStockHas) > 0 {
		return nil, errorx.CourseStockPeriodHasSet.WithFmtMsg(course.CourseName, courseStockHas[0].Date).Err()
	}
	courseStocks := make([]*yanxue_model.CourseStock, 0)
	for _, date := range req.GetDates() {
		courseStock := &yanxue_model.CourseStock{
			CourseID:   course.ID,
			Date:       date,
			Stock:      req.GetStock(),
			Status:     constant.CourseStockStatusPutOff.String(),
			UpdatedBy:  adminId,
			CourseType: req.GetCourseType(),
		}
		courseStocks = append(courseStocks, courseStock)
	}
	err = s.courseStockRepo.CreateBatchCache(ctx, courseStocks, 100)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}

// CreateCourseStock -创建一条数据
func (s *ShadowV1CourseStockUseCase) CreateCourseStock(ctx context.Context, req *pb.CreateCourseStockReq) (*pb.CreateCourseStockReply, error) {
	if req.GetCourseType() == string(constant.CourseTypeMulti) {
		return s.CreateMultiCourseStock(ctx, req)
	}
	return s.CreateSingleCourseStock(ctx, req)
}
