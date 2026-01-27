package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.GoodRecommendationCategoryRepo = (*GoodRecommendationCategoryRepo)(nil)

func NewGoodRecommendationCategoryRepo(
	logger log.Logger,
	data *Data,
	goodRecommendationCategoryRepo *yanxue_repo.GoodRecommendationCategoryRepo,
) biz.GoodRecommendationCategoryRepo {
	l := log.NewHelper(log.With(logger, "module", "data/goodRecommendationCategory"), log.WithMessageKey("message"))
	return &GoodRecommendationCategoryRepo{
		log:                            l,
		data:                           data,
		GoodRecommendationCategoryRepo: goodRecommendationCategoryRepo,
	}
}

type GoodRecommendationCategoryRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.GoodRecommendationCategoryRepo
}
