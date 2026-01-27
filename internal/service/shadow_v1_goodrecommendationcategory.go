package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1GoodRecommendationCategoryService(
	logger log.Logger,
	shadowV1GoodRecommendationCategoryUseCase *biz.ShadowV1GoodRecommendationCategoryUseCase,
) *ShadowV1GoodRecommendationCategoryService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1GoodRecommendationCategory"), log.WithMessageKey("message"))
	return &ShadowV1GoodRecommendationCategoryService{
		log: l,
		shadowV1GoodRecommendationCategoryUseCase: shadowV1GoodRecommendationCategoryUseCase,
	}
}

type ShadowV1GoodRecommendationCategoryService struct {
	pb.UnimplementedGoodRecommendationCategoryServer
	log                                       *log.Helper
	shadowV1GoodRecommendationCategoryUseCase *biz.ShadowV1GoodRecommendationCategoryUseCase
}

// CreateGoodRecommendationCategory 商品推荐分类表-创建一条数据
func (s *ShadowV1GoodRecommendationCategoryService) CreateGoodRecommendationCategory(ctx context.Context, req *pb.CreateGoodRecommendationCategoryReq) (*pb.CreateGoodRecommendationCategoryReply, error) {
	return s.shadowV1GoodRecommendationCategoryUseCase.CreateGoodRecommendationCategory(ctx, req)
}

// UpdateGoodRecommendationCategory 商品推荐分类表-更新一条数据
func (s *ShadowV1GoodRecommendationCategoryService) UpdateGoodRecommendationCategory(ctx context.Context, req *pb.UpdateGoodRecommendationCategoryReq) (*pb.UpdateGoodRecommendationCategoryReply, error) {
	return s.shadowV1GoodRecommendationCategoryUseCase.UpdateGoodRecommendationCategory(ctx, req)
}

// GetGoodRecommendationCategoryInfo 商品推荐分类表-单条数据查询
func (s *ShadowV1GoodRecommendationCategoryService) GetGoodRecommendationCategoryInfo(ctx context.Context, req *pb.GetGoodRecommendationCategoryInfoReq) (*pb.GetGoodRecommendationCategoryInfoReply, error) {
	return s.shadowV1GoodRecommendationCategoryUseCase.GetGoodRecommendationCategoryInfo(ctx, req)
}

// GetGoodRecommendationCategoryList 商品推荐分类表-列表数据查询
func (s *ShadowV1GoodRecommendationCategoryService) GetGoodRecommendationCategoryList(ctx context.Context, req *pb.GetGoodRecommendationCategoryListReq) (*pb.GetGoodRecommendationCategoryListReply, error) {
	return s.shadowV1GoodRecommendationCategoryUseCase.GetGoodRecommendationCategoryList(ctx, req)
}

// UpdateGoodRecommendationCategoryStatus 商品推荐分类表-修改上架状态
func (s *ShadowV1GoodRecommendationCategoryService) UpdateGoodRecommendationCategoryStatus(ctx context.Context, req *pb.UpdateGoodRecommendationCategoryStatusReq) (*pb.UpdateGoodRecommendationCategoryStatusReply, error) {
	return s.shadowV1GoodRecommendationCategoryUseCase.UpdateGoodRecommendationCategoryStatus(ctx, req)
}

// UpdateGoodRecommendationGoodItems 商品推荐分类表-更新商品数据
func (s *ShadowV1GoodRecommendationCategoryService) UpdateGoodRecommendationGoodItems(ctx context.Context, req *pb.UpdateGoodRecommendationGoodItemsReq) (*pb.UpdateGoodRecommendationGoodItemsReply, error) {
	return s.shadowV1GoodRecommendationCategoryUseCase.UpdateGoodRecommendationGoodItems(ctx, req)
}
