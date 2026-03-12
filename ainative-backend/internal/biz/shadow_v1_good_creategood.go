package biz

import (
	"context"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// CreateGood 商品-创建一条数据
func (s *ShadowV1GoodUseCase) CreateGood(ctx context.Context, req *pb.CreateGoodReq) (*pb.CreateGoodReply, error) {
	resp := &pb.CreateGoodReply{}
	adminId := meta.GetAdminID(ctx)
	// 生成UUID
	goodId := uuid.New().String()
	// 校验渠道商品 Id 不能重复
	if req.GetChannelGoodId() != "" {
		channelGoodExists, err := s.goodRepo.FindOneCacheByChannelGoodID(ctx, req.GetChannelGoodId())
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		if channelGoodExists != nil && channelGoodExists.ID != "" {
			return resp, errorx.GoodChannelGoodIdDuplicate.WithFmtMsg(req.GetChannelGoodId()).Err()
		}
	}
	// 校验参数
	// 校验类别名称不能相同，类别 Id 不能相同
	// 每个类别下的课程 id 不能相同
	courseIds := make([]string, 0)
	checkCategoryId := make(map[string]struct{})
	checkCategoryName := make(map[string]struct{})
	for _, category := range req.GetContent().GoodCategories {
		if _, ok := checkCategoryId[category.GetCategoryId()]; ok {
			return resp, errorx.GoodCategoryIdDuplicate.WithFmtMsg(category.GetCategoryId()).Err()
		}
		if _, ok := checkCategoryName[category.GetCategoryName()]; ok {
			return resp, errorx.GoodCategoryNameDuplicate.WithFmtMsg(category.GetCategoryName()).Err()
		}
		checkCategoryId[category.GetCategoryId()] = struct{}{}
		checkCategoryName[category.GetCategoryName()] = struct{}{}
		checkCourseId := make(map[string]struct{})
		for _, course := range category.GetCourses() {
			if _, ok := checkCourseId[course.GetCourseId()]; ok {
				return resp, errorx.GoodCategoryCourseDuplicate.WithFmtMsg(category.GetCategoryName()).Err()
			}
			checkCourseId[course.GetCourseId()] = struct{}{}
			courseIds = append(courseIds, course.GetCourseId())
		}
	}
	// 查询课程是否都存在
	courseIds = lo.Uniq(courseIds)
	courseList, err := s.courseRepo.FindMultiCacheByIDS(ctx, courseIds)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, v := range courseList {
		if !lo.Contains(courseIds, v.ID) {
			return resp, errorx.CourseNotExists.WithFmtMsg(v.ID).Err()
		}
	}
	// 校验channel是否合法
	channel, err := s.channelRepo.FindOneCacheByID(ctx, req.GetChannelId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if channel == nil || channel.ID == "" {
		return resp, errorx.ChannelNotExists.WithFmtMsg(req.GetChannelId()).Err()
	}
	// 如果是小程序渠道，则需要将渠道商品ID赋值为商品ID
	channelGoodID := req.GetChannelGoodId()
	if channel.Name == constant.ChannelTypeXCX {
		channelGoodID = goodId
	}
	// 校验平台商品Id是否合法
	platformGood, err := s.platformGoodRepo.FindOneCacheByID(ctx, req.GetPlatformGoodId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if platformGood == nil || platformGood.ID == "" {
		return resp, errorx.PlatformGoodNotExists.WithFmtMsg(req.GetPlatformGoodId()).Err()
	}
	// 判断是否为定金商品
	isDepositGood := platformGood.GoodType == "deposit"
	// 定金商品字段强制设置逻辑
	isPushAppointmentInfo := req.GetIsPushAppointmentInfo()
	appointmentRules := req.GetAppointmentRules()
	if isDepositGood {
		// 定金商品强制设置：isPushAppointmentInfo=false，appointmentRules=''
		isPushAppointmentInfo = false
		appointmentRules = ""
	}
	// 校验标签：每个标签最多不超过4个中文字符
	for _, label := range req.GetLabel() {
		if utf8.RuneCountInString(label) > 4 {
			return resp, errorx.GoodLabelTooLong.WithFmtMsg(label).Err()
		}
	}
	// 数据保存
	mainImageJson, err := jsonutil.Marshal(req.GetMainImages())
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	detailImagesJson, err := jsonutil.Marshal(req.GetDetailImages())
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	content, err := jsonutil.Marshal(req.GetContent())
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}

	labelJson, err := jsonutil.Marshal(req.GetLabel())
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}

	// 处理库存字段：如果 stock <= 0 或未设置，则设为 NULL（无限库存）
	// 注意：由于 Go 的 int32 默认值为 0，需要通过指针或特殊值判断
	// 这里使用 0 表示未设置或无限库存，>0 表示有限库存
	var stock *int32
	if req.GetStock() > 0 {
		stockVal := req.GetStock()
		stock = &stockVal
	}

	good := &yanxue_model.Good{
		ID:                    goodId, // 显式设置ID
		PlatformGoodID:        req.GetPlatformGoodId(),
		ChannelID:             req.GetChannelId(),
		ChannelGoodID:         channelGoodID,
		Name:                  platformGood.Name,
		MainImage:             mainImageJson,
		DetailImages:          detailImagesJson,
		Price:                 float64(req.GetPrice()) / 100.0, // 前端传入分，转换为元存储
		Content:               content,
		AppointmentRules:      appointmentRules,
		Status:                string(constant.GoodStatusPending),
		UpdatedBy:             adminId,
		IsPushAppointmentInfo: isPushAppointmentInfo,
		Label:                 labelJson,
		PurchaseAgreementName: req.GetPurchaseAgreementName(),
		PurchaseAgreementLink: req.GetPurchaseAgreementLink(),
	}
	// 设置库存字段（如果 Good 模型有 Stock 字段）
	// 注意：需要先执行数据库迁移，然后重新生成模型代码，Stock 字段才会存在
	// 这里先注释，等模型更新后再取消注释
	if stock != nil {
		good.Stock = *stock
	}
	err = s.goodRepo.CreateOneCache(ctx, good)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Id = good.ID
	return resp, nil
}
