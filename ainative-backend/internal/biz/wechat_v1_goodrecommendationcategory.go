package biz

import (
	"github.com/go-kratos/kratos/v2/log"
)

func NewWechatV1GoodRecommendationCategoryUseCase(
	logger log.Logger,
	goodRecommendationCategoryRepo GoodRecommendationCategoryRepo,
	goodRepo GoodRepo,
	platformGoodRepo PlatformGoodRepo,
) *WechatV1GoodRecommendationCategoryUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/wechatV1GoodRecommendationCategory"), log.WithMessageKey("message"))
	return &WechatV1GoodRecommendationCategoryUseCase{
		log:                            l,
		goodRecommendationCategoryRepo: goodRecommendationCategoryRepo,
		goodRepo:                       goodRepo,
		platformGoodRepo:               platformGoodRepo,
	}
}

type WechatV1GoodRecommendationCategoryUseCase struct {
	log                            *log.Helper
	goodRecommendationCategoryRepo GoodRecommendationCategoryRepo
	goodRepo                       GoodRepo
	platformGoodRepo               PlatformGoodRepo
}
