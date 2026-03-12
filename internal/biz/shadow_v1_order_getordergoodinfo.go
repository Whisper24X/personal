package biz

import (
	"context"

	"github.com/samber/lo"
	"github.com/spf13/cast"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetOrderGoodInfo 订单-获取订单商品详情
func (s *ShadowV1OrderUseCase) GetOrderGoodInfo(ctx context.Context, req *pb.GetOrderGoodInfoReq) (*pb.GetOrderGoodInfoReply, error) {
	resp := &pb.GetOrderGoodInfoReply{
		OrderInfo:   &pb.OrderInfo{},
		GoodInfo:    &pb.GoodInfo{},
		ChannelInfo: &pb.ChannelInfo{},
	}
	// 查询订单信息
	order, err := s.orderRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询渠道信息
	channel, err := s.channelRepo.FindOneCacheByID(ctx, order.ChannelID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询商品信息
	goodInfo, err := s.goodRepo.FindOneCacheByID(ctx, order.GoodID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询平台商品信息
	platformGood, err := s.platformGoodRepo.FindOneCacheByID(ctx, goodInfo.PlatformGoodID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询课程预约信息
	courseAppointmentList, err := s.courseAppointmentRepo.FindMultiCacheByOrderID(ctx, order.ID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 过滤已预约和已完成的
	courseAppointmentList = lo.Filter(courseAppointmentList, func(item *yanxue_model.CourseAppointment, _ int) bool {
		return item.Status == constant.CourseAppointmentStatusSuccess.String() || item.Status == constant.CourseAppointmentStatusCompleted.String()
	})
	courseIdToAppointment := make(map[string]bool)
	categoryAlreadyAppointmentUseTimesMap := make(map[string]int32)
	for _, v := range courseAppointmentList {
		categoryAlreadyAppointmentUseTimesMap[v.GoodID+v.CategoryID]++
		courseIdToAppointment[v.GoodID+v.CategoryID+v.CourseID] = true
	}
	// 查询渠道信息
	channelIdToName, err := s.channelRepo.ChannelIdToName(ctx)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	phone, err := cryptutil.YcPhoneDecrypt(order.Ph)
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}
	// 商品信息
	mainImage := make([]string, 0)
	detailImages := make([]string, 0)
	if goodInfo.MainImage.String() != "" {
		err = jsonutil.Unmarshal(goodInfo.MainImage, &mainImage)
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
	}
	if goodInfo.DetailImages.String() != "" {
		err = jsonutil.Unmarshal(goodInfo.DetailImages, &detailImages)
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
	}
	goodContent := &pb.GoodContent{}
	if goodInfo.Content.String() != "" {
		err = jsonutil.Unmarshal(goodInfo.Content, goodContent)
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
		courseIds := make([]string, 0)
		for _, goodCategory := range goodContent.GoodCategories {
			for _, v := range goodCategory.Courses {
				if v.CourseId != "" {
					courseIds = append(courseIds, v.CourseId)
				}
			}
		}
		courseList, err := s.courseRepo.FindMultiCacheByIDS(ctx, courseIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		courseIdToCourseName := make(map[string]string)
		courseIdToPrice := make(map[string]float32)
		for _, course := range courseList {
			courseIdToCourseName[course.ID] = course.CourseName
			courseIdToPrice[course.ID] = course.Price
		}
		// 将课程信息填充到商品内容中
		for k, goodCategory := range goodContent.GoodCategories {
			// 赋值商品类别已预约次数
			goodContent.GoodCategories[k].AlreadyAppointmentUseTimes = categoryAlreadyAppointmentUseTimesMap[order.GoodID+goodCategory.CategoryId]
			for kk, course := range goodCategory.Courses {
				goodContent.GoodCategories[k].Courses[kk].CourseName = courseIdToCourseName[course.CourseId]
				goodContent.GoodCategories[k].Courses[kk].CoursePrice = cast.ToString(courseIdToPrice[course.CourseId])
				goodContent.GoodCategories[k].Courses[kk].IsAppointment = courseIdToAppointment[order.GoodID+goodCategory.CategoryId+course.CourseId]
			}
		}
	}
	resp.ChannelInfo = &pb.ChannelInfo{
		Id:                   channel.ID,
		Name:                 channel.Name,
		VerificationCodeType: channel.VerificationCodeType,
	}
	// 处理负数字段，如果是负数则返回0
	discountAmount := order.DiscountAmount // 单位：分
	if discountAmount < 0 {
		discountAmount = 0
	}
	platformFee := order.PlatformFee
	if platformFee < 0 {
		platformFee = 0
	}
	talentCommission := order.TalentCommission
	if talentCommission < 0 {
		talentCommission = 0
	}

	resp.OrderInfo = &pb.OrderInfo{
		Id:               order.ID,
		OrderNumber:      order.OrderNumber,
		GoodId:           order.GoodID,
		GoodName:         goodInfo.Name,
		ChannelId:        order.ChannelID,
		ChannelName:      channelIdToName[order.ChannelID],
		OrderPrice:       int32(order.OrderPrice*100 + 0.5), // 元转分，转为int32，四舍五入
		Phone:            phone,
		PaymentTime:      timeutil.RFC3339(order.PaymentTime),
		Status:           order.Status,
		CreatedAt:        timeutil.RFC3339(order.CreatedAt),
		UpdatedAt:        timeutil.RFC3339(order.UpdatedAt),
		ChannelGoodId:    order.ChannelGoodID,
		DiscountAmount:   discountAmount,
		PayId:            order.PayID,
		RefundId:         order.RefundID,
		RefundReason:     order.RefundReason,
		RefundAmount:     float32(order.RefundAmount), // 已经是分
		ParentRemark:     order.ParentRemark,
		RefundTime:       timeutil.RFC3339(order.RefundTime),
		GoodType:         order.GoodType,
		PlatformFee:      platformFee,
		ServiceStatus:    order.ServiceStatus,
		TalentUid:        order.TalentUID,
		TalentName:       order.TalentName,
		TalentCommission: talentCommission,
	}
	resp.GoodInfo = &pb.GoodInfo{
		Id:               goodInfo.ID,
		Name:             goodInfo.Name,
		MainImage:        mainImage,
		DetailImages:     detailImages,
		Price:            int32(goodInfo.Price*100 + 0.5), // 数据库存储的是元，转换为分返回给前端，四舍五入
		Content:          goodContent,
		Status:           goodInfo.Status,
		AppointmentRules: goodInfo.AppointmentRules,
		ChannelId:        goodInfo.ChannelID,
		ChannelGoodId:    goodInfo.ChannelGoodID,
		PlatformGoodId:   goodInfo.PlatformGoodID,
		GoodType:         platformGood.GoodType,
		CreatedAt:        timeutil.RFC3339(goodInfo.CreatedAt),
		UpdatedAt:        timeutil.RFC3339(goodInfo.UpdatedAt),
	}
	return resp, nil
}
