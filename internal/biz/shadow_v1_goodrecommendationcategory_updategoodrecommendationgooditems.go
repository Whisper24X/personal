package biz

import (
	"context"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateGoodRecommendationGoodItems 商品推荐分类表-更新商品数据
func (uc *ShadowV1GoodRecommendationCategoryUseCase) UpdateGoodRecommendationGoodItems(ctx context.Context, req *pb.UpdateGoodRecommendationGoodItemsReq) (*pb.UpdateGoodRecommendationGoodItemsReply, error) {
	// 参数验证
	if req.Id == "" {
		uc.log.Error("分类ID不能为空")
		return nil, errors.New(http.StatusBadRequest, "-1", "分类ID不能为空")
	}

	// 先查询原有数据
	oldData, err := uc.goodRecommendationCategoryRepo.FindOneCacheByID(ctx, req.Id)
	if err != nil {
		uc.log.Errorf("查询商品推荐分类失败: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if oldData == nil {
		uc.log.Error("商品推荐分类不存在")
		return nil, errorx.GoodRecommendationCategoryNotFound.Err()
	}

	// 转换商品列表为JSON
	goodItemsJSON, err := uc.convertStoreGoodItemsToJSON(req.GoodItems)
	if err != nil {
		uc.log.Errorf("转换商品列表失败: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	adminId := meta.GetAdminID(ctx)

	// 创建更新数据模型（只更新商品数据和更新时间）
	newData := uc.goodRecommendationCategoryRepo.DeepCopy(oldData)
	newData.UpdatedBy = adminId
	newData.GoodItems = goodItemsJSON

	// 调用repo更新数据
	err = uc.goodRecommendationCategoryRepo.UpdateOneCache(ctx, newData, oldData)
	if err != nil {
		uc.log.Errorf("更新商品推荐分类商品数据失败: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	return &pb.UpdateGoodRecommendationGoodItemsReply{}, nil
}
