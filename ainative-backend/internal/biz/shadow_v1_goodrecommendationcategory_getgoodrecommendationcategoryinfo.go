package biz

import (
	"context"
	"encoding/json"
	"github.com/samber/lo"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// GetGoodRecommendationCategoryInfo 商品推荐分类表-单条数据查询
func (uc *ShadowV1GoodRecommendationCategoryUseCase) GetGoodRecommendationCategoryInfo(ctx context.Context, req *pb.GetGoodRecommendationCategoryInfoReq) (*pb.GetGoodRecommendationCategoryInfoReply, error) {
	// 查询数据
	data, err := uc.goodRecommendationCategoryRepo.FindOneCacheByID(ctx, req.Id)
	if err != nil {
		uc.log.Errorf("查询商品推荐分类失败: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if data == nil {
		uc.log.Error("商品推荐分类不存在")
		return nil, errorx.GoodRecommendationCategoryNotFound.Err()
	}

	// 查询管理员名称
	adminMap, err := uc.sysAdminRepo.AdminIdToName(ctx, []string{data.UpdatedBy})
	if err != nil {
		uc.log.Errorf("查询管理员姓名失败: %v", err)
		return nil, err
	}

	// 收集商品ID用于查询商品信息
	var goodIds []string
	if len(data.GoodItems) > 0 && string(data.GoodItems) != "null" {
		var items []map[string]interface{}
		err = json.Unmarshal(data.GoodItems, &items)
		if err == nil {
			for _, item := range items {
				if goodId, ok := item["goodId"].(string); ok && goodId != "" {
					goodIds = append(goodIds, goodId)
				}
			}
		}
	}

	// 查询商品信息
	goodList, err := uc.goodRepo.FindMultiCacheByIDS(ctx, goodIds)
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
		if platformGoodIdToNameMap[good.PlatformGoodID] != "" {
			good.Name = platformGoodIdToNameMap[good.PlatformGoodID]
		}
		goodMap[good.ID] = good
	}

	// 转换数据为响应格式
	info, err := uc.convertModelToInfo(data, adminMap, goodMap)
	if err != nil {
		uc.log.Errorf("转换数据格式失败: %v", err)
		return nil, err
	}

	return &pb.GetGoodRecommendationCategoryInfoReply{
		Info: info,
	}, nil
}
