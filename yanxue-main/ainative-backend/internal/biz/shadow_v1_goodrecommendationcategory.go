package biz

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	"github.com/go-kratos/kratos/v2/log"
	"gorm.io/datatypes"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

func NewShadowV1GoodRecommendationCategoryUseCase(
	logger log.Logger,
	goodRecommendationCategoryRepo GoodRecommendationCategoryRepo,
	sysAdminRepo SysAdminRepo,
	goodRepo GoodRepo,
	platformGoodRepo PlatformGoodRepo,
) *ShadowV1GoodRecommendationCategoryUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1GoodRecommendationCategory"), log.WithMessageKey("message"))
	return &ShadowV1GoodRecommendationCategoryUseCase{
		log:                            l,
		goodRecommendationCategoryRepo: goodRecommendationCategoryRepo,
		sysAdminRepo:                   sysAdminRepo,
		goodRepo:                       goodRepo,
		platformGoodRepo:               platformGoodRepo,
	}
}

type ShadowV1GoodRecommendationCategoryUseCase struct {
	log                            *log.Helper
	goodRecommendationCategoryRepo GoodRecommendationCategoryRepo
	sysAdminRepo                   SysAdminRepo
	goodRepo                       GoodRepo
	platformGoodRepo               PlatformGoodRepo
}

// convertGoodItemsToJSON 将商品列表转换为JSON格式
func (uc *ShadowV1GoodRecommendationCategoryUseCase) convertGoodItemsToJSON(goodItems []*pb.StoreGoodItem) (datatypes.JSON, error) {
	if len(goodItems) == 0 {
		return datatypes.JSON("[]"), nil
	}

	// 转换为map切片以便序列化
	items := make([]map[string]interface{}, 0, len(goodItems))
	for _, item := range goodItems {
		items = append(items, map[string]interface{}{
			"goodId":           item.GoodId,
			"sortOrder":        item.SortOrder,
			"isShowInHomepage": item.IsShowInHomepage,
		})
	}

	// 序列化为JSON
	jsonData, err := json.Marshal(items)
	if err != nil {
		return nil, err
	}

	return jsonData, nil
}

// convertStoreGoodItemsToJSON 将StoreGoodItem列表转换为JSON格式
func (uc *ShadowV1GoodRecommendationCategoryUseCase) convertStoreGoodItemsToJSON(goodItems []*pb.StoreGoodItem) (datatypes.JSON, error) {
	if len(goodItems) == 0 {
		return datatypes.JSON("[]"), nil
	}

	// 转换为map切片以便序列化
	items := make([]map[string]interface{}, 0, len(goodItems))
	for _, item := range goodItems {
		items = append(items, map[string]interface{}{
			"goodId":           item.GoodId,
			"sortOrder":        item.SortOrder,
			"isShowInHomepage": item.IsShowInHomepage,
		})
	}

	// 序列化为JSON
	jsonData, err := json.Marshal(items)
	if err != nil {
		return nil, err
	}

	return jsonData, nil
}

// convertModelToInfo 将数据模型转换为响应信息格式
func (uc *ShadowV1GoodRecommendationCategoryUseCase) convertModelToInfo(data *yanxue_model.GoodRecommendationCategory, adminMap map[string]string, goodMap map[string]*yanxue_model.Good) (*pb.GoodRecommendationCategoryInfo, error) {
	// 转换商品列表
	goodItems, err := uc.convertJSONToGoodItems(data.GoodItems, goodMap)
	if err != nil {
		return nil, err
	}

	return &pb.GoodRecommendationCategoryInfo{
		Id:            data.ID,
		Name:          data.Name,
		Icon:          data.Icon,
		Status:        data.Status,
		SortOrder:     data.SortOrder,
		GoodItems:     goodItems,
		CreatedAt:     data.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     data.UpdatedAt.Format(time.RFC3339),
		UpdatedBy:     data.UpdatedBy,
		UpdatedByName: adminMap[data.UpdatedBy],
	}, nil
}

// convertJSONToGoodItems 将JSON格式转换为商品列表
func (uc *ShadowV1GoodRecommendationCategoryUseCase) convertJSONToGoodItems(jsonData datatypes.JSON, goodMap map[string]*yanxue_model.Good) ([]*pb.GoodItem, error) {
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

			// 如果商品是未上架状态，则跳过
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

			goodItems = append(goodItems, goodItem)
		}
	}

	return goodItems, nil
}

// checkCategoryNameDuplicate 检查商品推荐分类名称是否重复
func (uc *ShadowV1GoodRecommendationCategoryUseCase) checkCategoryNameDuplicate(ctx context.Context, name, id string) error {
	if name == "" {
		uc.log.Error("分类名称不能为空")
		return errors.New(http.StatusBadRequest, "-1", "分类名称不能为空")
	}
	category, err := uc.goodRecommendationCategoryRepo.FindOneCacheByName(ctx, name)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	if category != nil && category.Name == name && category.ID != id {
		return errors.New(http.StatusBadRequest, "-1", "不得和已有名称重复")
	}
	return nil
}
