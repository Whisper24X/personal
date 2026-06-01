package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateGoodRecommendationCategory 商品推荐分类表-更新一条数据
func (uc *ShadowV1GoodRecommendationCategoryUseCase) UpdateGoodRecommendationCategory(ctx context.Context, req *pb.UpdateGoodRecommendationCategoryReq) (*pb.UpdateGoodRecommendationCategoryReply, error) {
	// 参数验证：检查分类名称重复（排除自己）
	err := uc.checkCategoryNameDuplicate(ctx, req.Name, req.Id)
	if err != nil {
		return nil, err
	}

	// 先查询原有数据
	oldData, err := uc.goodRecommendationCategoryRepo.FindOneCacheByID(ctx, req.Id)
	if err != nil {
		uc.log.Errorf("查询商品推荐分类失败: %v", err)
		return nil, err
	}
	if oldData == nil {
		uc.log.Error("商品推荐分类不存在")
		return nil, errorx.GoodRecommendationCategoryNotFound.Err()
	}

	adminId := meta.GetAdminID(ctx)

	// 创建更新数据模型
	newData := uc.goodRecommendationCategoryRepo.DeepCopy(oldData)
	newData.Name = req.Name
	newData.Icon = req.Icon
	newData.SortOrder = req.SortOrder
	newData.UpdatedBy = adminId

	// 调用repo更新数据
	err = uc.goodRecommendationCategoryRepo.UpdateOneCache(ctx, newData, oldData)
	if err != nil {
		uc.log.Errorf("更新商品推荐分类失败: %v", err)
		return nil, err
	}

	return &pb.UpdateGoodRecommendationCategoryReply{}, nil
}
