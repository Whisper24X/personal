package biz

import (
	"context"
	"time"

	"github.com/samber/lo"
	"github.com/spf13/cast"
	"google.golang.org/protobuf/types/known/structpb"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// GetOrderGoodInfo 订单-获取订单商品详情
func (w *WechatV1OrderUseCase) GetOrderGoodInfo(ctx context.Context, req *pb.GetOrderGoodInfoReq) (*pb.GetOrderGoodInfoReply, error) {
	resp := &pb.GetOrderGoodInfoReply{
		OrderInfo:   &pb.OrderInfo{},
		GoodInfo:    &pb.GoodInfo{},
		ChannelInfo: &pb.ChannelInfo{},
	}
	// 查询订单信息
	order, err := w.orderRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询渠道信息
	channel, err := w.channelRepo.FindOneCacheByID(ctx, order.ChannelID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询商品信息
	goodInfo, err := w.goodRepo.FindOneCacheByID(ctx, order.GoodID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询平台商品信息
	platformGood, err := w.platformGoodRepo.FindOneCacheByID(ctx, goodInfo.PlatformGoodID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询课程预约信息
	courseAppointmentList, err := w.courseAppointmentRepo.FindMultiCacheByOrderID(ctx, order.ID)
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
	channelIdToName, err := w.channelRepo.ChannelIdToName(ctx)
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
		courseList, err := w.courseRepo.FindMultiCacheByIDS(ctx, courseIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		courseIdToCourseName := make(map[string]string)
		courseIdToPrice := make(map[string]float32)
		courseIdToIsPushContractRequired := make(map[string]bool)
		for _, course := range courseList {
			courseIdToCourseName[course.ID] = course.CourseName
			courseIdToPrice[course.ID] = course.Price
			courseIdToIsPushContractRequired[course.ID] = course.IsPushContractRequired
		}
		// 将课程信息填充到商品内容中
		for k, goodCategory := range goodContent.GoodCategories {
			// 赋值商品类别已预约次数
			goodContent.GoodCategories[k].AlreadyAppointmentUseTimes = categoryAlreadyAppointmentUseTimesMap[order.GoodID+goodCategory.CategoryId]
			for kk, course := range goodCategory.Courses {
				goodContent.GoodCategories[k].Courses[kk].CourseName = courseIdToCourseName[course.CourseId]
				goodContent.GoodCategories[k].Courses[kk].CoursePrice = cast.ToString(courseIdToPrice[course.CourseId])
				goodContent.GoodCategories[k].Courses[kk].IsAppointment = courseIdToAppointment[order.GoodID+goodCategory.CategoryId+course.CourseId]
				goodContent.GoodCategories[k].Courses[kk].IsPushContractRequired = courseIdToIsPushContractRequired[course.CourseId]
			}
		}
	}

	resp.ChannelInfo = &pb.ChannelInfo{
		Id:                   channel.ID,
		Name:                 channel.Name,
		VerificationCodeType: channel.VerificationCodeType,
	}
	goodName := goodInfo.Name
	if platformGood.Name != "" {
		goodName = platformGood.Name
	}
	orderInfo := &pb.OrderInfo{
		Id:              order.ID,
		OrderNumber:     order.OrderNumber,
		GoodId:          order.GoodID,
		GoodName:        goodName,
		ChannelId:       order.ChannelID,
		ChannelName:     channelIdToName[order.ChannelID],
		OrderPrice:      int32(order.OrderPrice*100 + 0.5), // 数据库存储的是元，转换为分返回给前端，四舍五入
		Phone:           phone,
		PaymentTime:     timeutil.RFC3339(order.PaymentTime),
		Status:          order.Status,
		DiscountAmount:  order.DiscountAmount,
		ParentRemark:    order.ParentRemark,
		PayId:           order.PayID,
		RefundId:        order.RefundID,
		RefundReason:    order.RefundReason,
		UserCouponId:    order.UserCouponID,
		PaymentDeadline: timeutil.RFC3339(order.PaymentDeadline),
		CreatedAt:       timeutil.RFC3339(order.CreatedAt),
		UpdatedAt:       timeutil.RFC3339(order.UpdatedAt),
		RefundTime:      timeutil.RFC3339(order.RefundTime),
		RefundAmount:    float32(order.RefundAmount),
	}
	now := time.Now()
	// 如果订单状态为待支付，且当前时间超过支付截止时间，则将订单状态改为交易关闭
	if now.After(order.PaymentDeadline) && orderInfo.Status == string(constant.OrderStatusPendingPayment) {
		orderInfo.Status = string(constant.OrderStatusClosed)
	}
	resp.OrderInfo = orderInfo
	resp.GoodInfo = &pb.GoodInfo{
		Id:               goodInfo.ID,
		Name:             goodName,
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
	// 预约草稿 - 修复类型转换问题
	if len(order.CourseAppointmentDraft) > 0 {
		var draftData map[string]interface{}
		if err := jsonutil.Unmarshal(order.CourseAppointmentDraft, &draftData); err == nil {
			resp.CourseAppointmentDraft, err = structpb.NewStruct(draftData)
			if err != nil {
				return nil, errorx.DataFormattingError.WithError(err).Err()
			}
		}
	}
	return resp, nil
}
