package biz

import (
	"context"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
)

// UpdateGoodRecommendationCategoryStatus 商品推荐分类表-修改上架状态
func (uc *ShadowV1GoodRecommendationCategoryUseCase) UpdateGoodRecommendationCategoryStatus(ctx context.Context, req *pb.UpdateGoodRecommendationCategoryStatusReq) (*pb.UpdateGoodRecommendationCategoryStatusReply, error) {
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

	adminId := meta.GetAdminID(ctx)

	if req.Status != int32(constant.ValidStatus) && req.Status != int32(constant.InvalidStatus) {
		return nil, errors.New(http.StatusConflict, "-1", "状态值不合法")
	}
	// 创建更新数据模型（只更新状态和更新时间）
	newData := &yanxue_model.GoodRecommendationCategory{
		ID:        req.Id,
		Status:    req.Status,
		UpdatedBy: adminId,
	}

	// 调用repo更新数据
	err = uc.goodRecommendationCategoryRepo.UpdateOneCache(ctx, newData, oldData)
	if err != nil {
		uc.log.Errorf("更新商品推荐分类状态失败: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	return &pb.UpdateGoodRecommendationCategoryStatusReply{}, nil
}
