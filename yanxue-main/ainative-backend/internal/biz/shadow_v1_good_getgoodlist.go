package biz

import (
	"context"
	"net/http"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetGoodList 商品-列表数据查询
func (s *ShadowV1GoodUseCase) GetGoodList(ctx context.Context, req *pb.GetGoodListReq) (*pb.GetGoodListReply, error) {
	resp := &pb.GetGoodListReply{}
	page := int32(1)
	pageSize := int32(100)
	if req.GetPage() > 0 {
		page = req.GetPage()
	}
	if req.GetPageSize() > 0 {
		pageSize = req.GetPageSize()
	}
	param := &condition.Req{
		Page:     page,
		PageSize: pageSize,
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}

	if req.GetPlatformGoodId() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "platformGoodId",
			Value: req.GetPlatformGoodId(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	if req.GetChannelName() != "" {
		// 查询渠道ID
		channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		channelId := ""
		for _, channel := range channelList {
			if req.GetChannelName() == channel.Name {
				channelId = channel.ID
				break
			}
		}
		if channelId == "" {
			return resp, errors.New(http.StatusBadRequest, "-1", "渠道名称不存在！")
		}
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "channelId",
			Value: channelId,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	if req.GetGoodName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "name",
			Value: "%" + req.GetGoodName() + "%",
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

	goodList, reply, err := s.goodRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = reply.Total

	// 查询渠道信息
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	channelMap := make(map[string]string)
	for _, channel := range channelList {
		channelMap[channel.ID] = channel.Name
	}

	var updatedByList []string
	for _, good := range goodList {
		if good.UpdatedBy != "" {
			updatedByList = append(updatedByList, good.UpdatedBy)
		}
	}

	operatorIdToNameMap, err := s.sysAdminRepo.AdminIdToName(ctx, updatedByList)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	var goodIdList []string
	for _, good := range goodList {
		goodIdList = append(goodIdList, good.ChannelGoodID)
	}
	orderSummaryMap, err := s.orderRepo.GetOrderSummaryInfoByGoodIds(ctx, goodIdList)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 通过平台商品查询商品名称
	var platformGoodIdList []string
	for _, good := range goodList {
		platformGoodIdList = append(platformGoodIdList, good.PlatformGoodID)
	}
	platformGoodIdList = lo.Uniq(platformGoodIdList)
	platformGoodList, err := s.platformGoodRepo.FindMultiCacheByIDS(ctx, platformGoodIdList)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	platformGoodIdToNameMap := make(map[string]string)
	platformGoodIdToTypeMap := make(map[string]string)
	for _, platformGood := range platformGoodList {
		platformGoodIdToNameMap[platformGood.ID] = platformGood.Name
		platformGoodIdToTypeMap[platformGood.ID] = platformGood.GoodType
	}

	for _, good := range goodList {
		goodItem := &pb.GoodInfo{
			Id:                    good.ID,
			Name:                  platformGoodIdToNameMap[good.PlatformGoodID],
			Price:                 int32(good.Price*100 + 0.5), // 数据库存储的是元，转换为分返回给前端，四舍五入
			Sales:                 orderSummaryMap[good.ChannelGoodID],
			Status:                good.Status,
			AppointmentRules:      good.AppointmentRules,
			Channel:               channelMap[good.ChannelID],
			ChannelId:             good.ChannelID,
			ChannelGoodId:         good.ChannelGoodID,
			PlatformGoodId:        good.PlatformGoodID,
			CreatedAt:             good.CreatedAt.Format(time.RFC3339),
			UpdatedAt:             good.UpdatedAt.Format(time.RFC3339),
			UpdatedBy:             good.UpdatedBy,
			UpdatedByName:         operatorIdToNameMap[good.UpdatedBy],
			IsPushAppointmentInfo: good.IsPushAppointmentInfo,
			GoodType:              platformGoodIdToTypeMap[good.PlatformGoodID],
			PurchaseAgreementName: good.PurchaseAgreementName,
			PurchaseAgreementLink: good.PurchaseAgreementLink,
		}
		var mainImage []string
		err = jsonutil.Unmarshal(good.MainImage, &mainImage)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		goodItem.MainImage = mainImage

		var detailImages []string
		err = jsonutil.Unmarshal(good.DetailImages, &detailImages)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		goodItem.DetailImages = detailImages

		content := &pb.GoodContent{}
		err = jsonutil.Unmarshal(good.Content, content)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		goodItem.Content = content

		var label []string
		if len(good.Label) > 0 && string(good.Label) != "null" {
			err = jsonutil.Unmarshal(good.Label, &label)
			if err != nil {
				return resp, errorx.DataFormattingError.WithError(err).Err()
			}
		}
		goodItem.Label = label

		resp.List = append(resp.List, goodItem)
	}

	return resp, nil
}
