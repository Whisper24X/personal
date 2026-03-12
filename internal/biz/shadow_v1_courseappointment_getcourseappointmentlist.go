package biz

import (
	"context"

	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetOrderPriceMap 获取订单金额
func (s *ShadowV1CourseAppointmentUseCase) GetOrderPriceMap(ctx context.Context, orderIdList []string) (map[string]int64, error) {
	orderIdToPriceMap := make(map[string]int64)
	// 分批请求
	batchSize := 1000
	batches := len(orderIdList) / batchSize
	if len(orderIdList)%batchSize != 0 {
		batches++ // 处理剩余不足1000的批次
	}
	var orderList []*yanxue_model.Order
	for i := 0; i < batches; i++ {
		start := i * batchSize
		end := start + batchSize
		if end > len(orderIdList) {
			end = len(orderIdList)
		}
		batchIDs := orderIdList[start:end]
		list, err := s.orderRepo.FindMultiByIDS(ctx, batchIDs)
		if err != nil {
			return orderIdToPriceMap, errorx.DataSQLErr.WithError(err).Err()
		}
		orderList = append(orderList, list...)
	}
	orderIdToOrderPriceMap := make(map[string]float32)
	var channelGoodIdList []string
	for _, orderInfo := range orderList {
		orderIdToOrderPriceMap[orderInfo.ID] = orderInfo.OrderPrice
		channelGoodIdList = append(channelGoodIdList, orderInfo.ChannelGoodID)
	}
	uniqChannelGoodIdList := lo.Uniq(channelGoodIdList)
	channelGoodList, err := s.goodRepo.FindMultiByChannelGoodIDS(ctx, uniqChannelGoodIdList)
	if err != nil {
		return orderIdToPriceMap, errorx.DataSQLErr.WithError(err).Err()
	}
	channelGoodIdToUseTimeMap := make(map[string]int32)
	for _, goodInfo := range channelGoodList {
		content := &pb.GoodContent{}
		err = jsonutil.Unmarshal(goodInfo.Content, content)
		if err != nil {
			return orderIdToPriceMap, errorx.DataFormattingError.WithError(err).Err()
		}
		totalUseTime := int32(0)
		for _, category := range content.GoodCategories {
			totalUseTime += category.UseTimes
		}
		channelGoodIdToUseTimeMap[goodInfo.ChannelGoodID] = totalUseTime
	}

	for _, orderInfo := range orderList {
		orderPrice := int32(orderInfo.OrderPrice*100 + 0.5) // 单位为分，四舍五入
		totalUseTime := int32(1)
		if channelGoodIdToUseTimeMap[orderInfo.ChannelGoodID] != 0 {
			totalUseTime = channelGoodIdToUseTimeMap[orderInfo.ChannelGoodID]
		}
		cost := orderPrice / totalUseTime
		orderIdToPriceMap[orderInfo.ID] = int64(cost)
	}
	return orderIdToPriceMap, nil
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

		orderIdToPriceMap, err := s.GetOrderPriceMap(ctx, orderIds)
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
			courseStockInfo.OrderPrice = orderIdToPriceMap[v.OrderID]
			courseStockInfo.IsPushContractRequired = isPushContractRequiredMap[v.CourseID]
			resp.List = append(resp.List, courseStockInfo)
		}
	}
	return resp, nil
}
