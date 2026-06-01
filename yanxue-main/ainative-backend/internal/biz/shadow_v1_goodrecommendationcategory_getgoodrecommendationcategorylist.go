package biz

import (
	"context"
	"encoding/json"
	"github.com/samber/lo"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// GetGoodRecommendationCategoryList 商品推荐分类表-列表数据查询
func (uc *ShadowV1GoodRecommendationCategoryUseCase) GetGoodRecommendationCategoryList(ctx context.Context, req *pb.GetGoodRecommendationCategoryListReq) (*pb.GetGoodRecommendationCategoryListReply, error) {
	// 构建查询条件
	page := int32(1)
	pageSize := int32(100)
	if req.GetPage() != 0 {
		page = req.GetPage()
	}
	if req.GetPageSize() != 0 {
		pageSize = req.GetPageSize()
	}
	conditionReq := &condition.Req{
		Page:     page,
		PageSize: pageSize,
		Order: []*condition.OrderParam{ // 按排序号升序，创建时间降序
			{
				Field: "sortOrder",
				Order: condition.ASC,
			},
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}

	// 查询数据
	dataList, conditionReply, err := uc.goodRecommendationCategoryRepo.FindMultiCacheByCondition(ctx, conditionReq)
	if err != nil {
		uc.log.Errorf("查询商品推荐分类列表失败: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 收集所有的updatedBy用于查询管理员名称
	adminIds := make([]string, 0, len(dataList))
	for _, data := range dataList {
		if data.UpdatedBy != "" {
			adminIds = append(adminIds, data.UpdatedBy)
		}
	}

	// 收集所有的商品ID用于查询商品信息
	goodIds := make([]string, 0)
	for _, data := range dataList {
		if len(data.GoodItems) > 0 && string(data.GoodItems) != "null" {
			var items []map[string]interface{}
			err := json.Unmarshal(data.GoodItems, &items)
			if err == nil {
				for _, item := range items {
					if goodId, ok := item["goodId"].(string); ok && goodId != "" {
						goodIds = append(goodIds, goodId)
					}
				}
			}
		}
	}

	// 去重商品ID
	uniqueGoodIds := make([]string, 0)
	goodIdSet := make(map[string]bool)
	for _, goodId := range goodIds {
		if !goodIdSet[goodId] {
			goodIdSet[goodId] = true
			uniqueGoodIds = append(uniqueGoodIds, goodId)
		}
	}

	// 查询管理员名称
	adminMap, err := uc.sysAdminRepo.AdminIdToName(ctx, adminIds)
	if err != nil {
		uc.log.Errorf("查询管理员姓名失败: %v", err)
		return nil, err
	}

	// 查询商品信息
	goodList, err := uc.goodRepo.FindMultiCacheByIDS(ctx, uniqueGoodIds)
	if err != nil {
		uc.log.Errorf("查询商品信息失败: %v", err)
		return nil, err
	}
	// 通过平台商品查询商品名称
	var platformGoodIdList []string
	for _, good := range goodList {
		platformGoodIdList = append(platformGoodIdList, good.PlatformGoodID)
	}
	platformGoodIdList = lo.Uniq(platformGoodIdList)
	platformGoodList, err := uc.platformGoodRepo.FindMultiCacheByIDS(ctx, platformGoodIdList)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	platformGoodIdToNameMap := make(map[string]string)
	for _, platformGood := range platformGoodList {
		platformGoodIdToNameMap[platformGood.ID] = platformGood.Name
	}

	// 创建商品映射
	goodMap := make(map[string]*yanxue_model.Good)
	for _, good := range goodList {
		goodName := platformGoodIdToNameMap[good.PlatformGoodID]
		if goodName != "" {
			good.Name = goodName
		}
		goodMap[good.ID] = good
	}

	// 转换数据为响应格式
	list := make([]*pb.GoodRecommendationCategoryInfo, 0, len(dataList))
	for _, data := range dataList {
		info, err := uc.convertModelToInfo(data, adminMap, goodMap)
		if err != nil {
			uc.log.Errorf("转换数据格式失败: %v", err)
			return nil, err
		}
		list = append(list, info)
	}

	return &pb.GetGoodRecommendationCategoryListReply{
		Total: conditionReply.Total,
		List:  list,
	}, nil
}
