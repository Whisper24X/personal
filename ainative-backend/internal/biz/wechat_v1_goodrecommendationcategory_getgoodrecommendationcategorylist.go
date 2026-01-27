package biz

import (
	"context"
	"encoding/json"

	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	"gorm.io/datatypes"

	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// GetGoodRecommendationCategoryList 商品推荐分类表-列表数据查询
func (w *WechatV1GoodRecommendationCategoryUseCase) GetGoodRecommendationCategoryList(ctx context.Context, req *pb.GetGoodRecommendationCategoryListReq) (*pb.GetGoodRecommendationCategoryListReply, error) {
	// 构建查询条件 - 只查询上架状态的数据
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
		Query: []*condition.QueryParam{
			{
				Field: "status",
				Value: constant.ValidStatus, // 只查询上架状态的数据
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
		},
		Order: []*condition.OrderParam{ // 按排序号升序
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
	dataList, conditionReply, err := w.goodRecommendationCategoryRepo.FindMultiCacheByCondition(ctx, conditionReq)
	if err != nil {
		w.log.Errorf("查询商品推荐分类列表失败: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
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

	// 去重goodIds
	uniqueGoodIds := make([]string, 0, len(goodIds))
	goodIdSet := make(map[string]bool)
	for _, goodId := range goodIds {
		if !goodIdSet[goodId] {
			goodIdSet[goodId] = true
			uniqueGoodIds = append(uniqueGoodIds, goodId)
		}
	}

	// 批量查询商品信息
	var goodMap map[string]*yanxue_model.Good
	if len(uniqueGoodIds) > 0 {
		goods, err := w.goodRepo.FindMultiCacheByIDS(ctx, uniqueGoodIds)
		if err != nil {
			w.log.Errorf("查询商品信息失败: %v", err)
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}

		// 通过平台商品查询商品名称
		var platformGoodIdList []string
		for _, good := range goods {
			platformGoodIdList = append(platformGoodIdList, good.PlatformGoodID)
		}
		platformGoodIdList = lo.Uniq(platformGoodIdList)
		platformGoodList, err := w.platformGoodRepo.FindMultiCacheByIDS(ctx, platformGoodIdList)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		platformGoodIdToNameMap := make(map[string]string)
		for _, platformGood := range platformGoodList {
			platformGoodIdToNameMap[platformGood.ID] = platformGood.Name
		}

		// 创建商品映射
		goodMap = make(map[string]*yanxue_model.Good)
		for _, good := range goods {
			goodName := platformGoodIdToNameMap[good.PlatformGoodID]
			if goodName != "" {
				good.Name = goodName
			}
			goodMap[good.ID] = good
		}
	} else {
		goodMap = make(map[string]*yanxue_model.Good)
	}

	// 转换数据
	list := make([]*pb.GoodRecommendationCategoryInfo, 0, len(dataList))
	for _, data := range dataList {
		info, err := w.convertModelToInfo(data, goodMap)
		if err != nil {
			w.log.Errorf("转换数据失败: %v", err)
			continue
		}
		list = append(list, info)
	}

	return &pb.GetGoodRecommendationCategoryListReply{
		Total: conditionReply.Total,
		List:  list,
	}, nil
}

// convertModelToInfo 将数据模型转换为响应信息格式
func (w *WechatV1GoodRecommendationCategoryUseCase) convertModelToInfo(data *yanxue_model.GoodRecommendationCategory, goodMap map[string]*yanxue_model.Good) (*pb.GoodRecommendationCategoryInfo, error) {
	// 转换商品列表
	goodItems, err := w.convertJSONToGoodItems(data.GoodItems, goodMap)
	if err != nil {
		return nil, err
	}

	return &pb.GoodRecommendationCategoryInfo{
		Id:        data.ID,
		Name:      data.Name,
		Icon:      data.Icon,
		Status:    data.Status,
		SortOrder: data.SortOrder,
		GoodItems: goodItems,
	}, nil
}

// convertJSONToGoodItems 将JSON格式转换为商品列表
func (w *WechatV1GoodRecommendationCategoryUseCase) convertJSONToGoodItems(jsonData datatypes.JSON, goodMap map[string]*yanxue_model.Good) ([]*pb.GoodItem, error) {
	if len(jsonData) == 0 || string(jsonData) == "null" {
		return []*pb.GoodItem{}, nil
	}

	// 反序列化JSON
	var items []map[string]interface{}
	err := json.Unmarshal(jsonData, &items)
	if err != nil {
		return nil, err
	}

	// 转换为pb格式
	goodItems := make([]*pb.GoodItem, 0, len(items))
	for _, item := range items {
		goodId, ok := item["goodId"].(string)
		if !ok {
			continue
		}
		sortOrder, ok := item["sortOrder"].(float64)
		if !ok {
			continue
		}

		// 读取 isShowInHomepage 字段（如果存在）
		isShowInHomepage := false
		if isShowInHomepageVal, ok := item["isShowInHomepage"]; ok {
			if isShowInHomepageBool, ok := isShowInHomepageVal.(bool); ok {
				isShowInHomepage = isShowInHomepageBool
			}
		}

		// 创建商品项
		goodItem := &pb.GoodItem{
			GoodId:           goodId,
			SortOrder:        int32(sortOrder),
			IsShowInHomepage: isShowInHomepage,
		}

		// 从商品映射中获取商品信息
		if good, exists := goodMap[goodId]; exists {
			goodItem.GoodName = good.Name
			goodItem.Price = int32(good.Price*100 + 0.5) // 数据库存储的是元，转换为分返回给前端，四舍五入
			// 如果商品不是上架状态则跳过
			if good.Status != string(constant.GoodStatusPutOn) {
				continue
			}
			// 解析主图（取第一张）
			var mainImages []string
			if len(good.MainImage) > 0 && string(good.MainImage) != "null" {
				err := json.Unmarshal(good.MainImage, &mainImages)
				if err == nil && len(mainImages) > 0 {
					goodItem.MainImage = mainImages[0]
				}
			}

			// 解析标签
			var labels []string
			if len(good.Label) > 0 && string(good.Label) != "null" {
				err := json.Unmarshal(good.Label, &labels)
				if err == nil {
					goodItem.Label = labels
				}
			}

			goodItems = append(goodItems, goodItem)
		}
	}

	return goodItems, nil
}
