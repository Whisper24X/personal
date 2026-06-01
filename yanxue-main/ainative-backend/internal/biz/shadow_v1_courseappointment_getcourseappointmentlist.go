package biz

import (
	"context"
	"sort"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
)

// GetReceiptAmountMap 获取实收金额映射：orderId -> receiptAmount（单位分）
// 通过 orderId -> sub_order（ParentOrderID）关联，取最新一条子订单的 receiptAmount
func (s *ShadowV1CourseAppointmentUseCase) GetReceiptAmountMap(ctx context.Context, orderIdList []string) (map[string]int64, error) {
	orderIdToReceiptMap := make(map[string]int64)
	if len(orderIdList) == 0 {
		return orderIdToReceiptMap, nil
	}
	subOrders, err := s.subOrderRepo.FindMultiCacheByParentOrderIDS(ctx, orderIdList)
	if err != nil {
		return orderIdToReceiptMap, errorx.DataSQLErr.WithError(err).Err()
	}
	// 按 ParentOrderID 分组，每组取最新一条（UpdatedAt 或 CreatedAt 最大）
	orderIdToSubOrders := make(map[string][]*yanxue_model.SubOrder)
	for _, sub := range subOrders {
		if sub.ParentOrderID != "" {
			orderIdToSubOrders[sub.ParentOrderID] = append(orderIdToSubOrders[sub.ParentOrderID], sub)
		}
	}
	for orderId, list := range orderIdToSubOrders {
		if len(list) == 0 {
			continue
		}
		// 按 UpdatedAt 降序，取最新一条
		sort.Slice(list, func(i, j int) bool {
			return list[i].UpdatedAt.After(list[j].UpdatedAt)
		})
		latest := list[0]
		orderIdToReceiptMap[orderId] = int64(latest.ReceiptAmount)
	}
	return orderIdToReceiptMap, nil
}

// GetCourseAppointmentList 课程-预约-列表数据查询
func (s *ShadowV1CourseAppointmentUseCase) GetCourseAppointmentList(ctx context.Context, req *pb.GetCourseAppointmentListReq) (*pb.GetCourseAppointmentListReply, error) {
	resp := &pb.GetCourseAppointmentListReply{
		Total: 0,
		List:  []*pb.CourseAppointmentInfo{},
	}
	param := &condition.Req{
		Page:     req.GetPage(),
		PageSize: req.GetPageSize(),
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "updatedAt",
				Order: condition.DESC,
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
	if req.GetStudentName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "studentName",
			Value: "%" + req.GetStudentName() + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}
	if req.GetParentName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "parentName",
			Value: "%" + req.GetParentName() + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}
	if req.GetParentPhone() != "" {
		parentPh, err := cryptutil.YcPhoneItemEncrypt(req.GetParentPhone())
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "parentPh",
			Value: "%" + parentPh + "%",
			Exp:   condition.LIKE,
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
	if req.GetContractStatus() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "contractStatus",
			Value: req.GetContractStatus(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	if req.GetOrderNumber() != "" {
		// 查询订单编号
		order, err := s.orderRepo.FindOneCacheByOrderNumber(ctx, req.GetOrderNumber())
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		if order == nil || order.ID == "" {
			param.Query = append(param.Query, &condition.QueryParam{
				Field: "orderId",
				Value: "",
				Exp:   condition.EQ,
				Logic: condition.AND,
			})
		} else {
			param.Query = append(param.Query, &condition.QueryParam{
				Field: "orderId",
				Value: order.ID,
				Exp:   condition.EQ,
				Logic: condition.AND,
			})
		}

	}
	list, p, err := s.courseAppointmentRepo.FindMultiCacheByCondition(ctx, param)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = p.Total
	if len(list) > 0 {
		adminIds := make([]string, 0)
		courseIds := make([]string, 0)
		goodIds := make([]string, 0)
		orderIds := make([]string, 0)
		for _, courseStock := range list {
			adminIds = append(adminIds, courseStock.UpdatedBy)
			courseIds = append(courseIds, courseStock.CourseID)
			goodIds = append(goodIds, courseStock.GoodID)
			orderIds = append(orderIds, courseStock.OrderID)
		}

		orderIdToReceiptMap, err := s.GetReceiptAmountMap(ctx, orderIds)
		if err != nil {
			return nil, err
		}
		adminMap, err := s.sysAdminRepo.AdminIdToName(ctx, adminIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		courseIdToName, err := s.courseRepo.CourseIdToName(ctx, courseIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		isPushContractRequiredMap, err := s.courseRepo.CourseIdToIsPushContractRequired(ctx, courseIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		goodMap, err := s.goodRepo.GoodIdToName(ctx, goodIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		orderList, err := s.orderRepo.FindMultiCacheByIDS(ctx, orderIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		orderIdToChannelId := make(map[string]string)
		orderIdToOrderNumber := make(map[string]string)
		for _, order := range orderList {
			orderIdToChannelId[order.ID] = order.ChannelID
			orderIdToOrderNumber[order.ID] = order.OrderNumber
		}
		channelIdToName, err := s.channelRepo.ChannelIdToName(ctx)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		for _, v := range list {
			courseStockInfo, err := s.courseAppointmentRepo.DTOShadowCourseAppointment(v)
			if err != nil {
				return nil, errorx.DataFormattingError.WithError(err).Err()
			}
			courseStockInfo.UpdatedByName = adminMap[v.UpdatedBy]
			courseStockInfo.CourseName = courseIdToName[v.CourseID]
			courseStockInfo.GoodName = goodMap[v.GoodID]
			courseStockInfo.ChannelName = channelIdToName[orderIdToChannelId[v.OrderID]]
			courseStockInfo.OrderNumber = orderIdToOrderNumber[v.OrderID]
			courseStockInfo.ReceiptAmount = orderIdToReceiptMap[v.OrderID]
			courseStockInfo.IsPushContractRequired = isPushContractRequiredMap[v.CourseID]
			resp.List = append(resp.List, courseStockInfo)
		}
	}
	return resp, nil
}
