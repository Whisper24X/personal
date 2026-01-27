package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// CreateGoodRecommendationCategory 商品推荐分类表-创建一条数据
func (uc *ShadowV1GoodRecommendationCategoryUseCase) CreateGoodRecommendationCategory(ctx context.Context, req *pb.CreateGoodRecommendationCategoryReq) (*pb.CreateGoodRecommendationCategoryReply, error) {
	// 参数验证：检查分类名称重复
	err := uc.checkCategoryNameDuplicate(ctx, req.Name, "")
	if err != nil {
		return nil, err
	}

	// 转换商品列表为JSON
	goodItemsJSON, err := uc.convertGoodItemsToJSON(req.GoodItems)
	if err != nil {
		uc.log.Errorf("转换商品列表失败: %v", err)
		return nil, err
	}
	adminId := meta.GetAdminID(ctx)
	// 创建数据模型
	data := &yanxue_model.GoodRecommendationCategory{
		Name:      req.Name,
		Icon:      req.Icon,
		Status:    int32(constant.InvalidStatus),
		SortOrder: req.SortOrder,
		GoodItems: goodItemsJSON,
		UpdatedBy: adminId,
	}

	// 调用repo创建数据
	err = uc.goodRecommendationCategoryRepo.CreateOneCache(ctx, data)
	if err != nil {
		uc.log.Errorf("创建商品推荐分类失败: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	return &pb.CreateGoodRecommendationCategoryReply{
		Id: data.ID,
	}, nil
}
