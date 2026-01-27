package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewWechatV1GoodRecommendationCategoryService(
	logger log.Logger,
	wechatV1GoodRecommendationCategoryUseCase *biz.WechatV1GoodRecommendationCategoryUseCase,
) *WechatV1GoodRecommendationCategoryService {
	l := log.NewHelper(log.With(logger, "module", "service/wechatV1GoodRecommendationCategory"), log.WithMessageKey("message"))
	return &WechatV1GoodRecommendationCategoryService{
		log: l,
		wechatV1GoodRecommendationCategoryUseCase: wechatV1GoodRecommendationCategoryUseCase,
	}
}

type WechatV1GoodRecommendationCategoryService struct {
	pb.UnimplementedGoodRecommendationCategoryServer
	log                                       *log.Helper
	wechatV1GoodRecommendationCategoryUseCase *biz.WechatV1GoodRecommendationCategoryUseCase
}

// GetGoodRecommendationCategoryList 商品推荐分类表-列表数据查询
func (w *WechatV1GoodRecommendationCategoryService) GetGoodRecommendationCategoryList(ctx context.Context, req *pb.GetGoodRecommendationCategoryListReq) (*pb.GetGoodRecommendationCategoryListReply, error) {
	return w.wechatV1GoodRecommendationCategoryUseCase.GetGoodRecommendationCategoryList(ctx, req)
}
