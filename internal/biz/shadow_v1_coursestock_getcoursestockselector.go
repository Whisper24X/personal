package biz

import (
	"context"
	"fmt"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"sort"
	"strings"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// 判断日期范围是否重叠的核心函数（
func isDateInRange(dbDateStr string, queryStart, queryEnd time.Time) bool {
	dateStr := dbDateStr
	// 如果字段值是日期范围，格式为 "2025-10-25到2025-11-01"，需要解析出开始时间
	if strings.Contains(dbDateStr, "到") {
		parts := strings.Split(dbDateStr, "到")
		if len(parts) != 2 {
			fmt.Printf("Error: Invalid date range format: %s\n", dbDateStr)
			return false
		}

		dateStr = strings.TrimSpace(parts[0])
	}

	return isSingleDateInRange(dateStr, queryStart, queryEnd)
}

// 解析查询时间范围字符串
func parseQueryTimeRange(startStr, endStr string) (time.Time, time.Time, error) {
	layout := "2006-01-02"
	loc, _ := time.LoadLocation("Local")

	start, err := time.ParseInLocation(layout, startStr, loc)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	end, err := time.ParseInLocation(layout, endStr, loc)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	// 调整时间边界：开始时间设为00:00:00，结束时间设为23:59:59
	start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	end = time.Date(end.Year(), end.Month(), end.Day(), 23, 59, 59, 999999999, end.Location())

	return start, end, nil
}

// 处理单个日期
func isSingleDateInRange(singleDateStr string, queryStart, queryEnd time.Time) bool {
	loc, _ := time.LoadLocation("Local")
	singleDate, err := time.ParseInLocation("2006-01-02", singleDateStr, loc)
	if err != nil {
		fmt.Printf("Error parsing single date %s: %v\n", singleDateStr, err)
		return false
	}

	// 将单个日期视为一整天（从00:00:00到23:59:59）
	singleDateStart := time.Date(singleDate.Year(), singleDate.Month(), singleDate.Day(),
		0, 0, 0, 0, singleDate.Location())
	singleDateEnd := singleDateStart.Add(24*time.Hour - time.Nanosecond)

	return queryStart.Equal(singleDateStart) ||
		(queryStart.Before(singleDateStart) && queryEnd.After(singleDateEnd))
}

// GetCourseStockSelector 课程库存-通过课程查询可以预约的日期和时间段
func (s *ShadowV1CourseStockUseCase) GetCourseStockSelector(ctx context.Context, req *pb.GetCourseStockSelectorReq) (*pb.GetCourseStockSelectorReply, error) {
	resp := &pb.GetCourseStockSelectorReply{
		Items: []*pb.CourseStockSelectorItem{},
	}
	courseStockParam := &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "courseId",
				Value: req.GetCourseId(),
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
			{
				Field: "status",
				Value: constant.CourseStockStatusPutOn.String(),
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
		},
		Order: []*condition.OrderParam{},
	}
	var err error
	var queryStart, queryEnd time.Time
	if req.GetStartDate() != "" && req.GetEndDate() != "" {
		// 解析查询时间范围
		queryStart, queryEnd, err = parseQueryTimeRange(req.GetStartDate(), req.GetEndDate())
		if err != nil {
			fmt.Printf("Error parsing query time range: %v\n", err)
			return nil, errorx.ParamErr.Err()
		}
	}
	var cleanCourseStocks []*yanxue_model.CourseStock
	courseStocks, _, err := s.courseStockRepo.FindMultiCacheByCondition(ctx, courseStockParam)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, stock := range courseStocks {
		if isDateInRange(stock.Date, queryStart, queryEnd) {
			cleanCourseStocks = append(cleanCourseStocks, stock)
		}
	}
	// 查询预约记录
	courseAppointmentParam := &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "courseId",
				Value: req.GetCourseId(),
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
			{
				Field: "status",
				Value: []string{constant.CourseAppointmentStatusSuccess.String(), constant.CourseAppointmentStatusCompleted.String()},
				Exp:   condition.IN,
				Logic: condition.AND,
			},
		},
		Order: []*condition.OrderParam{},
	}
	courseAppointments, _, err := s.courseAppointmentRepo.FindMultiCacheByCondition(ctx, courseAppointmentParam)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	var filteredCourseAppointments []*yanxue_model.CourseAppointment
	for _, appointment := range courseAppointments {
		if isDateInRange(appointment.Date, queryStart, queryEnd) {
			filteredCourseAppointments = append(filteredCourseAppointments, appointment)
		}
	}

	datePeriodToNum := make(map[string]int32)
	for _, courseAppointment := range filteredCourseAppointments {
		datePeriodToNum[courseAppointment.Date+"-"+courseAppointment.Period]++
	}
	// 按日期从小到大排序,时间段从早到晚排序
	sort.Slice(cleanCourseStocks, func(i, j int) bool {
		if cleanCourseStocks[i].Date == cleanCourseStocks[j].Date {
			return cleanCourseStocks[i].Period < cleanCourseStocks[j].Period
		}
		return cleanCourseStocks[i].Date < cleanCourseStocks[j].Date
	})
	for _, courseStock := range cleanCourseStocks {
		stockRemain := courseStock.Stock - datePeriodToNum[courseStock.Date+"-"+courseStock.Period]
		if stockRemain < 0 {
			stockRemain = 0
		}
		resp.Items = append(resp.Items, &pb.CourseStockSelectorItem{
			Date:        courseStock.Date,
			Period:      courseStock.Period,
			Stock:       courseStock.Stock,
			StockRemain: stockRemain,
		})
	}
	return resp, nil
}
