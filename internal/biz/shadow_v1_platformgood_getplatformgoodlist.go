package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetPlatformGoodList 平台商品-列表数据查询
func (s *ShadowV1PlatformGoodUseCase) GetPlatformGoodList(ctx context.Context, req *pb.GetPlatformGoodListReq) (*pb.GetPlatformGoodListReply, error) {
	resp := &pb.GetPlatformGoodListReply{}
	param := &condition.Req{
		Query: []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}
	if req.GetPage() != 0 {
		param.Page = req.GetPage()
	}
	if req.GetPageSize() != 0 {
		param.PageSize = req.GetPageSize()
	}
	// 根据模版名称模糊查询
	if req.GetName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "name",
			Value: "%%" + req.GetName() + "%%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}
	platformGoodList, reply, err := s.platformGoodRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	var operatorList []string
	var platformGoodIdList []string
	for _, item := range platformGoodList {
		platformGoodIdList = append(platformGoodIdList, item.ID)
		if item.UpdatedBy != "" {
			operatorList = append(operatorList, item.UpdatedBy)
		}
	}
	operatorIdToNameMap, err := s.sysAdminRepo.AdminIdToName(ctx, operatorList)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	// 查询渠道商品ID列表
	channelGoodList, err := s.goodRepo.FindMultiByPlatformGoodIDS(ctx, platformGoodIdList)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	platformGoodIdToChannelGoodIdListMap := make(map[string][]string)
	var channelGoodIdList []string
	for _, good := range channelGoodList {
		channelGoodIdList = append(channelGoodIdList, good.ChannelGoodID)
		platformGoodIdToChannelGoodIdListMap[good.PlatformGoodID] = append(platformGoodIdToChannelGoodIdListMap[good.PlatformGoodID], good.ChannelGoodID)
	}
	orderSummaryMap, err := s.orderRepo.GetOrderSummaryInfoByGoodIds(ctx, channelGoodIdList)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	platformGoodIdSalesMap := make(map[string]int32)
	for platformGoodId, channelGoodIds := range platformGoodIdToChannelGoodIdListMap {
		sales := int32(0)
		for _, channelGoodId := range channelGoodIds {
			sales += orderSummaryMap[channelGoodId]
		}
		platformGoodIdSalesMap[platformGoodId] = sales
	}

	for _, platformGood := range platformGoodList {
		resp.List = append(resp.List, &pb.PlatformGoodInfo{
			Id:            platformGood.ID,
			Name:          platformGood.Name,
			Sales:         platformGoodIdSalesMap[platformGood.ID],
			CreatedAt:     platformGood.CreatedAt.Format(time.RFC3339),
			UpdatedAt:     platformGood.UpdatedAt.Format(time.RFC3339),
			UpdatedBy:     platformGood.UpdatedBy,
			UpdatedByName: operatorIdToNameMap[platformGood.UpdatedBy],
			GoodType:      platformGood.GoodType,
		})
	}
	resp.Total = reply.Total
	return resp, nil
}
