package biz

import (
	"context"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetGoodInfo 商品-单条数据查询
func (s *ShadowV1GoodUseCase) GetGoodInfo(ctx context.Context, req *pb.GetGoodInfoReq) (*pb.GetGoodInfoReply, error) {
	resp := &pb.GetGoodInfoReply{}
	good, err := s.goodRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询渠道信息
	channel, err := s.channelRepo.FindOneCacheByID(ctx, good.ChannelID)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	orderSummaryMap, err := s.orderRepo.GetOrderSummaryInfoByGoodIds(ctx, []string{good.ChannelGoodID})
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 通过平台商品查询商品名称
	var platformGoodIdList []string
	platformGoodIdList = append(platformGoodIdList, good.PlatformGoodID)
	platformGoodList, err := s.platformGoodRepo.FindMultiCacheByIDS(ctx, platformGoodIdList)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	platformGoodIdToNameMap := make(map[string]string)
	for _, platformGood := range platformGoodList {
		platformGoodIdToNameMap[platformGood.ID] = platformGood.Name
	}

	// 获取商品类型
	goodType := ""
	if len(platformGoodList) > 0 {
		goodType = platformGoodList[0].GoodType
	}

	resp.Info = &pb.GoodInfo{
		Id:                    good.ID,
		Name:                  platformGoodIdToNameMap[good.PlatformGoodID],
		Price:                 int32(good.Price*100 + 0.5), // 数据库存储的是元，转换为分返回给前端，四舍五入
		Sales:                 orderSummaryMap[good.ChannelGoodID],
		Status:                good.Status,
		AppointmentRules:      good.AppointmentRules,
		Channel:               channel.Name,
		ChannelGoodId:         good.ChannelGoodID,
		PlatformGoodId:        good.PlatformGoodID,
		ChannelId:             good.ChannelID,
		IsPushAppointmentInfo: good.IsPushAppointmentInfo,
		GoodType:              goodType,
		PurchaseAgreementName: good.PurchaseAgreementName,
		PurchaseAgreementLink: good.PurchaseAgreementLink,
		CreatedAt:             good.CreatedAt.Format(time.RFC3339),
		UpdatedAt:             good.UpdatedAt.Format(time.RFC3339),
	}
	var mainImage []string
	err = jsonutil.Unmarshal(good.MainImage, &mainImage)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	resp.Info.MainImage = mainImage

	var detailImages []string
	err = jsonutil.Unmarshal(good.DetailImages, &detailImages)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	resp.Info.DetailImages = detailImages

	content := &pb.GoodContent{}
	err = jsonutil.Unmarshal(good.Content, content)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	resp.Info.Content = content

	var label []string
	if len(good.Label) > 0 && string(good.Label) != "null" {
		err = jsonutil.Unmarshal(good.Label, &label)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
	}
	resp.Info.Label = label

	return resp, nil
}
