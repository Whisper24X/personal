package biz

import (
	"context"
	"unicode/utf8"

	"github.com/samber/lo"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// UpdateGood 商品-更新一条数据
func (s *ShadowV1GoodUseCase) UpdateGood(ctx context.Context, req *pb.UpdateGoodReq) (*pb.UpdateGoodReply, error) {
	resp := &pb.UpdateGoodReply{}
	adminId := meta.GetAdminID(ctx)
	goodInfo, err := s.goodRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if goodInfo == nil || goodInfo.ID == "" {
		return resp, errorx.GoodNotExists.Err()
	}
	// 校验渠道商品 Id 不能重复
	if req.GetChannelGoodId() != "" {
		channelGoodExists, err := s.goodRepo.FindOneCacheByChannelGoodID(ctx, req.GetChannelGoodId())
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		if channelGoodExists != nil && channelGoodExists.ID != "" && channelGoodExists.ID != goodInfo.ID {
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
		if v.Status == string(constant.CourseStatusPutOff) {
			return resp, errorx.GoodCategoryCoursePutOff.WithFmtMsg(v.CourseName).Err()
		}
		if !lo.Contains(courseIds, v.ID) {
			return resp, errorx.GoodCategoryCourseNotExists.WithFmtMsg(v.CourseName).Err()
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
	// 校验平台商品Id是否合法
	platformGood, err := s.platformGoodRepo.FindOneCacheByID(ctx, req.GetPlatformGoodId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if platformGood == nil || platformGood.ID == "" {
		return resp, errorx.PlatformGoodNotExists.WithFmtMsg(req.GetPlatformGoodId()).Err()
	}
	// 校验标签：每个标签最多不超过4个中文字符
	for _, label := range req.GetLabel() {
		if utf8.RuneCountInString(label) > 4 {
			return resp, errorx.GoodLabelTooLong.WithFmtMsg(label).Err()
		}
	}
	oldGoodInfo := s.goodRepo.DeepCopy(goodInfo)
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

	goodInfo.PlatformGoodID = req.GetPlatformGoodId()
	goodInfo.ChannelID = req.GetChannelId()
	if req.GetChannelGoodId() != "" {
		goodInfo.ChannelGoodID = req.GetChannelGoodId()
	}
	goodInfo.Name = platformGood.Name
	goodInfo.MainImage = mainImageJson
	goodInfo.DetailImages = detailImagesJson
	goodInfo.Price = float64(req.GetPrice()) / 100.0 // 前端传入分，转换为元存储
	goodInfo.Content = content
	goodInfo.AppointmentRules = req.GetAppointmentRules()
	goodInfo.IsPushAppointmentInfo = req.GetIsPushAppointmentInfo()
	goodInfo.Label = labelJson
	goodInfo.PurchaseAgreementName = req.GetPurchaseAgreementName()
	goodInfo.PurchaseAgreementLink = req.GetPurchaseAgreementLink()
	goodInfo.UpdatedBy = adminId
	err = s.goodRepo.UpdateOneCacheWithZero(ctx, goodInfo, oldGoodInfo)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.IsSucceed = true
	return resp, nil
}
