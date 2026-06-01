package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetOrderVerificationProgressList 查询订单核销进度
func (s *ShadowV1OrderUseCase) GetOrderVerificationProgressList(ctx context.Context, req *pb.GetOrderVerificationProgressListReq) (*pb.GetOrderVerificationProgressListReply, error) {
	resp := &pb.GetOrderVerificationProgressListReply{}
	// 查询订单下的商品信息
	orderInfo, err := s.orderRepo.FindOneCacheByID(ctx, req.GetOrderId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	var goodIds []string
	goodIds = append(goodIds, orderInfo.GoodID)
	if len(goodIds) == 0 {
		return resp, nil
	}

	appointmentList, err := s.courseAppointmentRepo.FindMultiByOrderID(ctx, req.GetOrderId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if len(appointmentList) == 0 {
		return resp, nil
	}
	totalFinishedNums := int32(0)
	totalAppointmentNums := int32(0)
	goodIdMap := make(map[string]bool)
	categoryIdToCompletedAppointmentMap := make(map[string][]*yanxue_model.CourseAppointment)
	var courseIdList []string
	for _, appointment := range appointmentList {
		goodIdMap[appointment.GoodID] = true
		if appointment.Status == constant.OrderStatusCompleted.String() {
			totalFinishedNums++
			categoryIdToCompletedAppointmentMap[appointment.CategoryID] = append(categoryIdToCompletedAppointmentMap[appointment.CategoryID], appointment)
			courseIdList = append(courseIdList, appointment.CourseID)
			continue
		}
	}

	goodList, err := s.goodRepo.FindMultiByIDS(ctx, goodIds)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	categoryIdToTotalAppointmentNumsMap := make(map[string]int32)
	categoryIdToNameMap := make(map[string]string)
	for _, good := range goodList {
		goodContent := &pb.GoodContent{}
		err = jsonutil.Unmarshal(good.Content, goodContent)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		for _, item := range goodContent.GoodCategories {
			totalAppointmentNums += item.UseTimes
			categoryIdToTotalAppointmentNumsMap[item.CategoryId] += item.UseTimes
			categoryIdToNameMap[item.CategoryId] = item.CategoryName
		}
	}

	courseIdToNameMap := make(map[string]string)
	if len(courseIdList) > 0 {
		// 查询课程信息
		courseList, err := s.courseRepo.FindMultiByIDS(ctx, courseIdList)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		for _, course := range courseList {
			courseIdToNameMap[course.ID] = course.CourseName
		}
	}

	for categoryId := range categoryIdToTotalAppointmentNumsMap {
		appointmentDetailList, ok := categoryIdToCompletedAppointmentMap[categoryId]
		CategoryVerificationProgressItem := &pb.CategoryVerificationProgressItem{
			CategoryName:         categoryIdToNameMap[categoryId],
			TotalAppointmentNums: categoryIdToTotalAppointmentNumsMap[categoryId],
			TotalFinishedNums:    int32(len(appointmentDetailList)),
			List:                 nil,
		}
		if !ok {
			resp.List = append(resp.List, CategoryVerificationProgressItem)
			continue
		}
		for _, appointment := range appointmentDetailList {
			CategoryVerificationProgressItem.List = append(CategoryVerificationProgressItem.List, &pb.OrderVerificationProgressItem{
				OrderId:          appointment.OrderID,
				CourseName:       courseIdToNameMap[appointment.CourseID],
				VerificationDate: appointment.CreatedAt.Format("2006-01-02"),
				Period:           appointment.Period,
				ChildName:        appointment.StudentName,
			})
		}
		resp.List = append(resp.List, CategoryVerificationProgressItem)
	}

	resp.TotalAppointmentNums = totalAppointmentNums
	resp.TotalFinishedNums = totalFinishedNums

	return resp, nil
}
