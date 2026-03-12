package biz

import (
	"context"
	"sort"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetCourseStockSelector 课程-通过课程查询可以预约的日期和时间段
func (w *WechatV1CourseUseCase) GetCourseStockSelector(ctx context.Context, req *pb.GetCourseStockSelectorReq) (*pb.GetCourseStockSelectorReply, error) {
	resp := &pb.GetCourseStockSelectorReply{
		Items: []*pb.CourseStockSelectorItem{},
	}
	param := &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "courseId",
				Value: req.GetCourseId(),
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
			{
				Field: "date",
				Value: req.GetStartDate(),
				Exp:   condition.GTE,
				Logic: condition.AND,
			},
			{
				Field: "date",
				Value: req.GetEndDate(),
				Exp:   condition.LTE,
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
	courseStocks, _, err := w.courseStockRepo.FindMultiCacheByCondition(ctx, param)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询预约记录
	courseAppointments, _, err := w.courseAppointmentRepo.FindMultiCacheByCondition(ctx, &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "courseId",
				Value: req.GetCourseId(),
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
			{
				Field: "date",
				Value: req.GetStartDate(),
				Exp:   condition.GTE,
				Logic: condition.AND,
			},
			{
				Field: "date",
				Value: req.GetEndDate(),
				Exp:   condition.LTE,
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
	})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	datePeriodToNum := make(map[string]int32)
	for _, courseAppointment := range courseAppointments {
		datePeriodToNum[courseAppointment.Date+"-"+courseAppointment.Period]++
	}
	// 按日期从小到大排序,时间段从早到晚排序
	sort.Slice(courseStocks, func(i, j int) bool {
		if courseStocks[i].Date == courseStocks[j].Date {
			return courseStocks[i].Period < courseStocks[j].Period
		}
		return courseStocks[i].Date < courseStocks[j].Date
	})
	for _, courseStock := range courseStocks {
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
